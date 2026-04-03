import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, writeBatch, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { runMigration } from '../utils/migration';

const GuildContext = createContext();

export const useGuild = () => useContext(GuildContext);

export const GuildProvider = ({ children, initialData }) => {
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [myMemberId, setMyMemberId] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);

  // Guild Data State
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [parties, setParties] = useState(() => {
    try {
      const saved = localStorage.getItem('guild_parties');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      const data = Array.isArray(parsed) ? parsed : (parsed.data || []);
      // Ensure we always return a plain array of arrays to the component
      return data.map(p => Array.isArray(p) ? p : (p.members || []));
    } catch { return []; }
  });
  const [partyNames, setPartyNames] = useState(() => {
    try {
      const saved = localStorage.getItem('guild_partyNames');
      const defaultNames = ["Alpha Squad", "Bravo Force", "Charlie Wing", "Delta Strike", "Echo Vanguard", "Foxtrot Blade"];
      if (!saved) return defaultNames;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : (parsed.data || defaultNames);
    } catch { return ["Alpha Squad", "Bravo Force", "Charlie Wing", "Delta Strike", "Echo Vanguard", "Foxtrot Blade"]; }
  });
  const [eoRatings, setEoRatings] = useState([]);
  const [auctionSessions, setAuctionSessions] = useState([]);
  const [auctionTemplates, setAuctionTemplates] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [requests, setRequests] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [discordConfig, setDiscordConfig] = useState({ webhookUrl: "" });
  const [onlineUsers, setOnlineUsers] = useState([]); // array of { uid, memberId, displayName, lastSeen }

  const [raidParties, setRaidParties] = useState(() => {
    try {
      const saved = localStorage.getItem('guild_raidParties');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      const data = Array.isArray(parsed) ? parsed : (parsed.data || []);
      return data.map(p => Array.isArray(p) ? p : (p.members || []));
    } catch { return []; }
  });
  const [raidPartyNames, setRaidPartyNames] = useState(() => {
    try {
      const saved = localStorage.getItem('guild_raidPartyNames');
      if (!saved) return ["Raid Alpha"];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : (parsed.data || ["Raid Alpha"]);
    } catch { return ["Raid Alpha"]; }
  });

  // Refs for tracking changes (to avoid unnecessary writes)
  const prevData = useRef({});

  const showToast = (message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  };

  // Derive rank from members if myMemberId is set
  const cleanMyId = (myMemberId || "").trim().toLowerCase();
  const myProfile = members.find(m => m.memberId?.trim().toLowerCase() === cleanMyId);
  const myRank = myProfile?.guildRank || "Member";
  
  const isArchitect = myRank === "System Architect" || myRank === "Creator" || userRole === "architect";
  const hasAdminRank = ["Guild Master", "Vice Guild Master", "Commander"].includes(myRank) || isArchitect;
  const hasOfficerRank = ["Charisma Baby", "Baby Charisma", "Officer"].includes(myRank) || hasAdminRank;

  const isAdmin = userRole === "admin" || userRole === "architect" || hasAdminRank;
  const isOfficer = isAdmin || userRole === "officer" || hasOfficerRank;
  const isMember = userRole === "member";

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const roleSnap = await getDoc(doc(db, "userroles", user.uid));
          if (roleSnap.exists()) {
            const data = roleSnap.data();
            setUserRole(data.role);
            setMyMemberId(data.memberId || null);
          } else {
            // Default to member for new signups
            setUserRole("member");
            setMyMemberId(null);
            await setDoc(doc(db, "userroles", user.uid), { role: "member", email: user.email, displayName: user.email, memberId: null });
          }
        } catch (err) { setUserRole("member"); setMyMemberId(null); }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setMyMemberId(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Presence: write lastSeen on login + heartbeat every 3 minutes
  useEffect(() => {
    if (!currentUser) return;

    const writePresence = async () => {
      try {
        await setDoc(doc(db, "presence", currentUser.uid), {
          uid: currentUser.uid,
          displayName: currentUser.displayName || currentUser.email || "Unknown",
          lastSeen: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn("Presence write failed:", err);
      }
    };

    writePresence(); // write immediately on login
    const heartbeat = setInterval(writePresence, 3 * 60 * 1000); // every 3 minutes

    return () => {
      clearInterval(heartbeat);
      // Mark as offline on unmount / sign-out by writing a past timestamp
      // We leave the doc as-is; it will naturally expire from the "online" list after 5 min
    };
  }, []);

  // Data Loading from new Collections
  useEffect(() => {
    const loadAllData = async () => {
      try {
        // Step 1: Check if migration is needed
        const metaDoc = await getDoc(doc(db, "metadata", "current"));
        if (!metaDoc.exists()) {
          const legacyDoc = await getDoc(doc(db, "guilddata", "main"));
          if (legacyDoc.exists() && !legacyDoc.data().isLegacy) {
            showToast("Migrating data to new schema...", "info");
            await runMigration();
          }
        }

        // Track initial loads to hide spinner only when data is ready
        let rosterLoaded = false;
        let metaLoaded = false;
        const checkReady = () => {
          if (rosterLoaded && metaLoaded) setLoading(false);
        };

        // Step 2: Initialize Real-time Listeners
        const unsubRoster = onSnapshot(collection(db, "roster"), (snap) => {
          const docs = snap.docs.map(d => d.data());
          const finalDocs = docs.length ? docs : (initialData.INITIAL_MEMBERS || []);
          setMembers(finalDocs);
          prevData.current.members = [...finalDocs];
          rosterLoaded = true;
          checkReady();
        });

        const unsubEvents = onSnapshot(collection(db, "events"), (snap) => {
          const docs = snap.docs.map(d => d.data()).sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
          const finalDocs = docs.length ? docs : (initialData.INITIAL_EVENTS || []);
          setEvents(finalDocs);
          prevData.current.events = [...finalDocs];
        });

        const unsubAbsences = onSnapshot(collection(db, "absences"), (snap) => {
          const docs = snap.docs.map(d => d.data());
          setAbsences(docs);
          prevData.current.absences = [...docs];
        });

        const unsubMetadata = onSnapshot(doc(db, "metadata", "current"), (snap) => {
          const data = snap.exists() ? snap.data() : {};
          
          // Sync Parties
          const cloudPartiesRaw = data.parties || [];
          const cloudParties = cloudPartiesRaw.map(p => Array.isArray(p) ? p : (p.members || []));
          setParties(cloudParties);
          prevData.current.parties = [...cloudParties];

          // Sync Raid Parties
          const cloudRaidRaw = data.raidParties || [];
          const cloudRaid = cloudRaidRaw.map(p => Array.isArray(p) ? p : (p.members || []));
          setRaidParties(cloudRaid);
          prevData.current.raidParties = [...cloudRaid];

          // Sync Configs
          setAuctionSessions(data.auctionSessions || []);
          setAuctionTemplates(data.auctionTemplates || []);
          setDiscordConfig(data.discord || { webhookUrl: "" });
          prevData.current.auctionSessions = [...(data.auctionSessions || [])];
          prevData.current.auctionTemplates = [...(data.auctionTemplates || [])];
          prevData.current.discordConfig = { ...(data.discord || { webhookUrl: "" }) };
          
          if (data.partyNames) {
            setPartyNames(data.partyNames);
            prevData.current.partyNames = [...data.partyNames];
          }
          if (data.raidPartyNames) setRaidPartyNames(data.raidPartyNames);
          
          metaLoaded = true;
          checkReady();
        });

        const unsubNotifs = onSnapshot(collection(db, "notifications"), (snap) => {
          const docs = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a,b) => new Date(b.ts) - new Date(a.ts));
          setNotifications(docs);
        });

        const unsubReqs = onSnapshot(collection(db, "requests"), (snap) => {
          const docs = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
          setRequests(docs);
        });

        const unsubJoinReqs = onSnapshot(collection(db, "join_requests"), (snap) => {
          const docs = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
          setJoinRequests(docs);
        });

        const unsubAtt = onSnapshot(collection(db, "attendance"), (snap) => {
          const flat = [];
          snap.docs.forEach(d => {
            const { eventId, members: attMembers } = d.data();
            Object.entries(attMembers || {}).forEach(([memberId, status]) => {
              flat.push({ eventId, memberId, status });
            });
          });
          setAttendance(flat);
          prevData.current.attendance = [...flat];
        });

        const unsubPerf = onSnapshot(collection(db, "performance"), (snap) => {
          const flat = [];
          snap.docs.forEach(d => {
            const { eventId, members: perfMembers } = d.data();
            Object.entries(perfMembers || {}).forEach(([memberId, metrics]) => {
              flat.push({ ...metrics, eventId, memberId });
            });
          });
          setPerformance(flat);
          prevData.current.performance = [...flat];
        });

        const unsubEo = onSnapshot(collection(db, "eoRatings"), (snap) => {
          const flat = [];
          snap.docs.forEach(d => {
            const { eventId, ratings: rates } = d.data();
            Object.entries(rates || {}).forEach(([memberId, rating]) => {
              flat.push({ eventId, memberId, rating });
            });
          });
          setEoRatings(flat);
          prevData.current.eoRatings = [...flat];
        });

        const unsubPresence = onSnapshot(collection(db, "presence"), (snap) => {
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          const online = snap.docs
            .map(d => ({ uid: d.id, ...d.data() }))
            .filter(p => {
              if (!p.lastSeen) return false;
              // Handle both Firestore Timestamp and plain millis
              const ms = p.lastSeen?.toMillis ? p.lastSeen.toMillis() : Number(p.lastSeen);
              return ms > fiveMinutesAgo;
            });
          setOnlineUsers(online);
        });

        return () => {
          unsubRoster(); unsubEvents(); unsubAbsences(); unsubMetadata();
          unsubNotifs(); unsubReqs(); unsubJoinReqs(); unsubAtt();
          unsubPerf(); unsubEo(); unsubPresence();
        };


      } catch (err) {
        console.error("Firebase load error:", err);
        setLoading(false);
      }
    };
    loadAllData();
  }, [initialData]);

  // Granular Save Logic (Debounced)
  useEffect(() => {
    if (loading) return;

    const saveData = async () => {
      try {
        const batch = writeBatch(db);
        let changesCount = 0;

        // 1. Save Members (Only if changed)
        if (JSON.stringify(members) !== JSON.stringify(prevData.current.members)) {
          // Identify removed members
          const currentMemberIds = new Set(members.map(m => m.memberId));
          const removedMemberIds = prevData.current.members
            .filter(m => !currentMemberIds.has(m.memberId))
            .map(m => m.memberId);
          
          removedMemberIds.forEach(mid => {
            if (mid) batch.delete(doc(db, "roster", mid));
          });

          // Update/Set existing members
          members.forEach(m => batch.set(doc(db, "roster", m.memberId), m));
          
          prevData.current.members = [...members];
          changesCount++;
        }

        // 2. Save Events
        if (JSON.stringify(events) !== JSON.stringify(prevData.current.events)) {
          // Identify removed events
          const currentEventIds = new Set(events.map(e => e.eventId));
          const removedEventIds = prevData.current.events
            .filter(e => !currentEventIds.has(e.eventId))
            .map(e => e.eventId);
          
          removedEventIds.forEach(eid => {
            if (eid) {
              batch.delete(doc(db, "events", eid));
              batch.delete(doc(db, "attendance", eid));
              batch.delete(doc(db, "performance", eid));
              batch.delete(doc(db, "eoRatings", eid));
            }
          });

          events.forEach(e => batch.set(doc(db, "events", e.eventId), e));
          prevData.current.events = [...events];
          changesCount++;
        }

        // 3. Save Attendance (Grouped)
        if (JSON.stringify(attendance) !== JSON.stringify(prevData.current.attendance)) {
          const grouped = {};
          attendance.forEach(a => {
            if (!grouped[a.eventId]) grouped[a.eventId] = {};
            grouped[a.eventId][a.memberId] = a.status;
          });
          Object.keys(grouped).forEach(eid => batch.set(doc(db, "attendance", eid), { eventId: eid, members: grouped[eid] }));
          prevData.current.attendance = [...attendance];
          changesCount++;
        }

        // 4. Save Performance
        if (JSON.stringify(performance) !== JSON.stringify(prevData.current.performance)) {
          const grouped = {};
          performance.forEach(p => {
            if (!grouped[p.eventId]) grouped[p.eventId] = {};
            grouped[p.eventId][p.memberId] = p;
          });
          Object.keys(grouped).forEach(eid => batch.set(doc(db, "performance", eid), { eventId: eid, members: grouped[eid] }));
          prevData.current.performance = [...performance];
          changesCount++;
        }

        // 5. Save EO Ratings
        if (JSON.stringify(eoRatings) !== JSON.stringify(prevData.current.eoRatings)) {
          const grouped = {};
          eoRatings.forEach(r => {
            if (!grouped[r.eventId]) grouped[r.eventId] = {};
            grouped[r.eventId][r.memberId] = r.rating;
          });
          Object.keys(grouped).forEach(eid => batch.set(doc(db, "eoRatings", eid), { eventId: eid, ratings: grouped[eid] }));
          prevData.current.eoRatings = [...eoRatings];
          changesCount++;
        }

        if (
          JSON.stringify(parties) !== JSON.stringify(prevData.current.parties) ||
          JSON.stringify(partyNames) !== JSON.stringify(prevData.current.partyNames) ||
          JSON.stringify(auctionSessions) !== JSON.stringify(prevData.current.auctionSessions) ||
          JSON.stringify(auctionTemplates) !== JSON.stringify(prevData.current.auctionTemplates) ||
          JSON.stringify(raidParties) !== JSON.stringify(prevData.current.raidParties) ||
          JSON.stringify(raidPartyNames) !== JSON.stringify(prevData.current.raidPartyNames) ||
          JSON.stringify(discordConfig) !== JSON.stringify(prevData.current.discordConfig)
        ) {
          // Wrap nested arrays for Firestore
          const wrappedParties = parties.map(p => ({ members: p }));
          const wrappedRaids = raidParties.map(p => ({ members: p }));
          batch.set(doc(db, "metadata", "current"), {
            parties: wrappedParties, partyNames,
            raidParties: wrappedRaids, raidPartyNames,
            auctionSessions, auctionTemplates,
            discord: discordConfig,
            lastUpdate: new Date().toISOString()
          });
          prevData.current.parties = [...parties];
          prevData.current.partyNames = [...partyNames];
          prevData.current.auctionSessions = [...auctionSessions];
          prevData.current.auctionTemplates = [...auctionTemplates];
          prevData.current.raidParties = [...raidParties];
          prevData.current.raidPartyNames = [...raidPartyNames];
          prevData.current.discordConfig = { ...discordConfig };
          changesCount++;
        }

        // 7. Save Absences
        if (JSON.stringify(absences) !== JSON.stringify(prevData.current.absences)) {
          // Identify removed absences
          const currentIds = new Set(absences.map(a => a.id));
          const removedIds = prevData.current.absences.filter(a => !currentIds.has(a.id)).map(a => a.id);
          
          removedIds.forEach(rid => {
            if (rid) batch.delete(doc(db, "absences", rid));
          });

          // Set existing/new absences
          absences.forEach(a => {
            if (a.id) batch.set(doc(db, "absences", a.id), a);
          });
          
          prevData.current.absences = [...absences];
          changesCount++;
        }

        if (changesCount > 0) {
          await batch.commit();
          console.log(`Auto-saved ${changesCount} categories.`);
        }
      } catch (err) {
        console.error("Firebase save error:", err);
      }
    };

    const timeout = setTimeout(saveData, 1000);
    return () => clearTimeout(timeout);
  }, [members, events, attendance, performance, absences, parties, eoRatings, auctionSessions, auctionTemplates, raidParties, raidPartyNames, loading]);

  // Immediate localStorage backup with timestamp
  useEffect(() => {
    if (loading) return;
    localStorage.setItem('guild_parties', JSON.stringify({ data: parties, ts: Date.now() }));
  }, [parties, loading]);

  useEffect(() => {
    if (loading) return;
    localStorage.setItem('guild_partyNames', JSON.stringify({ data: partyNames, ts: Date.now() }));
  }, [partyNames, loading]);

  useEffect(() => {
    if (loading) return;
    localStorage.setItem('guild_raidParties', JSON.stringify({ data: raidParties, ts: Date.now() }));
  }, [raidParties, loading]);

  useEffect(() => {
    if (loading) return;
    localStorage.setItem('guild_raidPartyNames', JSON.stringify({ data: raidPartyNames, ts: Date.now() }));
  }, [raidPartyNames, loading]);

  const sendNotification = async (targetId, title, message, type = "info") => {
    const notif = {
      targetId, // memberId or "all"
      title,
      message,
      type,
      ts: new Date().toISOString(),
      readBy: [] // track who read it (for global) or simple status for personal
    };
    const docRef = await setDoc(doc(collection(db, "notifications")), notif);
    setNotifications(prev => [notif, ...prev]);
    showToast("Notification sent", "success");
  };

  const sendDiscordEmbed = async (title, description, color = 0x6382e6, fields = [], thumbnail = null) => {
    if (!discordConfig?.webhookUrl) {
      showToast("Discord Webhook URL not set. Please go to Import > Discord.", "error");
      throw new Error("Webhook URL missing");
    }

    try {
      const embed = {
        title,
        description,
        color,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: "Oblivion Guild Portal" }
      };

      if (thumbnail) embed.thumbnail = { url: thumbnail };

      const response = await fetch(discordConfig.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Discord API Error:", errorData);
        throw new Error(errorData.message || `Discord Error: ${response.status}`);
      }
      
      return true;
    } catch (err) {
      console.error("Discord Webhook Network Error:", err);
      throw err;
    }
  };

  const markNotifRead = async (id) => {
    // For simplicity, we'll just update local state and Firestore if it's personal
    // If it's global, we won't mark it read for everyone
    try {
      const n = notifications.find(x => x.id === id);
      if (n && n.targetId !== "all") {
        await setDoc(doc(db, "notifications", id), { ...n, isRead: true });
        setNotifications(prev => prev.map(x => x.id === id ? { ...x, isRead: true } : x));
      }
    } catch(err) { console.error(err); }
  };

  const resetDatabase = async () => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Get all docs in all collections
      const collections = ["roster", "events", "attendance", "performance", "eoRatings", "absences", "requests"];
      for (const collName of collections) {
        const snap = await getDocs(collection(db, collName));
        snap.forEach(d => batch.delete(d.ref));
      }
      
      // Reset metadata
      batch.set(doc(db, "metadata", "current"), { 
        parties: [], auctionSessions: [], auctionTemplates: [], 
        isInitialized: true, lastReset: new Date().toISOString() 
      });
      
      await batch.commit();
      
      // Clear local state
      setMembers([]);
      setEvents([]);
      setAttendance([]);
      setPerformance([]);
      setAbsences([]);
      setParties([]);
      setEoRatings([]);
      setAuctionSessions([]);
      setAuctionTemplates([]);
      setRequests([]);
      
      localStorage.removeItem('guild_parties');
      localStorage.removeItem('guild_partyNames');
      
      showToast("Database reset successfully", "success");
    } catch (err) {
      console.error("Reset error:", err);
      showToast("Error resetting database", "error");
    } finally {
      setLoading(false);
    }
  };

  const submitJoinRequest = async (data) => {
    try {
      // Check for duplicates in roster
      const exists = members.some(m => m.memberId?.toLowerCase() === data.uid.toLowerCase());
      if (exists) {
        showToast("An account with this UID already exists in the roster.", "error");
        return false;
      }

      // Check for duplicates in pending join requests
      const pendingExists = joinRequests.some(r => r.uid?.toLowerCase() === data.uid.toLowerCase() && r.status === "pending");
      if (pendingExists) {
        showToast("A registration with this UID is already pending approval.", "error");
        return false;
      }

      const req = {
        ...data,
        status: "pending",
        timestamp: new Date().toISOString()
      };
      const docRef = doc(collection(db, "join_requests"));
      await setDoc(docRef, req);
      const newReq = { ...req, id: docRef.id };
      setJoinRequests(prev => [newReq, ...prev]);
      
      // Discord Notification
      sendDiscordEmbed(
        "📝 New Join Request",
        `Isang bagong recruitment application ang natanggap mula kay **${data.ign}**!`,
        0xF0C040, // Gold
        [
          { name: "IGN", value: data.ign, inline: true },
          { name: "Class", value: data.jobClass, inline: true },
          { name: "Role", value: data.role, inline: true },
          { name: "UID", value: data.uid, inline: true },
          { name: "Discord", value: data.discord, inline: true }
        ],
        "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png"
      );

      showToast("Registration submitted for approval!", "success");
      return true;
    } catch(err) {
      console.error(err);
      showToast("Failed to submit registration", "error");
      return false;
    }
  };

  const approveJoinRequest = async (requestId) => {
    try {
      const r = joinRequests.find(x => x.id === requestId);
      if (!r) return;

      const newMember = {
        memberId: r.uid,
        ign: r.ign,
        class: r.jobClass,
        role: r.role,
        discord: r.discord,
        guildRank: "Member",
        joinDate: new Date().toISOString().split('T')[0]
      };

      // 1. Add to roster
      await setDoc(doc(db, "roster", r.uid), newMember);
      
      // 2. Update join request status
      await setDoc(doc(db, "join_requests", requestId), { ...r, status: "approved" });

      setMembers(prev => [...prev, newMember]);
      setJoinRequests(prev => prev.map(x => x.id === requestId ? { ...x, status: "approved" } : x));
      
      // Discord Notification
      sendDiscordEmbed(
        "🎉 New Member Joined!",
        `Maligayang pagdating kay **${r.ign}** sa ating Guild Portal!`,
        0x40C97A, // Green
        [
          { name: "IGN", value: r.ign, inline: true },
          { name: "Job Class", value: r.jobClass, inline: true },
          { name: "Role", value: r.role, inline: true }
        ],
        "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png"
      );

      showToast(`Welcome ${r.ign}! Registered successfully.`, "success");
      return true;
    } catch(err) {
      console.error(err);
      showToast("Failed to approve registration", "error");
      return false;
    }
  };

  const rejectJoinRequest = async (requestId) => {
    try {
      const r = joinRequests.find(x => x.id === requestId);
      if (!r) return;
      await setDoc(doc(db, "join_requests", requestId), { ...r, status: "rejected" });
      setJoinRequests(prev => prev.map(x => x.id === requestId ? { ...x, status: "rejected" } : x));
      showToast(`Registration rejected`, "info");
      return true;
    } catch(err) {
      console.error(err);
      showToast("Failed to reject registration", "error");
      return false;
    }
  };

  const deleteJoinRequest = async (requestId) => {
    try {
      await deleteDoc(doc(db, "join_requests", requestId));
      setJoinRequests(prev => prev.filter(x => x.id !== requestId));
      showToast("Registration record deleted", "success");
      return true;
    } catch(err) {
      console.error(err);
      showToast("Failed to delete record", "error");
      return false;
    }
  };

  const submitRequest = async (memberId, newData) => {

    try {
      const m = members.find(x => x.memberId === memberId);
      if (!m) return;
      const req = {
        memberId,
        requesterIgn: m.ign,
        oldData: { ign: m.ign, class: m.class, role: m.role },
        newData,
        status: "pending",
        timestamp: new Date().toISOString()
      };
      const docRef = doc(collection(db, "requests"));
      await setDoc(docRef, req);
      const newReq = { ...req, id: docRef.id };
      setRequests(prev => [newReq, ...prev]);
      
      // Discord Notification
      sendDiscordEmbed(
        "🛡️ Vanguard Request (Profile Update)",
        `Ang member na si **${m.ign}** ay nag-submit ng profile update request.`,
        0x6382E6, // Blue
        [
          { name: "Requester", value: m.ign, inline: true },
          { name: "Updates", value: Object.entries(newData).map(([k,v]) => `• ${k}: ${v}`).join("\n") }
        ]
      );

      showToast("Request submitted for approval!", "success");
      return true;
    } catch(err) {
      console.error(err);
      showToast("Failed to submit request", "error");
      return false;
    }
  };

  const approveRequest = async (requestId) => {
    try {
      const r = requests.find(x => x.id === requestId);
      if (!r) return;

      const updatedMembers = members.map(m => 
        m.memberId === r.memberId ? { ...m, ...r.newData } : m
      );

      // Update Roster in Firestore
      await setDoc(doc(db, "roster", r.memberId), { 
        ...members.find(x => x.memberId === r.memberId), 
        ...r.newData 
      });
      
      // Update Request Status
      await setDoc(doc(db, "requests", requestId), { ...r, status: "approved" });

      setMembers(updatedMembers);
      setRequests(prev => prev.map(x => x.id === requestId ? { ...x, status: "approved" } : x));
      
      showToast(`Request approved for ${r.requesterIgn}`, "success");
      return true;
    } catch(err) {
      console.error(err);
      showToast("Failed to approve request", "error");
      return false;
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      const r = requests.find(x => x.id === requestId);
      if (!r) return;
      await setDoc(doc(db, "requests", requestId), { ...r, status: "rejected" });
      setRequests(prev => prev.map(x => x.id === requestId ? { ...x, status: "rejected" } : x));
      showToast(`Request rejected`, "info");
      return true;
    } catch(err) {
      console.error(err);
      showToast("Failed to reject request", "error");
      return false;
    }
  };

  const deleteRequest = async (requestId) => {
    try {
      await deleteDoc(doc(db, "requests", requestId));
      setRequests(prev => prev.filter(x => x.id !== requestId));
      showToast("Request deleted from history", "success");
      return true;
    } catch(err) {
      console.error(err);
      showToast("Failed to delete request", "error");
      return false;
    }
  };

  const clearProcessedRequests = async () => {
    try {
      const processed = requests.filter(r => r.status !== "pending");
      const batch = writeBatch(db);
      processed.forEach(r => {
        batch.delete(doc(db, "requests", r.id));
      });
      await batch.commit();
      setRequests(prev => prev.filter(r => r.status === "pending"));
      showToast("Processed history cleared", "success");
      return true;
    } catch(err) {
      console.error(err);
      showToast("Failed to clear history", "error");
      return false;
    }
  };

  const value = {
    loading, authLoading, currentUser, userRole, myMemberId, isAdmin, isOfficer, isMember, isArchitect,
    onlineUsers,
    page, setPage,
    toast, setToast, showToast,
    members, setMembers,
    events, setEvents,
    attendance, setAttendance,
    performance, setPerformance,
    absences, setAbsences,
    parties, setParties,
    partyNames, setPartyNames,
    raidParties, setRaidParties,
    raidPartyNames, setRaidPartyNames,
    eoRatings, setEoRatings,
    auctionSessions, setAuctionSessions,
    auctionTemplates, setAuctionTemplates,
    notifications, sendNotification, markNotifRead,
    requests, submitRequest, approveRequest, rejectRequest, deleteRequest, clearProcessedRequests,
    joinRequests, submitJoinRequest, approveJoinRequest, rejectJoinRequest, deleteJoinRequest,
    discordConfig, setDiscordConfig,
    resetDatabase

  };

  return (
    <GuildContext.Provider value={value}>
      {children}
    </GuildContext.Provider>
  );
};
