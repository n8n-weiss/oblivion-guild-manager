import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
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

  // Refs for tracking changes (to avoid unnecessary writes)
  const prevData = useRef({});

  const showToast = (message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  };

  const isAdmin = userRole === "admin";
  const isOfficer = userRole === "admin" || userRole === "officer";
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

        // Step 2: Fetch everything in parallel
        const [
          rosterSnap,
          eventsSnap,
          attSnap,
          perfSnap,
          eoSnap,
          absSnap,
          metaSnap
        ] = await Promise.all([
          getDocs(collection(db, "roster")),
          getDocs(collection(db, "events")),
          getDocs(collection(db, "attendance")),
          getDocs(collection(db, "performance")),
          getDocs(collection(db, "eoRatings")),
          getDocs(collection(db, "absences")),
          getDoc(doc(db, "metadata", "current"))
        ]);

        const loadedMembers = rosterSnap.docs.map(d => d.data());
        const loadedEvents = eventsSnap.docs.map(d => d.data()).sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));

        // Reconstruct flat attendance array from grouped docs
        const flatAttendance = [];
        attSnap.docs.forEach(d => {
          const { eventId, members: attMembers } = d.data();
          Object.entries(attMembers || {}).forEach(([memberId, status]) => {
            flatAttendance.push({ eventId, memberId, status });
          });
        });

        // Reconstruct flat performance array
        const flatPerformance = [];
        perfSnap.docs.forEach(d => {
          const { eventId, members: perfMembers } = d.data();
          Object.entries(perfMembers || {}).forEach(([memberId, metrics]) => {
            flatPerformance.push({ ...metrics, eventId, memberId });
          });
        });

        // Reconstruct flat eoRatings
        const flatEoRatings = [];
        eoSnap.docs.forEach(d => {
          const { eventId, ratings: rates } = d.data();
          Object.entries(rates || {}).forEach(([memberId, rating]) => {
            flatEoRatings.push({ eventId, memberId, rating });
          });
        });

        const loadedAbsences = absSnap.docs.map(d => d.data());
        const isNew = !metaSnap.exists();
        const metadata = metaSnap.exists() ? metaSnap.data() : {};

        setMembers(loadedMembers.length ? loadedMembers : (isNew ? initialData.INITIAL_MEMBERS || [] : []));
        setEvents(loadedEvents.length ? loadedEvents : (isNew ? initialData.INITIAL_EVENTS || [] : []));
        setAttendance(flatAttendance.length ? flatAttendance : (isNew ? initialData.INITIAL_ATTENDANCE || [] : []));
        setPerformance(flatPerformance.length ? flatPerformance : (isNew ? initialData.INITIAL_PERFORMANCE || [] : []));
        setAbsences(loadedAbsences);
        
        const localPartiesStr = localStorage.getItem('guild_parties');
        let localPartiesJson = null;
        try { localPartiesJson = localPartiesStr ? JSON.parse(localPartiesStr) : null; } catch(e){}
        
        const localNamesStr = localStorage.getItem('guild_partyNames');
        let localNamesJson = null;
        try { localNamesJson = localNamesStr ? JSON.parse(localNamesStr) : null; } catch(e){}

        const firestoreTs = metadata.lastUpdate ? new Date(metadata.lastUpdate).getTime() : 0;
        const localPartiesTs = (localPartiesJson && typeof localPartiesJson === 'object' && !Array.isArray(localPartiesJson)) ? localPartiesJson.ts || 0 : 0;
        const localNamesTs = (localNamesJson && typeof localNamesJson === 'object' && !Array.isArray(localNamesJson)) ? localNamesJson.ts || 0 : 0;

        const cloudPartiesRaw = metadata.parties || [];
        const cloudParties = cloudPartiesRaw.map(p => Array.isArray(p) ? p : (p.members || []));
        const localPartiesRaw = localPartiesJson?.data || (Array.isArray(localPartiesJson) ? localPartiesJson : []);
        const localParties = localPartiesRaw.map(p => Array.isArray(p) ? p : (p.members || []));
        
        const hasCloud = cloudParties.length > 0;
        const hasLocal = localParties.length > 0;


        // Decide parties
        if (hasCloud && (firestoreTs >= localPartiesTs || !hasLocal)) {
          setParties(cloudParties);
          localStorage.setItem('guild_parties', JSON.stringify({ data: cloudParties, ts: firestoreTs }));
        } else if (hasLocal) {
          setParties(localParties);
        } else {
          setParties([]);
        }

        // Decide partyNames
        const cloudNames = metadata.partyNames || [];
        const localNames = localNamesJson?.data || (Array.isArray(localNamesJson) ? localNamesJson : []);
        if (cloudNames.length > 0 && (firestoreTs >= localNamesTs || localNames.length === 0)) {
          setPartyNames(cloudNames);
          localStorage.setItem('guild_partyNames', JSON.stringify({ data: cloudNames, ts: firestoreTs }));
        }
        
        setEoRatings(flatEoRatings);
        setAuctionSessions(metadata.auctionSessions || []);
        setAuctionTemplates(metadata.auctionTemplates || []);

        // Initialize prevData
        const finalParties = (hasCloud && (firestoreTs >= localPartiesTs || !hasLocal)) ? cloudParties : localParties;
        const finalNames = (cloudNames.length > 0 && (firestoreTs >= localNamesTs || localNames.length === 0)) ? cloudNames : localNames;

        prevData.current = {
          members: loadedMembers.length ? loadedMembers : (isNew ? initialData.INITIAL_MEMBERS || [] : []),
          events: loadedEvents.length ? loadedEvents : (isNew ? initialData.INITIAL_EVENTS || [] : []),
          attendance: flatAttendance.length ? flatAttendance : (isNew ? initialData.INITIAL_ATTENDANCE || [] : []),
          performance: flatPerformance.length ? flatPerformance : (isNew ? initialData.INITIAL_PERFORMANCE || [] : []),
          absences: loadedAbsences,
          parties: finalParties,
          partyNames: finalNames,
          eoRatings: flatEoRatings,
          auctionSessions: metadata.auctionSessions || [],
          auctionTemplates: metadata.auctionTemplates || []
        };


      } catch (err) {
        console.error("Firebase load error:", err);
      } finally {
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
          members.forEach(m => batch.set(doc(db, "roster", m.memberId), m));
          // Note: Full sync for now, we could optimize further by tracking individual changes
          prevData.current.members = [...members];
          changesCount++;
        }

        // 2. Save Events
        if (JSON.stringify(events) !== JSON.stringify(prevData.current.events)) {
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

        // 6. Save metadata
        if (
          JSON.stringify(parties) !== JSON.stringify(prevData.current.parties) ||
          JSON.stringify(partyNames) !== JSON.stringify(prevData.current.partyNames) ||
          JSON.stringify(auctionSessions) !== JSON.stringify(prevData.current.auctionSessions) ||
          JSON.stringify(auctionTemplates) !== JSON.stringify(prevData.current.auctionTemplates)
        ) {
          // Wrap nested arrays for Firestore
          const wrappedParties = parties.map(p => ({ members: p }));
          batch.set(doc(db, "metadata", "current"), {
            parties: wrappedParties, partyNames, auctionSessions, auctionTemplates, lastUpdate: new Date().toISOString()
          });
          prevData.current.parties = [...parties];
          prevData.current.partyNames = [...partyNames];
          prevData.current.auctionSessions = [...auctionSessions];
          prevData.current.auctionTemplates = [...auctionTemplates];
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

    const timeout = setTimeout(saveData, 1000); // Reduced from 2000 to 1000 for faster sync
    return () => clearTimeout(timeout);
  }, [members, events, attendance, performance, absences, parties, eoRatings, auctionSessions, auctionTemplates, loading]);

  // Immediate localStorage backup with timestamp
  useEffect(() => {
    if (loading) return;
    localStorage.setItem('guild_parties', JSON.stringify({ data: parties, ts: Date.now() }));
  }, [parties, loading]);

  useEffect(() => {
    if (loading) return;
    localStorage.setItem('guild_partyNames', JSON.stringify({ data: partyNames, ts: Date.now() }));
  }, [partyNames, loading]);

  const resetDatabase = async () => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Get all docs in all collections
      const collections = ["roster", "events", "attendance", "performance", "eoRatings", "absences"];
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

  const value = {
    loading, authLoading, currentUser, userRole, myMemberId, isAdmin, isOfficer, isMember,
    page, setPage,
    toast, setToast, showToast,
    members, setMembers,
    events, setEvents,
    attendance, setAttendance,
    performance, setPerformance,
    absences, setAbsences,
    parties, setParties,
    partyNames, setPartyNames,
    eoRatings, setEoRatings,
    auctionSessions, setAuctionSessions,
    auctionTemplates, setAuctionTemplates,
    resetDatabase
  };

  return (
    <GuildContext.Provider value={value}>
      {children}
    </GuildContext.Provider>
  );
};
