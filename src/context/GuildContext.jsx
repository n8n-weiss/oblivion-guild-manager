import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, writeBatch, onSnapshot, serverTimestamp, Timestamp, runTransaction } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { runMigration } from '../utils/migration';

const migrateMentions = (cat, defaultType = "none") => {
  if (!cat) return { enabled: true, webhookUrl: "", mentions: { [defaultType]: true } };
  if (cat.mentions) return cat; // Already migrated
  
  const m = cat.mention || defaultType;
  const mentions = {};
  if (m === "master") mentions.master = true;
  else if (m === "officer") mentions.officer = true;
  else if (m === "both") { mentions.master = true; mentions.officer = true; }
  else if (m === "member") mentions.member = true;
  
  return { 
    enabled: cat.enabled !== undefined ? cat.enabled : true, 
    webhookUrl: cat.webhookUrl || "", 
    mentions 
  };
};

const GuildContext = createContext();
// eslint-disable-next-line react-refresh/only-export-components
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
  const [discordConfig, setDiscordConfig] = useState({ 
    webhookUrl: "", 
    masterRoleId: "", 
    officerRoleId: "",
    oblivionRoleId: "",
    notifications: {
      join_requests: { enabled: true, webhookUrl: "", mentions: { master: true, officer: true, oblivion: false, member: false } },
      welcome: { enabled: true, webhookUrl: "", mentions: { member: true } },
      vanguard: { enabled: true, webhookUrl: "", mentions: { officer: true } },
      events: { enabled: true, webhookUrl: "", mentions: {} },
      absences: { enabled: true, webhookUrl: "", mentions: { officer: true, member: true } },
      auction_results: { enabled: true, webhookUrl: "", mentions: {} }
    },
    templates: {
      new_join: { title: "📝 New Join Request", description: "A new application from **{ign}**!" },
      welcome: { title: "🎉 New Member Joined!", description: "Welcome **{ign}** to our Guild Portal!" },
      vanguard: { title: "🛡️ Vanguard Request", description: "Member **{ign}** has submitted a profile update request." },
      event_created: { title: "📅 New Event Scheduled: {type}", description: "A new **{type}** event has been scheduled for **{date}**. Please check your attendance." },
      absence_filed: { title: "🚨 New Absence Filed", description: "Si **{ign}** ay nag-file ng absence para sa upcoming event." },
      absence_removed: { title: "✅ Absence Removed", description: "Ang absence record ni **{ign}** ay kinuha na/binura." },
      auction_results: { 
        title: "🏛️ Auction Table Results", 
        description: "Loot session results for **{name}** have been finalized! 🏛️💎\n\n📖 **Legend:**\n• **P1** = Full Page 1 (Bulk Win)\n• **P1R1** = Page 1, Row 1 (Individual Slot)" 
      }
    }
  });
  const [resourceCategories, setResourceCategories] = useState(["Card Album", "Light & Dark"]);
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

  const showToast = (message, type = "success", action = null) => {
    setToast({ message, type, action, key: Date.now() });
  };

  // Derive rank from members if myMemberId is set
  const cleanMyId = (myMemberId || "").trim().toLowerCase();
  const myProfile = members.find(m => m.memberId?.trim().toLowerCase() === cleanMyId);
  const myRank = myProfile?.guildRank || "Member";
  const isStatusActive = (myProfile?.status || "active") === "active";
  
  const isArchitect = myRank === "System Architect" || myRank === "Creator" || userRole === "architect";
  const hasAdminRank = ["Guild Master", "Vice Guild Master", "Commander"].includes(myRank) || isArchitect;
  const hasOfficerRank = ["Charisma Baby", "Baby Charisma", "Officer"].includes(myRank) || hasAdminRank;

  const isAdmin = (userRole === "admin" || userRole === "architect" || hasAdminRank) && (isStatusActive || isArchitect);
  const isOfficer = (isAdmin || userRole === "officer" || hasOfficerRank) && (isStatusActive || isArchitect);
  const isMember = (userRole === "member") && (isStatusActive || isArchitect);

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
        } catch { setUserRole("member"); setMyMemberId(null); }
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

    return () => clearInterval(heartbeat);
  }, [currentUser]);

  // Data Loading from new Collections
  useEffect(() => {
    // Only setup listeners once per user session
    if (!currentUser && !initialData) return;

    let unsubs = [];
    const setupListeners = async () => {
      try {
        const metaDoc = await getDoc(doc(db, "metadata", "current"));
        if (!metaDoc.exists()) {
          const legacyDoc = await getDoc(doc(db, "guilddata", "main"));
          if (legacyDoc.exists() && !legacyDoc.data().isLegacy) {
            showToast("Migrating data to new schema...", "info");
            await runMigration();
          }
        }

        let rosterLoaded = false;
        let metaLoaded = false;
        const checkReady = () => { if (rosterLoaded && metaLoaded) setLoading(false); };

        const unsubRoster = onSnapshot(collection(db, "roster"), (snap) => {
          const docs = snap.docs.map(d => d.data());
          const uniqueDocs = Array.from(new Map(docs.map(m => [m.memberId, m])).values());
          const finalDocs = uniqueDocs.length ? uniqueDocs : (initialData.INITIAL_MEMBERS || []);
          
          if (JSON.stringify(finalDocs) !== JSON.stringify(prevData.current.members)) {
             setMembers(finalDocs);
             prevData.current.members = [...finalDocs];
          }
          rosterLoaded = true;
          checkReady();
        });
        unsubs.push(unsubRoster);

        const unsubEvents = onSnapshot(collection(db, "events"), (snap) => {
          const docs = snap.docs.map(d => d.data()).sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
          const finalDocs = docs.length ? docs : (initialData.INITIAL_EVENTS || []);
          if (JSON.stringify(finalDocs) !== JSON.stringify(prevData.current.events)) {
            setEvents(finalDocs);
            prevData.current.events = [...finalDocs];
          }
        });
        unsubs.push(unsubEvents);

        const unsubAbsences = onSnapshot(collection(db, "absences"), (snap) => {
          const docs = snap.docs.map(d => d.data());
          if (JSON.stringify(docs) !== JSON.stringify(prevData.current.absences)) {
            setAbsences(docs);
            prevData.current.absences = [...docs];
          }
        });
        unsubs.push(unsubAbsences);

        const unsubMetadata = onSnapshot(doc(db, "metadata", "current"), (snap) => {
          const data = snap.exists() ? snap.data() : {};
          
          // Only update if there is actually a change in the metadata doc
          const currentMetaString = JSON.stringify(data);
          if (currentMetaString === prevData.current.lastMetaRaw) return;
          prevData.current.lastMetaRaw = currentMetaString;
          prevData.current.metaVersion = Number(data.version || 0);

          const cloudPartiesRaw = data.parties || [];
          const cloudParties = cloudPartiesRaw.map(p => Array.isArray(p) ? p : (p.members || []));
          setParties(cloudParties);
          prevData.current.parties = [...cloudParties];

          const cloudRaidRaw = data.raidParties || [];
          const cloudRaid = cloudRaidRaw.map(p => Array.isArray(p) ? p : (p.members || []));
          setRaidParties(cloudRaid);
          prevData.current.raidParties = [...cloudRaid];

          setAuctionSessions(data.auctionSessions || []);
          setAuctionTemplates(data.auctionTemplates || []);
          
          const discRaw = data.discord || {};
          const disc = {
            webhookUrl: discRaw.webhookUrl || "",
            masterRoleId: discRaw.masterRoleId || "",
            officerRoleId: discRaw.officerRoleId || "",
            oblivionRoleId: discRaw.oblivionRoleId || "",
            notifications: {
              join_requests: { enabled: true, webhookUrl: "", mentions: { master: true, officer: true }, ...migrateMentions(discRaw.notifications?.join_requests || discRaw.notifications?.recruitment, "both") },
              welcome: { enabled: true, webhookUrl: "", mentions: { member: true }, ...migrateMentions(discRaw.notifications?.welcome || discRaw.notifications?.recruitment, "member") },
              vanguard: { enabled: true, webhookUrl: "", mentions: { officer: true }, ...migrateMentions(discRaw.notifications?.vanguard, "officer") },
              events: { enabled: true, webhookUrl: "", mentions: {}, ...migrateMentions(discRaw.notifications?.events, "none") },
              absences: { enabled: true, webhookUrl: "", mentions: { officer: true, member: true }, ...migrateMentions(discRaw.notifications?.absences, "member") },
              auction_results: { enabled: true, webhookUrl: "", mentions: {}, ...migrateMentions(discRaw.notifications?.auction_results, "none") }
            },
            templates: {
              new_join: { title: "📝 New Join Request", description: "A new application from **{ign}**!", ...(discRaw.templates?.new_join || {}) },
              welcome: { title: "🎉 New Member Joined!", description: "Welcome **{ign}** to our Guild Portal!", ...(discRaw.templates?.welcome || {}) },
              vanguard: { title: "🛡️ Vanguard Request", description: "Member **{ign}** has submitted a profile update request.", ...(discRaw.templates?.vanguard || {}) },
              event_created: { title: "📅 New Event Scheduled: {type}", description: "A new **{type}** event has been scheduled for **{date}**. Please check your attendance.", ...(discRaw.templates?.event_created || {}) },
              absence_filed: { title: "🚨 New Absence Filed", description: "Si **{ign}** ay nag-file ng absence.", ...(discRaw.templates?.absence_filed || {}) },
              absence_removed: { title: "✅ Absence Removed", description: "Ang absence record ni **{ign}** ay binura.", ...(discRaw.templates?.absence_removed || {}) },
              auction_results: { 
                title: "🏛️ Auction Table Results", 
                description: "Loot session results for **{name}** have been finalized! 🏛️💎\n\n📖 **Legend:**\n• **P1** = Full Page 1 (Bulk Win)\n• **P1R1** = Page 1, Row 1 (Individual Slot)",
                ...(discRaw.templates?.auction_results || {})
              }
            }
          };

          // Synchronize discordConfig carefully
          if (JSON.stringify(disc) !== JSON.stringify(prevData.current.discordConfig)) {
            setDiscordConfig(disc);
            prevData.current.discordConfig = { ...disc };
          }

          prevData.current.auctionSessions = [...(data.auctionSessions || [])];
          prevData.current.auctionTemplates = [...(data.auctionTemplates || [])];
          if (data.resourceCategories) {
            setResourceCategories(data.resourceCategories);
            prevData.current.resourceCategories = [...data.resourceCategories];
          }
          if (data.partyNames) {
            setPartyNames(data.partyNames);
            prevData.current.partyNames = [...data.partyNames];
          }
          if (data.raidPartyNames) setRaidPartyNames(data.raidPartyNames);
          metaLoaded = true;
          checkReady();
        });
        unsubs.push(unsubMetadata);

        const unsubNotifs = onSnapshot(collection(db, "notifications"), (snap) => {
          const docs = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a,b) => new Date(b.ts) - new Date(a.ts));
          setNotifications(docs);
        });
        unsubs.push(unsubNotifs);

        const unsubReqs = onSnapshot(collection(db, "requests"), (snap) => {
          const docs = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
          setRequests(docs);
        });
        unsubs.push(unsubReqs);

        const unsubJoinReqs = onSnapshot(collection(db, "join_requests"), (snap) => {
          const docs = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
          setJoinRequests(docs);
        });
        unsubs.push(unsubJoinReqs);

        const unsubAtt = onSnapshot(collection(db, "attendance"), (snap) => {
          const flat = [];
          snap.docs.forEach(d => {
            const { eventId, members: attMembers } = d.data();
            Object.entries(attMembers || {}).forEach(([memberId, status]) => {
              flat.push({ eventId, memberId, status });
            });
          });
          if (JSON.stringify(flat) !== JSON.stringify(prevData.current.attendance)) {
            setAttendance(flat);
            prevData.current.attendance = [...flat];
          }
        });
        unsubs.push(unsubAtt);

        const unsubPerf = onSnapshot(collection(db, "performance"), (snap) => {
          const flat = [];
          snap.docs.forEach(d => {
            const { eventId, members: perfMembers } = d.data();
            Object.entries(perfMembers || {}).forEach(([memberId, pData]) => {
              flat.push({ ...pData, eventId, memberId });
            });
          });
          if (JSON.stringify(flat) !== JSON.stringify(prevData.current.performance)) {
            setPerformance(flat);
            prevData.current.performance = [...flat];
          }
        });
        unsubs.push(unsubPerf);

        const unsubEo = onSnapshot(collection(db, "eoRatings"), (snap) => {
          const flat = [];
          snap.docs.forEach(d => {
            const { eventId, ratings: eoRatingsMap } = d.data();
            Object.entries(eoRatingsMap || {}).forEach(([memberId, rating]) => {
              flat.push({ eventId, memberId, rating });
            });
          });
          if (JSON.stringify(flat) !== JSON.stringify(prevData.current.eoRatings)) {
            setEoRatings(flat);
            prevData.current.eoRatings = [...flat];
          }
        });
        unsubs.push(unsubEo);

        const unsubPresence = onSnapshot(collection(db, "presence"), (snap) => {
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          const online = snap.docs
            .map(d => ({ uid: d.id, ...d.data() }))
            .filter(p => {
              if (!p.lastSeen) return false;
              const ms = p.lastSeen?.toMillis ? p.lastSeen.toMillis() : Number(p.lastSeen);
              return ms > fiveMinutesAgo;
            });
          setOnlineUsers(online);
        });
        unsubs.push(unsubPresence);

      } catch (err) {
        console.error("Listener setup error:", err);
        setLoading(false);
      }
    };
    setupListeners();
    return () => { unsubs.forEach(u => u()); };
  }, [initialData, currentUser]);

  useEffect(() => {
    if (loading) return;
    const saveData = async () => {
      try {
        const batch = writeBatch(db);
        let changesCount = 0;
        let metadataPayload = null;
        let shouldSaveMetadata = false;
        if (JSON.stringify(members) !== JSON.stringify(prevData.current.members)) {
          const uniqueMembers = Array.from(new Map(members.map(m => [m.memberId, m])).values());
          const currentMemberIds = new Set(uniqueMembers.map(m => m.memberId));
          const removedMemberIds = prevData.current.members
            .filter(m => !currentMemberIds.has(m.memberId))
            .map(m => m.memberId);
          removedMemberIds.forEach(mid => { if (mid) batch.delete(doc(db, "roster", mid)); });
          uniqueMembers.forEach(m => batch.set(doc(db, "roster", m.memberId), m));
          prevData.current.members = [...uniqueMembers];
          changesCount++;
        }
        if (JSON.stringify(events) !== JSON.stringify(prevData.current.events)) {
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
          JSON.stringify(discordConfig) !== JSON.stringify(prevData.current.discordConfig) ||
          JSON.stringify(resourceCategories) !== JSON.stringify(prevData.current.resourceCategories)
        ) {
          const wrappedParties = parties.map(p => ({ members: p }));
          const wrappedRaids = raidParties.map(p => ({ members: p }));
          metadataPayload = {
            parties: wrappedParties, partyNames,
            raidParties: wrappedRaids, raidPartyNames,
            auctionSessions, auctionTemplates,
            discord: discordConfig,
            resourceCategories,
            lastUpdate: new Date().toISOString(),
            lastEditorUid: currentUser?.uid || null
          };
          shouldSaveMetadata = true;
        }
        if (JSON.stringify(absences) !== JSON.stringify(prevData.current.absences)) {
          const currentIds = new Set(absences.map(a => a.id));
          const removedIds = prevData.current.absences.filter(a => !currentIds.has(a.id)).map(a => a.id);
          removedIds.forEach(rid => { if (rid) batch.delete(doc(db, "absences", rid)); });
          absences.forEach(a => { if (a.id) batch.set(doc(db, "absences", a.id), a); });
          prevData.current.absences = [...absences];
          changesCount++;
        }
        if (changesCount > 0) {
          await batch.commit();
        }
        if (shouldSaveMetadata && metadataPayload) {
          const metadataRef = doc(db, "metadata", "current");
          const baseVersion = Number(prevData.current.metaVersion || 0);
          try {
            const nextVersion = await runTransaction(db, async (tx) => {
              const snap = await tx.get(metadataRef);
              const remote = snap.exists() ? snap.data() : {};
              const remoteVersion = Number(remote.version || 0);
              if (remoteVersion !== baseVersion) {
                throw new Error("META_VERSION_CONFLICT");
              }
              const updatedVersion = remoteVersion + 1;
              tx.set(metadataRef, { ...metadataPayload, version: updatedVersion }, { merge: true });
              return updatedVersion;
            });

            // Only mark local as synced when transaction succeeds.
            prevData.current.parties = [...parties];
            prevData.current.partyNames = [...partyNames];
            prevData.current.auctionSessions = [...auctionSessions];
            prevData.current.auctionTemplates = [...auctionTemplates];
            prevData.current.raidParties = [...raidParties];
            prevData.current.raidPartyNames = [...raidPartyNames];
            prevData.current.discordConfig = { ...discordConfig };
            prevData.current.resourceCategories = [...resourceCategories];
            prevData.current.metaVersion = nextVersion;
            changesCount++;
          } catch (metaErr) {
            if (metaErr?.message === "META_VERSION_CONFLICT") {
              showToast("Another officer saved changes first. Reloaded latest metadata to avoid overwrite.", "warning");
            } else {
              throw metaErr;
            }
          }
        }
      } catch (err) { console.error("Firebase save error:", err); }
    };
    const timeout = setTimeout(saveData, 1000);
    return () => clearTimeout(timeout);
  }, [members, events, attendance, performance, absences, parties, partyNames, eoRatings, auctionSessions, auctionTemplates, raidParties, raidPartyNames, discordConfig, resourceCategories, currentUser?.uid, loading]);

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
      targetId,
      title,
      message,
      type,
      ts: new Date().toISOString(),
      readBy: []
    };
    await setDoc(doc(collection(db, "notifications")), notif);
    showToast("Notification sent", "success");
  };

   const sendDiscordEmbed = async (title, description, color = 0x6382e6, fields = [], thumbnail = null, category = null, templateKey = null, placeholders = {}, memberMentionId = null) => {
     const catConfig = category ? discordConfig.notifications?.[category] : null;

     if (catConfig && !catConfig.enabled) {
       if (isAdmin) showToast(`Discord: Notification category '${category}' is disabled.`, "info");
       return;
     }

     const targetUrl = (catConfig?.webhookUrl && catConfig.webhookUrl.trim() !== "") 
       ? catConfig.webhookUrl 
       : discordConfig.webhookUrl;

     if (!targetUrl || targetUrl.trim() === "") {
       if (isAdmin) showToast(`Discord: No Webhook URL set for '${category || "global"}'.`, "error");
       return;
     }

     let finalTitle = title;
     let finalDesc = description;

     if (templateKey && discordConfig.templates?.[templateKey]) {
       const template = discordConfig.templates[templateKey];
       finalTitle = template.title || title;
       finalDesc = template.description || description;
       
       Object.entries(placeholders).forEach(([key, val]) => {
         const regex = new RegExp(`{${key}}`, 'g');
         finalTitle = finalTitle.replace(regex, val);
         finalDesc = finalDesc.replace(regex, val);
       });
     }

     try {
       const embed = {
         title: finalTitle,
         description: finalDesc,
         color,
         fields,
         timestamp: new Date().toISOString(),
         footer: { text: "Oblivion Guild Portal" }
       };
      if (thumbnail) embed.thumbnail = { url: thumbnail };
      
      let content = "";
      const catMentions = catConfig?.mentions || {};
      
      // Build dynamic content string
      const mentionParts = [];
      if (catMentions.master && discordConfig.masterRoleId) mentionParts.push(`<@&${discordConfig.masterRoleId}>`);
      if (catMentions.officer && discordConfig.officerRoleId) mentionParts.push(`<@&${discordConfig.officerRoleId}>`);
      if (catMentions.oblivion && discordConfig.oblivionRoleId) mentionParts.push(`<@&${discordConfig.oblivionRoleId}>`);
      if (catMentions.member && memberMentionId) {
        const cleanId = memberMentionId.replace(/[^0-9]/g, "");
        if (cleanId && cleanId.length >= 15) mentionParts.push(`<@${cleanId}>`);
      }
      content = mentionParts.join(" ");

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, embeds: [embed] })
      });
      if (!response.ok) throw new Error(`Discord Error: ${response.status}`);
      return true;
    } catch (err) {
      console.error("Discord Webhook Network Error:", err);
      throw err;
    }
  };

  const sendDiscordImage = async (blob, fileName, caption, category = "auction_results", placeholders = {}) => {
    const catConfig = discordConfig.notifications?.[category];
    if (catConfig && !catConfig.enabled) return;

    const targetUrl = (catConfig?.webhookUrl && catConfig.webhookUrl.trim() !== "") 
      ? catConfig.webhookUrl 
      : discordConfig.webhookUrl;

    if (!targetUrl || targetUrl.trim() === "") {
      if (isAdmin) showToast(`Discord: No Webhook URL set for '${category}'.`, "error");
      return;
    }

    let finalDesc = caption;
    if (discordConfig.templates?.[category]) {
      finalDesc = discordConfig.templates[category].description || caption;
      Object.entries(placeholders).forEach(([key, val]) => {
        finalDesc = finalDesc.replace(new RegExp(`{${key}}`, 'g'), val);
      });
    }

    try {
      // Build dynamic content string (mentions)
      let content = "";
      const catMentions = catConfig?.mentions || {};
      const mentionParts = [];
      if (catMentions.master && discordConfig.masterRoleId) mentionParts.push(`<@&${discordConfig.masterRoleId}>`);
      if (catMentions.officer && discordConfig.officerRoleId) mentionParts.push(`<@&${discordConfig.officerRoleId}>`);
      if (catMentions.oblivion && discordConfig.oblivionRoleId) mentionParts.push(`<@&${discordConfig.oblivionRoleId}>`);
      content = mentionParts.join(" ");

      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('payload_json', JSON.stringify({
        content,
        embeds: [{
          title: discordConfig.templates?.[category]?.title || "Results Attachment",
          description: finalDesc,
          color: 0x6382e6,
          timestamp: new Date().toISOString()
        }]
      }));

      const response = await fetch(targetUrl, {
        method: "POST",
        body: formData
      });
      if (!response.ok) throw new Error(`Discord Image Error: ${response.status}`);
      showToast("Successfully posted to Discord!", "success");
      return true;
    } catch (err) {
      console.error("Discord Image Upload Error:", err);
      showToast("Failed to upload image to Discord", "error");
      throw err;
    }
  };

  const markNotifRead = async (id) => {
    try {
      const n = notifications.find(x => x.id === id);
      if (n && n.targetId !== "all") {
        await setDoc(doc(db, "notifications", id), { ...n, isRead: true });
      }
    } catch(err) { console.error(err); }
  };

  const resetDatabase = async () => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const collections = ["roster", "events", "attendance", "performance", "eoRatings", "absences", "requests"];
      for (const collName of collections) {
        const snap = await getDocs(collection(db, collName));
        snap.forEach(d => batch.delete(d.ref));
      }
      batch.set(doc(db, "metadata", "current"), { 
        parties: [], auctionSessions: [], auctionTemplates: [], 
        isInitialized: true, lastReset: new Date().toISOString() 
      });
      await batch.commit();
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
      const exists = members.some(m => m.memberId?.toLowerCase() === data.uid.toLowerCase());
      if (exists) {
        showToast("An account with this UID already exists in the roster.", "error");
        return false;
      }
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
      await setDoc(doc(collection(db, "join_requests")), req);
      sendDiscordEmbed(
        "📝 New Join Request",
        `A new recruitment application has been received from **${data.ign}**!`,
        0xF0C040,
        [
          { name: "IGN", value: data.ign, inline: true },
          { name: "Class", value: data.jobClass, inline: true },
          { name: "Role", value: data.role, inline: true },
          { name: "UID", value: data.uid, inline: true },
          { name: "Discord", value: data.discord, inline: true }
        ],
        "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png",
        "join_requests",
        "new_join",
        { ign: data.ign, class: data.jobClass, role: data.role, uid: data.uid, discord: data.discord }
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
      await setDoc(doc(db, "roster", r.uid), newMember);
      await setDoc(doc(db, "join_requests", requestId), { ...r, status: "approved" });
      sendDiscordEmbed(
        "🎉 New Member Joined!",
        `Welcome **${r.ign}** to our Guild Portal!`,
        0x40C97A,
        [
          { name: "IGN", value: r.ign, inline: true },
          { name: "Job Class", value: r.jobClass, inline: true },
          { name: "Role", value: r.role, inline: true }
        ],
        "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png",
        "welcome",
        "welcome",
        { ign: r.ign, class: r.jobClass, role: r.role },
        r.discord
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
      await setDoc(doc(collection(db, "requests")), req);
      sendDiscordEmbed(
        "🛡️ Vanguard Request (Profile Update)",
        `Member **${m.ign}** has submitted a profile update request.`,
        0x6382E6,
        [
          { name: "Requester", value: m.ign, inline: true },
          { name: "Updates", value: Object.entries(newData).map(([k,v]) => `• ${k}: ${v}`).join("\n") }
        ],
        null,
        "vanguard",
        "vanguard",
        { ign: m.ign, updates: Object.entries(newData).map(([k,v]) => `• ${k}: ${v}`).join("\n") }
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

      // Update Roster in Firestore
      await setDoc(doc(db, "roster", r.memberId), { 
        ...members.find(x => x.memberId === r.memberId), 
        ...r.newData 
      });
      
      // Update Request Status
      await setDoc(doc(db, "requests", requestId), { ...r, status: "approved" });

      // Removed optimistic setMembers/setRequests to allow onSnapshot to handle it
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
      
      // Removed optimistic setRequests to allow onSnapshot to handle it
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
      // Removed optimistic setRequests to allow onSnapshot to handle it
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
    loading, authLoading, currentUser, userRole, myMemberId, isAdmin, isOfficer, isMember, isArchitect, isStatusActive,
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
    discordConfig, setDiscordConfig, sendDiscordEmbed, sendDiscordImage,
    resourceCategories, setResourceCategories,
    resetDatabase

  };

  return (
    <GuildContext.Provider value={value}>
      {children}
    </GuildContext.Provider>
  );
};
