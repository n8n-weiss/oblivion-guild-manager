import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from '../firebase';
import { onAuthStateChanged, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { firebaseConfig } from '../firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, orderBy, limit, Timestamp, onSnapshot, writeBatch, runTransaction, serverTimestamp, deleteField } from 'firebase/firestore';
import { supabase } from '../supabase';
import { resetMonthlyData } from '../services/guildService';


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
  const [auctionSessions, setAuctionSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('guild_auctionSessions');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : (parsed.data || []);
    } catch { return []; }
  });
  const [auctionTemplates, setAuctionTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('guild_auctionTemplates');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : (parsed.data || []);
    } catch { return []; }
  });
  const [notifications, setNotifications] = useState([]);
  const [requests, setRequests] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [isFetchingRequests, setIsFetchingRequests] = useState(false);
  const [auctionWishlist, setAuctionWishlist] = useState([]);
  const [historicalEvents, setHistoricalEvents] = useState([]);
  const [historicalAttendance, setHistoricalAttendance] = useState([]);
  const [historicalPerformance, setHistoricalPerformance] = useState([]);
  const [historicalEoRatings, setHistoricalEoRatings] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [discordConfig, setDiscordConfig] = useState({ 
    webhookUrl: "", 
    masterRoleId: "", 
    officerRoleId: "",
    oblivionRoleId: "",
    eventTimeText: "7:55 PM – 8:20 PM (GMT+7) Server Time\n8:55 PM – 9:20 PM (GMT+8) Manila Time",
    notifications: {
      join_requests: { enabled: true, webhookUrl: "", mentions: { master: true, officer: true, oblivion: false, member: false } },
      welcome: { enabled: true, webhookUrl: "", mentions: { member: true } },
      vanguard: { enabled: true, webhookUrl: "", mentions: { officer: true } },
      events: { enabled: true, webhookUrl: "", mentions: {} },
      event_digest: { enabled: true, webhookUrl: "", mentions: {} },
      battlelog_reminder: { enabled: true, webhookUrl: "", mentions: { officer: true } },
      absences: { enabled: true, webhookUrl: "", mentions: { officer: true, member: true } },
      auction_results: { enabled: true, webhookUrl: "https://discord.com/api/webhooks/1491181339867877406/Af1ODEaSgC0g-NSyjbb5O4F5jPr4FYVEv7nldY4AYN_uF81W2nNb-TEhwJeJkkWcxpWb", mentions: {} }
    },
    templates: {
      new_join: { title: "📝 New Join Request", description: "A new application from **{ign}**!" },
      welcome: { title: "🎉 New Member Joined!", description: "Welcome **{ign}** to our Guild Portal!" },
      vanguard: { title: "🛡️ Vanguard Request", description: "Member **{ign}** has submitted a profile update request." },
      event_created: { title: "📅 New Event Scheduled: {type}", description: "A new **{type}** event has been scheduled for **{date}**. Please check your attendance." },
      event_digest: { title: "📊 Post-Event Digest ({type})", description: "Top 10 DPS, Top 10 Support/Utility, and Top 10 Attendance snapshot for **{date}**." },
      battlelog_reminder: { title: "📘 Battlelog Reminder ({type})", description: "Assigned auditor **{auditor}** — please submit battlelog for **{date}**." },
      absence_filed: { title: "🚨 New Absence Filed", description: "Si **{ign}** ay nag-file ng absence para sa upcoming event." },
      absence_removed: { title: "✅ Absence Removed", description: "Ang absence record ni **{ign}** ay kinuha na/binura." },
      auction_results: { 
        title: "🏛️ Auction Table Results", 
        description: "Loot session results for **{name}** have been finalized! 🏛️💎\n\n📖 **Legend:**\n• **P1** = Full Page 1 (Bulk Win)\n• **P1R1** = Page 1, Row 1 (Individual Slot)" 
      }
    }
  });
  const [resourceCategories, setResourceCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('guild_resourceCategories');
      const defaults = ["Card Album", "Light & Dark"];
      if (!saved) return defaults;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : (parsed.data || defaults);
    } catch { return ["Card Album", "Light & Dark"]; }
  });
  const [onlineUsers, setOnlineUsers] = useState([]); // array of { uid, memberId, displayName, lastSeen }
  const [metadataNotice, setMetadataNotice] = useState(null); // { kind, message, timestamp }
  const [metadataActivity, setMetadataActivity] = useState([]); // recent shared metadata updates
  const [pendingAuctionConflict, setPendingAuctionConflict] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState("synced"); // "saving" | "synced" | "offline" | "error"
  const [syncRetryToken, setSyncRetryToken] = useState(0);
  const [battlelogConfig, setBattlelogConfig] = useState({ weeklyAssignments: {}, rotationPoolMemberIds: [], lastEditorUid: null, lastUpdate: null });
  const needsBattleData = ["dashboard", "members", "events", "leaderboard", "report"].includes(page);
  const needsPresenceData = page === "dashboard" || page === "members";

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

  const [partyOverrides, setPartyOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('guild_partyOverrides');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return parsed.data || {};
    } catch { return {}; }
  });

  const [leagueParties, setLeagueParties] = useState(() => {
    try {
      const saved = localStorage.getItem('guild_leagueParties');
      if (!saved) return { main: Array(8).fill([]), sub: Array(8).fill([]) };
      const parsed = JSON.parse(saved);
      const data = parsed.data || { main: Array(8).fill([]), sub: Array(8).fill([]) };
      // Sanitize
      const sanitize = (arr) => Array.isArray(arr) ? arr.map(p => Array.isArray(p) ? p : (p.members || [])) : Array(8).fill([]);
      return { main: sanitize(data.main), sub: sanitize(data.sub) };
    } catch { return { main: Array(8).fill([]), sub: Array(8).fill([]) }; }
  });

  const [leaguePartyNames, setLeaguePartyNames] = useState(() => {
    try {
      const saved = localStorage.getItem('guild_leaguePartyNames');
      if (!saved) return { main: Array(8).fill(""), sub: Array(8).fill("") };
      const parsed = JSON.parse(saved);
      return parsed.data || { main: Array(8).fill(""), sub: Array(8).fill("") };
    } catch { return { main: Array(8).fill(""), sub: Array(8).fill("") }; }
  });

  // Refs for tracking changes (to avoid unnecessary writes)
  const prevData = useRef({
    members: [],
    events: [],
    attendance: [],
    performance: [],
    absences: [],
    parties: [],
    raidParties: [],
    partyNames: [],
    raidPartyNames: [],
    partyOverrides: {},
    leagueParties: { main: Array(8).fill([]), sub: Array(8).fill([]) },
    leaguePartyNames: { main: Array(8).fill(""), sub: Array(8).fill("") },
    eoRatings: [],
    auctionSessions: [],
    auctionTemplates: [],
    resourceCategories: [],
    discordConfig: {},
    battlelogConfig: {}
  });
  const metadataVersions = useRef({ parties: 0, auction: 0, discord: 0, battlelog: 0 });
  const liveAuctionRef = useRef({ auctionSessions: [], auctionTemplates: [], resourceCategories: [] });
  const saveBurstRef = useRef({ lastAt: 0, count: 0 });

  const showToast = useCallback((message, type = "success", action = null) => {
    setToast({ message, type, action, key: Date.now() });
  }, []);
  const triggerSyncRetry = () => {
    setSyncRetryToken(v => v + 1);
    if (navigator.onLine) setSyncStatus("saving");
    fetchGlobalData(); // Manual refresh trigger
  };
  useEffect(() => {
    liveAuctionRef.current = { auctionSessions, auctionTemplates, resourceCategories };
  }, [auctionSessions, auctionTemplates, resourceCategories]);
  useEffect(() => {
    // Track rapid edit bursts so we can coalesce save writes.
    const now = Date.now();
    const prevAt = Number(saveBurstRef.current.lastAt || 0);
    saveBurstRef.current.count = now - prevAt < 900 ? (saveBurstRef.current.count + 1) : 1;
    saveBurstRef.current.lastAt = now;
  }, [
    parties,
    partyNames,
    raidParties,
    raidPartyNames,
    partyOverrides,
    auctionSessions,
    auctionTemplates,
    resourceCategories,
    discordConfig,
    leagueParties,
    leaguePartyNames
  ]);

  const cleanMyId = (myMemberId || "").trim().toLowerCase();
  const myProfile = members.find(m => m.memberId?.trim().toLowerCase() === cleanMyId);
  const myRank = myProfile?.guildRank || "Member";
  const isStatusActive = (myProfile?.status || "active") === "active";
  
  const isArchitect =
    (currentUser?.email?.includes("weiss")) ||
    myRank === "System Architect" ||
    myRank === "System Architect (Creator)" ||
    myRank === "Creator" ||
    userRole === "architect";
  const hasAdminRank = ["Guild Master", "Vice Guild Master", "Commander"].includes(myRank) || isArchitect || currentUser?.email?.includes("oblidopest") || currentUser?.email?.includes("rcapa");
  const hasOfficerRank = ["Charisma Baby", "Baby Charisma", "Officer"].includes(myRank) || hasAdminRank;

  const isAdmin = (userRole === "admin" || userRole === "architect" || hasAdminRank) && (isStatusActive || isArchitect);
  const isOfficer = (isAdmin || userRole === "officer" || hasOfficerRank) && (isStatusActive || isArchitect);
  const isMember = (userRole === "member" || !userRole) && !isAdmin && !isOfficer && !isArchitect;
  const canSeeRequestData = isOfficer || isAdmin || isArchitect;

  // Auth Listener (Bridge Mode: Firebase Auth -> Supabase Data)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          // Check Supabase for user role
          const { data: roles, error } = await supabase
            .from('user_roles')
            .select('*')
            .eq('uid', user.uid);
          
          const data = roles && roles.length > 0 ? roles[0] : null;

          if (data) {
            setUserRole(data.role);
            setMyMemberId(data.member_id || null);
          } else {
            // No role in Supabase yet? No problem, default to member for now
            setUserRole("member");
            setMyMemberId(null);
          }
        } catch (err) { 
          console.warn("Auth bridge check skipped or failed (Quota/Supabase issue):", err);
          // Ultimate fallback to allow app to load
          setUserRole("member"); 
          setMyMemberId(null);
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setMyMemberId(null);
      }
      setAuthLoading(false);
    });
    const authSafety = setTimeout(() => {
      if (authLoading) setAuthLoading(false);
    }, 4000);

    return () => {
      unsub();
      clearTimeout(authSafety);
    };
  }, [authLoading]);

  // Auto-heal missing or mismatched memberId
  useEffect(() => {
    if (!currentUser || !currentUser.email || members.length === 0) return;
    
    const cleanMyId = (myMemberId || "").trim().toLowerCase();
    const exists = cleanMyId && members.some(m => m.memberId?.trim().toLowerCase() === cleanMyId);
    
    if (!exists) {
      const emailPrefix = currentUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const fallbackProfile = members.find(m => {
        const cleanDiscord = (m.discord || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const cleanIgn = (m.ign || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        
        // Developer fallback: if email contains rcapa or weiss, link to Architect
        if (emailPrefix.includes("rcapa") || emailPrefix.includes("weiss")) {
          if (m.guildRank && (m.guildRank.includes("Architect") || m.guildRank.includes("Creator"))) return true;
        }

        // Guild Master (Dopest) fallback
        if (m.ign === "Dopest" && emailPrefix.includes("oblidopest")) return true;
        
        return (cleanDiscord && cleanDiscord === emailPrefix) || (cleanIgn && cleanIgn === emailPrefix);
      });
      
      if (fallbackProfile && fallbackProfile.memberId && fallbackProfile.memberId !== myMemberId) {
        console.log("Auto-linking memberId:", fallbackProfile.memberId);
        setMyMemberId(fallbackProfile.memberId);
        
        // Persist to Supabase
        supabase.from('user_roles')
          .update({ member_id: fallbackProfile.memberId })
          .eq('uid', currentUser.uid)
          .then(({ error }) => {
            if (error) console.error("Supabase auto-link failed:", error);
          });

        if (!firebaseQuotaHit.current) {
          setDoc(doc(db, "userroles", currentUser.uid), { memberId: fallbackProfile.memberId }, { merge: true }).catch(err => {
            console.error("Auto-link failed:", err);
            if (err.code === 'resource-exhausted' || err.message?.includes('Quota limit exceeded')) {
              firebaseQuotaHit.current = true;
            }
          });
        }
      }
    }
  }, [currentUser, members, myMemberId, userRole]);

  // Presence Listener (Disabled to save Firebase quota)
  useEffect(() => {
    setOnlineUsers([]); // Keep it empty for now
  }, []);

  // Data Loading from Supabase
  useEffect(() => {
    if (!currentUser && !initialData) return;

    const fetchGlobalData = async () => {
      try {
        setSyncStatus("loading");
        
        // --- FIREBASE RESCUE REMOVED (Quota Protection) ---

        console.log("Starting Supabase data fetch...");
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const cutoffDate = ninetyDaysAgo.toISOString().split("T")[0];

        // 1. Fetch all data in parallel
        const [
          { data: rosterData },
          { data: eventsData },
          { data: absenceData },
          { data: metaData }
        ] = await Promise.all([
          supabase.from('roster').select('*'),
          supabase.from('events').select('*').gte('event_date', cutoffDate),
          supabase.from('absences').select('*'),
          supabase.from('metadata').select('*')
        ]);
        console.log("Supabase fetch completed. Data received:", { rosterData, eventsData, absenceData, metaData });

        // 2. Process Roster
        if (rosterData) {
          const mappedMembers = rosterData.map(r => ({ ...r.metadata, memberId: r.member_id }));
          setMembers(mappedMembers);
          prevData.current.members = [...mappedMembers];
        }

        // 3. Process Events & Nested Data
        if (eventsData) {
          const mappedEvents = eventsData.map(e => ({
            eventId: e.event_id,
            eventDate: e.event_date,
            type: e.type,
            eventType: e.type, // Mapping for backward compatibility with UI components
            title: e.title,
            auditor: e.auditor,
            attendanceData: e.attendance_data,
            performanceData: e.performance_data,
            eoRatingsData: e.eo_ratings_data
          }));
          const sorted = mappedEvents.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
          setEvents(sorted);
          prevData.current.events = [...sorted];

          const nestedAtt = [];
          const nestedPerf = [];
          const nestedEo = [];
          mappedEvents.forEach(e => {
            if (e.attendanceData) Object.entries(e.attendanceData).forEach(([mid, status]) => nestedAtt.push({ eventId: e.eventId, memberId: mid, status }));
            if (e.performanceData) Object.entries(e.performanceData).forEach(([mid, pData]) => nestedPerf.push({ ...pData, eventId: e.eventId, memberId: mid }));
            if (e.eoRatingsData) Object.entries(e.eoRatingsData).forEach(([mid, rating]) => nestedEo.push({ eventId: e.eventId, memberId: mid, rating }));
          });
          setAttendance(nestedAtt);
          setPerformance(nestedPerf);
          setEoRatings(nestedEo);
        }

        // 4. Process Absences
        if (absenceData) {
          const mappedAbs = absenceData.map(a => ({
            id: a.id,
            memberId: a.member_id,
            startDate: a.start_date,
            endDate: a.end_date,
            reason: a.reason,
            status: a.status
          }));
          setAbsences(mappedAbs);
          prevData.current.absences = [...mappedAbs];
        }

        // 5. Process Metadata (Settings, Parties, Auction)
        if (metaData) {
          metaData.forEach(m => {
            const d = m.data;
            if (m.key === 'parties') {
              setParties(d.parties || []);
              setPartyNames(d.partyNames || []);
              setRaidParties(d.raidParties || []);
              setRaidPartyNames(d.raidPartyNames || []);
              setPartyOverrides(d.partyOverrides || {});
              setLeagueParties(d.leagueParties || { main: Array(8).fill([]), sub: Array(8).fill([]) });
              setLeaguePartyNames(d.leaguePartyNames || { main: Array(8).fill(""), sub: Array(8).fill("") });
              metadataVersions.current.parties = m.version;
            } else if (m.key === 'auction') {
              setAuctionSessions(d.auctionSessions || []);
              setAuctionTemplates(d.auctionTemplates || []);
              setResourceCategories(d.resourceCategories || ["Card Album", "Light & Dark"]);
              metadataVersions.current.auction = m.version;
            } else if (m.key === 'discord') {
              setDiscordConfig(d.discord || {});
              metadataVersions.current.discord = m.version;
            } else if (m.key === 'battlelog') {
              setBattlelogConfig(d);
              metadataVersions.current.battlelog = m.version;
            }
          });
        }

        setLoading(false);
        setSyncStatus("synced");
      } catch (err) {
        console.error("Supabase load error:", err);
        setSyncStatus("error");
      }
    };

    fetchGlobalData();
  }, [currentUser, initialData, syncRetryToken]);

  // Supabase notification poll interval — 5 minutes is sufficient for a guild.
  // 60s polling was wasting ~720 API requests/user/day.
  const NOTIF_POLL_INTERVAL = 5 * 60 * 1000;

  // Notifications Listener (Migrated to Supabase)
  useEffect(() => {
    if (!currentUser || authLoading || loading) return;
    
    const fetchNotifs = async () => {
      try {
        let q = supabase.from('notifications').select('*').order('ts', { ascending: false }).limit(30);
        if (myMemberId) {
          q = q.or(`target_id.eq.all,target_id.eq.${myMemberId}`);
        }
        const { data, error } = await q;
        if (error) throw error;
        setNotifications(data.map(n => ({ ...n, id: n.id, ts: n.ts, targetId: n.target_id })));
      } catch (err) {
        console.error("Supabase notif fetch error:", err);
      }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, NOTIF_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [currentUser, authLoading, loading, myMemberId]);

  const firebaseQuotaHit = useRef(false);

  const REQUESTS_CACHE_KEY = "requests_cache_v1";
  const REQUESTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  const fetchRequests = useCallback(async (forceRefresh = false) => {
    if (!currentUser || !canSeeRequestData || isFetchingRequests) return;
    
    // Check sessionStorage cache first (skip if force-refreshing)
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(REQUESTS_CACHE_KEY);
        if (cached) {
          const { requests: cachedReqs, joinRequests: cachedJoin, fetchedAt } = JSON.parse(cached);
          if (Date.now() - fetchedAt < REQUESTS_CACHE_TTL) {
            setRequests(cachedReqs || []);
            setJoinRequests(cachedJoin || []);
            return; // Serve from cache — no network call
          }
        }
      } catch { /* ignore bad cache */ }
    }

    setIsFetchingRequests(true);
    try {
      // Supabase fetch — primary source
      const [{ data: reqsData, error: reqsErr }, { data: joinData, error: joinErr }] = await Promise.all([
        supabase.from('requests').select('*').order('timestamp', { ascending: false }).limit(50),
        supabase.from('join_requests').select('*').order('timestamp', { ascending: false }).limit(50)
      ]);

      if (reqsErr) throw reqsErr;
      if (joinErr) throw joinErr;

      let mappedReqs = (reqsData || []).map(r => ({ 
        ...r, 
        memberId: r.member_id,
        oldData: r.old_data,
        newData: r.new_data
      }));
      let mappedJoin = (joinData || []).map(r => ({ 
        ...r, 
        accountEmail: r.email,
        ...(r.metadata || {})
      }));

      // --- Firebase Fallback / One-time Migration ---
      // If Supabase tables are empty, read from Firebase and migrate data over.
      if (mappedReqs.length === 0 && mappedJoin.length === 0 && !firebaseQuotaHit.current) {
        console.log("[Migration] Supabase requests empty — falling back to Firebase to migrate data...");
        try {
          const [reqsSnap, joinSnap] = await Promise.all([
            getDocs(query(collection(db, "requests"), orderBy("timestamp", "desc"), limit(50))),
            getDocs(query(collection(db, "join_requests"), orderBy("timestamp", "desc"), limit(50)))
          ]);
          const firebaseReqs = reqsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
          const firebaseJoin = joinSnap.docs.map(d => ({ ...d.data(), id: d.id }));

          // Migrate to Supabase if there is data in Firebase
          if (firebaseReqs.length > 0) {
            const mapped = firebaseReqs.map(r => ({
              id: r.id || `req_${Math.random().toString(36).substr(2, 9)}`,
              member_id: r.memberId || r.member_id,
              old_data: r.oldData || r.old_data || {},
              new_data: r.newData || r.new_data || {},
              status: r.status || 'pending',
              timestamp: r.timestamp ? (isNaN(new Date(r.timestamp).getTime()) ? Date.now() : new Date(r.timestamp).getTime()) : Date.now()
            }));
            await supabase.from('requests').upsert(mapped);
          }
          if (firebaseJoin.length > 0) {
            const mapped = firebaseJoin.map(r => ({
              id: r.id || `join_${Math.random().toString(36).substr(2, 9)}`,
              ign: r.ign,
              class: r.class,
              email: r.accountEmail || r.email,
              status: r.status || 'pending',
              timestamp: r.timestamp ? (isNaN(new Date(r.timestamp).getTime()) ? Date.now() : new Date(r.timestamp).getTime()) : Date.now(),
              metadata: { 
                activatedAt: r.activatedAt, 
                requestType: r.requestType,
                guild: r.guild 
              }
            }));
            await supabase.from('join_requests').upsert(mapped);
          }

          mappedReqs = firebaseReqs;
          mappedJoin = firebaseJoin;
          if (firebaseReqs.length > 0 || firebaseJoin.length > 0) {
            console.log(`[Migration] Migrated ${firebaseReqs.length} requests + ${firebaseJoin.length} join requests from Firebase → Supabase.`);
          }
        } catch (fbErr) {
          console.warn("[Migration] Firebase fallback failed:", fbErr);
          if (fbErr.code === 'resource-exhausted') firebaseQuotaHit.current = true;
        }
      }

      setRequests(mappedReqs);
      setJoinRequests(mappedJoin);

      // Cache to sessionStorage
      sessionStorage.setItem(REQUESTS_CACHE_KEY, JSON.stringify({
        requests: mappedReqs,
        joinRequests: mappedJoin,
        fetchedAt: Date.now()
      }));
    } catch (err) {
      console.error("Fetch requests error (Supabase):", err);
    } finally {
      setIsFetchingRequests(false);
    }
  }, [currentUser, canSeeRequestData, isFetchingRequests]);



  // fetchRequests is now LAZY — only called when user visits the Requests page.
  // Removing the auto-fetch on load prevents ~100 Firebase reads per admin session.
  useEffect(() => {
    if (!canSeeRequestData) {
      setRequests([]);
      setJoinRequests([]);
    }
    // Do NOT auto-fetch here — RequestsPage calls fetchRequests() on mount instead.
  }, [canSeeRequestData]);

  // Heavy listeners are attached only on pages that need them to reduce Firestore reads on free tier.
  useEffect(() => {
    return () => {};
  }, [currentUser, initialData, needsBattleData, events]);

  // Presence Listener (Disabled to save Firebase quota — second guard)
  // (intentionally empty)

  useEffect(() => {
    const onOffline = () => setSyncStatus("offline");
    const onOnline = () => {
      if (prevData.current.pendingSync) {
        setSyncRetryToken(v => v + 1);
      } else {
        setSyncStatus("synced");
      }
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // Auto-save to Supabase — smart dirty tracking
  useEffect(() => {
    if (!currentUser || authLoading || loading || syncStatus === "offline") return;
    if (members.length === 0 && events.length === 0) return; // Safety: Don't save empty states
    
    const saveToSupabase = async () => {
      setSyncStatus("saving");
      try {
        // --- 1. Roster: only upsert rows that actually changed ---
        // Build index of previous members by memberId for O(1) comparison
        const prevMemberMap = new Map(
          (prevData.current.members || []).map(m => [m.memberId, JSON.stringify(m)])
        );
        const dirtyMembers = members.filter(m =>
          JSON.stringify(m) !== prevMemberMap.get(m.memberId)
        );
        if (dirtyMembers.length > 0) {
          console.log(`[Supabase] Upserting ${dirtyMembers.length}/${members.length} changed members`);
          const { error } = await supabase.from('roster').upsert(
            dirtyMembers.map(m => ({
              member_id: m.memberId,
              ign: m.ign,
              class: m.class,
              guild_rank: m.guildRank,
              status: m.status || 'active',
              level: Number(m.level || 0),
              cp: Number(m.cp || 0),
              metadata: m
            }))
          );
          if (error) throw error;
          prevData.current.members = [...members];
        }

        // --- 2. Metadata (Parties, etc.) — small payload, full compare is fine ---
        const partiesData = { parties, partyNames, raidParties, raidPartyNames, partyOverrides, leagueParties, leaguePartyNames };
        if (JSON.stringify(partiesData) !== JSON.stringify(prevData.current.partiesData)) {
          await supabase.from('metadata').upsert({ key: 'parties', data: partiesData, updated_at: new Date().toISOString() });
          prevData.current.partiesData = { ...partiesData };
        }

        // --- 2a. Auction Metadata ---
        const auctionData = { auctionSessions, auctionTemplates, resourceCategories };
        if (JSON.stringify(auctionData) !== JSON.stringify(prevData.current.auctionData)) {
          await supabase.from('metadata').upsert({ key: 'auction', data: auctionData, updated_at: new Date().toISOString() });
          prevData.current.auctionData = { ...auctionData };
        }

        // --- 2b. Discord Metadata ---
        if (JSON.stringify(discordConfig) !== JSON.stringify(prevData.current.discordData)) {
          await supabase.from('metadata').upsert({ key: 'discord', data: { discord: discordConfig }, updated_at: new Date().toISOString() });
          prevData.current.discordData = { ...discordConfig };
        }

        // --- 3. Events: only upsert events that actually changed ---
        // Pre-map current attendance/perf/eo by eventId for quick lookup
        const attByEvent = {};
        attendance.forEach(a => {
          if (!attByEvent[a.eventId]) attByEvent[a.eventId] = {};
          attByEvent[a.eventId][a.memberId] = a.status;
        });
        const perfByEvent = {};
        performance.forEach(p => {
          if (!perfByEvent[p.eventId]) perfByEvent[p.eventId] = {};
          const { eventId, memberId, ...rest } = p;
          perfByEvent[p.eventId][memberId] = rest;
        });
        const eoByEvent = {};
        eoRatings.forEach(r => {
          if (!eoByEvent[r.eventId]) eoByEvent[r.eventId] = {};
          eoByEvent[r.eventId][r.memberId] = r.rating;
        });

        const mappedEvents = events.map(e => ({
          ...e,
          attendanceData: attByEvent[e.eventId] || {},
          performanceData: perfByEvent[e.eventId] || {},
          eoRatingsData: eoByEvent[e.eventId] || {}
        }));

        const prevEventMap = new Map(
          (prevData.current.events || []).map(e => [e.eventId, JSON.stringify(e)])
        );
        const dirtyEvents = mappedEvents.filter(e =>
          JSON.stringify(e) !== prevEventMap.get(e.eventId)
        );

        if (dirtyEvents.length > 0) {
          console.log(`[Supabase] Upserting ${dirtyEvents.length}/${events.length} changed events`);
          const { error } = await supabase.from('events').upsert(
            dirtyEvents.map(e => ({
              event_id: e.eventId,
              event_date: e.eventDate,
              type: e.eventType || e.type,
              title: e.title || '',
              auditor: e.battlelogAudit?.assignedIgn || e.auditor || '',
              attendance_data: e.attendanceData || {},
              performance_data: e.performanceData || {},
              eo_ratings_data: e.eoRatingsData || {},
              created_at: e.createdAt || new Date().toISOString()
            }))
          );
          if (error) throw error;
          prevData.current.events = [...mappedEvents];
        }

        // --- 4. Absences: only upsert rows that changed ---
        const prevAbsenceMap = new Map(
          (prevData.current.absences || []).map(a => [a.id, JSON.stringify(a)])
        );
        const dirtyAbsences = absences.filter(a =>
          a.id && JSON.stringify(a) !== prevAbsenceMap.get(a.id)
        );
        if (dirtyAbsences.length > 0) {
          console.log(`[Supabase] Upserting ${dirtyAbsences.length}/${absences.length} changed absences`);
          const { error } = await supabase.from('absences').upsert(
            dirtyAbsences.map(a => ({
              id: a.id,
              member_id: a.memberId,
              start_date: a.startDate,
              end_date: a.endDate,
              reason: a.reason,
              status: a.status || 'pending'
            }))
          );
          if (error) throw error;
          prevData.current.absences = [...absences];
        }

        setSyncStatus("synced");
      } catch (err) {
        console.error("Supabase save error:", err);
        setSyncStatus("error");
      }
    };

    // 8 second debounce — batches rapid edits to reduce Supabase write bandwidth.
    const timer = setTimeout(saveToSupabase, 8000);
    return () => clearTimeout(timer);
  }, [members, events, absences, parties, partyNames, raidParties, raidPartyNames, partyOverrides, leagueParties, leaguePartyNames, auctionSessions, auctionTemplates, resourceCategories, discordConfig, attendance, performance, eoRatings]);


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

  useEffect(() => {
    if (loading) return;
    localStorage.setItem('guild_partyOverrides', JSON.stringify({ data: partyOverrides, ts: Date.now() }));
  }, [partyOverrides, loading]);

  useEffect(() => {
    if (loading) return;
    localStorage.setItem('guild_leagueParties', JSON.stringify({ data: leagueParties, ts: Date.now() }));
  }, [leagueParties, loading]);

  useEffect(() => {
    if (loading) return;
    localStorage.setItem('guild_leaguePartyNames', JSON.stringify({ data: leaguePartyNames, ts: Date.now() }));
  }, [leaguePartyNames, loading]);

  const sendNotification = async (targetId, title, message, type = "info") => {
    const notif = {
      target_id: targetId,
      title,
      message,
      type,
      ts: new Date().toISOString(),
      readBy: []
    };
    try {
      const { error } = await supabase.from('notifications').insert([notif]);
      if (error) throw error;
      showToast("Notification sent", "success");
    } catch(err) {
      console.error("Supabase notification error:", err);
      showToast("Failed to send notification", "error");
    }
  };

   const sendDiscordEmbed = async (title, description, color = 0x6382e6, fields = [], thumbnail = null, category = null, templateKey = null, placeholders = {}, memberMentionId = null, overridePing = null) => {
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
      if (overridePing) {
         mentionParts.push(overridePing);
      } else {
         if (catMentions.master && discordConfig.masterRoleId) mentionParts.push(`<@&${discordConfig.masterRoleId}>`);
         if (catMentions.officer && discordConfig.officerRoleId) mentionParts.push(`<@&${discordConfig.officerRoleId}>`);
         if (catMentions.oblivion && discordConfig.oblivionRoleId) mentionParts.push(`<@&${discordConfig.oblivionRoleId}>`);
         if (catMentions.member && memberMentionId) {
           const cleanId = memberMentionId.replace(/[^0-9]/g, "");
           if (cleanId && cleanId.length >= 15) mentionParts.push(`<@${cleanId}>`);
         }
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
      formData.append('files[0]', blob, fileName);
      formData.append('payload_json', JSON.stringify({
        content,
        embeds: [{
          title: discordConfig.templates?.[category]?.title || "Results Attachment",
          description: finalDesc,
          color: 0x6382e6,
          timestamp: new Date().toISOString(),
          image: {
            url: `attachment://${fileName}`
          }
        }],
        attachments: [{
          id: 0,
          filename: fileName
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
    if (firebaseQuotaHit.current) return;
    try {
      const n = notifications.find(x => x.id === id);
      if (n && n.targetId !== "all") {
        await setDoc(doc(db, "notifications", id), { ...n, isRead: true });
      }
    } catch(err) {
      console.error(err);
      if (err.code === 'resource-exhausted' || err.message?.includes('Quota limit exceeded')) {
        firebaseQuotaHit.current = true;
      }
    }
  };

  const resetDatabase = async () => {
    if (firebaseQuotaHit.current) {
      showToast("Firebase quota exceeded. Database reset unavailable.", "error");
      return;
    }
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
      if (err.code === 'resource-exhausted' || err.message?.includes('Quota limit exceeded')) {
        firebaseQuotaHit.current = true;
      }
      showToast("Error resetting database", "error");
    } finally {
      setLoading(false);
    }
  };

  const exportBackupSnapshot = async () => {
    if (!isArchitect) throw new Error("FORBIDDEN");
    const [rosterSnap, eventsSnap, absencesSnap] = await Promise.all([
      getDocs(collection(db, "roster")),
      getDocs(collection(db, "events")),
      getDocs(collection(db, "absences"))
    ]);
    const [metaParties, metaAuction, metaDiscord] = await Promise.all([
      getDoc(doc(db, "metadata", "parties")),
      getDoc(doc(db, "metadata", "auction")),
      getDoc(doc(db, "metadata", "discord"))
    ]);
    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      roster: rosterSnap.docs.map(d => d.data()),
      events: eventsSnap.docs.map(d => d.data()),
      absences: absencesSnap.docs.map(d => d.data()),
      metadata: {
        parties: metaParties.exists() ? metaParties.data() : {},
        auction: metaAuction.exists() ? metaAuction.data() : {},
        discord: metaDiscord.exists() ? metaDiscord.data() : {}
      }
    };
  };

  const resetMonthlyScores = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await resetMonthlyData(monthYear);

      // Clear local state to trigger UI refresh
      setAttendance([]);
      setPerformance([]);
      setEoRatings([]);

      showToast(`Monthly data for ${monthYear} has been archived and reset.`, "success");
    } catch (err) {
      console.error("Reset monthly data error:", err);
      showToast("Failed to reset monthly data", "error");
    } finally {
      setLoading(false);
    }
  };

  
  const bootstrapMyRole = async () => {
    if (!currentUser) return;
    try {
      showToast("Bootstrapping your role in Supabase...", "info");
      const isWeiss = currentUser.email?.includes("weiss");
      const targetRole = isWeiss ? 'architect' : 'admin';
      const { error } = await supabase.from('user_roles').upsert({
        uid: currentUser.uid,
        role: targetRole,
        email: currentUser.email
      });
      if (error) throw error;
      showToast(`You are now an official ${targetRole.toUpperCase()} in Supabase!`, "success");
      setUserRole(targetRole); // Update local state immediately
    } catch (err) {
      console.error("Bootstrap failed:", err);
      showToast("Bootstrap failed: " + err.message, "error");
    }
  };

  const migrateUserRoles = async () => {
    if (!isArchitect) throw new Error("FORBIDDEN");
    try {
      showToast("Fetching roles from Firebase...", "info");
      const rolesSnap = await getDocs(collection(db, "userroles"));
      const roles = rolesSnap.docs.map(d => ({
        uid: d.id,
        ...d.data()
      }));
      
      showToast(`Migrating ${roles.length} roles to Supabase...`, "info");
      const mapped = roles.map(r => ({
        uid: r.uid,
        email: r.email,
        role: r.role || 'member',
        member_id: r.memberId || r.member_id,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('user_roles').upsert(mapped);
      if (error) throw error;
      
      showToast(`Successfully synced ${roles.length} user roles!`, "success");
    } catch (err) {
      console.error("Roles sync failed:", err);
      showToast("Sync failed: " + err.message, "error");
    }
  };

  const migrateLocalStorageToSupabase = async () => {
    try {
      showToast("Syncing local cache to Supabase...", "info");
      
      const partiesData = {
        parties: JSON.parse(localStorage.getItem('guild_parties') || "[]"),
        partyNames: JSON.parse(localStorage.getItem('guild_partyNames') || "[]"),
        raidParties: JSON.parse(localStorage.getItem('guild_raidParties') || "[]"),
        raidPartyNames: JSON.parse(localStorage.getItem('guild_raidPartyNames') || "[]"),
        partyOverrides: JSON.parse(localStorage.getItem('guild_partyOverrides') || "{}"),
        leagueParties: JSON.parse(localStorage.getItem('guild_leagueParties') || "{}"),
        leaguePartyNames: JSON.parse(localStorage.getItem('guild_leaguePartyNames') || "{}")
      };

      // Cleanup nested data if it was wrapped in { data: ... }
      const unwrap = (obj) => obj?.data !== undefined ? obj.data : obj;
      const cleanParties = {
        parties: unwrap(partiesData.parties),
        partyNames: unwrap(partiesData.partyNames),
        raidParties: unwrap(partiesData.raidParties),
        raidPartyNames: unwrap(partiesData.raidPartyNames),
        partyOverrides: unwrap(partiesData.partyOverrides),
        leagueParties: unwrap(partiesData.leagueParties),
        leaguePartyNames: unwrap(partiesData.leaguePartyNames)
      };

      const auctionData = {
        auctionSessions: JSON.parse(localStorage.getItem('guild_auctionSessions') || "[]"),
        auctionTemplates: JSON.parse(localStorage.getItem('guild_auctionTemplates') || "[]"),
        resourceCategories: JSON.parse(localStorage.getItem('guild_resourceCategories') || "[]")
      };

      const discordData = {
        discord: JSON.parse(localStorage.getItem('guild_discordConfig') || "{}")
      };

      const battlelogData = JSON.parse(localStorage.getItem('guild_battlelogConfig') || "{}");

      await Promise.all([
        supabase.from('metadata').upsert({
          key: 'parties',
          data: cleanParties,
          updated_at: new Date().toISOString()
        }),
        supabase.from('metadata').upsert({
          key: 'auction',
          data: unwrap(auctionData),
          updated_at: new Date().toISOString()
        }),
        supabase.from('metadata').upsert({
          key: 'discord',
          data: unwrap(discordData),
          updated_at: new Date().toISOString()
        }),
        supabase.from('metadata').upsert({
          key: 'battlelog',
          data: unwrap(battlelogData),
          updated_at: new Date().toISOString()
        })
      ]);

      showToast("Local cache (Parties & Auction) synced to Supabase!", "success");
      setSyncStatus("synced");
    } catch (err) {
      console.error("Local sync failed:", err);
      showToast("Sync failed: " + err.message, "error");
    }
  };

  const fetchFirebaseMetadataOnly = async () => {
    try {
      showToast("Fetching settings and parties...", "info");
      const { doc, getDoc } = await import("firebase/firestore");
      const { db: fdb } = await import("../firebase");
      
      const keys = ['parties', 'auction', 'discord', 'battlelog'];
      const results = {};
      
      for (const key of keys) {
        const snap = await getDoc(doc(fdb, "metadata", key));
        if (snap.exists()) results[key] = snap.data();
      }

      const payload = {
        ...results,
        isMetadataOnly: true,
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `OBLIVION_METADATA_RECOVERY.json`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Metadata backup downloaded!", "success");
    } catch (err) {
      console.error("Metadata fetch failed:", err);
      showToast("Fetch failed: " + err.message, "error");
    }
  };

  const fetchFirebaseDirect = async () => {
    try {
      showToast("Starting emergency Firebase fetch...", "info");
      const { collection, getDocs, query, limit } = await import("firebase/firestore");
      const { db: fdb } = await import("../firebase");
      
      const mSnap = await getDocs(query(collection(fdb, "members"), limit(2000)));
      const members = mSnap.docs.map(d => ({ ...d.data(), memberId: d.id }));
      
      const eSnap = await getDocs(query(collection(fdb, "events"), limit(1000)));
      const events = eSnap.docs.map(d => ({ ...d.data(), eventId: d.id }));

      const aSnap = await getDocs(query(collection(fdb, "absences"), limit(1000)));
      const absences = aSnap.docs.map(d => ({ ...d.data(), id: d.id }));

      const metaSnap = await getDocs(collection(fdb, "metadata"));
      const firebaseMetadata = {};
      metaSnap.forEach(d => { 
        firebaseMetadata[d.id] = d.data(); 
        console.log(`[Firebase Recovery] Found metadata doc: ${d.id}`, d.data());
      });
      
      const auctionMeta = firebaseMetadata.auction || {};
      const discordMeta = firebaseMetadata.discord || {};
      const partiesMeta = firebaseMetadata.parties || {};
      const battlelogMeta = firebaseMetadata.battlelog || {};

      if (Object.keys(firebaseMetadata).length === 0) {
        console.warn("[Firebase Recovery] No metadata found in 'metadata' collection. Trying direct fetch...");
        // Fallback: Try fetching specifically if getDocs failed
        const keys = ['parties', 'auction', 'discord', 'battlelog', 'auctions', 'discords', 'metadata_guild'];
        for (const key of keys) {
          const snap = await getDoc(doc(fdb, "metadata", key));
          if (snap.exists()) {
            firebaseMetadata[key] = snap.data();
            console.log(`[Firebase Recovery] Direct fetch success for ${key}`, snap.data());
          }
        }
      }

      const payload = {
        members,
        events,
        absences,
        // Sync from Firebase metadata docs if found, otherwise fallback to current state
        parties: partiesMeta.parties || parties,
        partyNames: partiesMeta.partyNames || partyNames,
        raidParties: partiesMeta.raidParties || raidParties,
        raidPartyNames: partiesMeta.raidPartyNames || raidPartyNames,
        partyOverrides: partiesMeta.partyOverrides || partyOverrides,
        leagueParties: partiesMeta.leagueParties || leagueParties,
        leaguePartyNames: partiesMeta.leaguePartyNames || leaguePartyNames,
        auctionSessions: auctionMeta.auctionSessions || auctionSessions,
        auctionTemplates: auctionMeta.auctionTemplates || auctionTemplates,
        resourceCategories: auctionMeta.resourceCategories || resourceCategories,
        discordConfig: discordMeta.discord || discordConfig,
        battlelogConfig: battlelogMeta || battlelogConfig,
        exportedAt: new Date().toISOString(),
        isEmergencyFetch: true
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `OBLIVION_EMERGENCY_RECOVERY_${new Date().toISOString().split('T')[0]}.json`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Emergency backup downloaded!", "success");
    } catch (err) {
      console.error("Emergency fetch failed:", err);
      if (err.code === 'resource-exhausted' || err.message?.includes('Quota limit exceeded')) {
        firebaseQuotaHit.current = true;
      }
      showToast("Fetch failed: " + err.message, "error");
    }
  };

  const migrateNestingToEvents = async () => {
    if (!isArchitect) return;
    if (firebaseQuotaHit.current) {
      showToast("Firebase quota exceeded. Optimization unavailable.", "error");
      return;
    }
    try {
      showToast("Starting optimization... Please wait.", "info");
      const eventsSnap = await getDocs(collection(db, "events"));
      
      // Optimization: Instead of fetching ALL documents from these huge collections,
      // we only fetch if the events actually need them.
      // But for a full migration, we need them once. 
      // We'll fetch them and then suggest the user delete the legacy collections.
      const attSnap = await getDocs(collection(db, "attendance"));
      const perfSnap = await getDocs(collection(db, "performance"));
      const eoSnap = await getDocs(collection(db, "eoRatings"));

      const attMap = new Map(attSnap.docs.map(d => [d.id, d.data().members || {}]));
      const perfMap = new Map(perfSnap.docs.map(d => [d.id, d.data().members || {}]));
      const eoMap = new Map(eoSnap.docs.map(d => [d.id, d.data().ratings || {}]));

      const batch = writeBatch(db);
      let count = 0;

      eventsSnap.docs.forEach(eventDoc => {
        const eid = eventDoc.id;
        const eventData = eventDoc.data();
        
        // Only update if not already optimized or if we have new legacy data to pull
        const hasAtt = attMap.has(eid);
        const hasPerf = perfMap.has(eid);
        const hasEo = eoMap.has(eid);

        if (hasAtt || hasPerf || hasEo) {
          const updatedData = {
            ...eventData,
            attendanceData: { ...(eventData.attendanceData || {}), ...(attMap.get(eid) || {}) },
            performanceData: { ...(eventData.performanceData || {}), ...(perfMap.get(eid) || {}) },
            eoRatingsData: { ...(eventData.eoRatingsData || {}), ...(eoMap.get(eid) || {}) }
          };
          batch.set(doc(db, "events", eid), updatedData);
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        showToast(`Successfully optimized ${count} events!`, "success");
      } else {
        showToast("All events are already optimized.", "info");
      }
    } catch (err) {
      console.error("Migration error:", err);
      if (err.code === 'resource-exhausted' || err.message?.includes('Quota limit exceeded')) {
        firebaseQuotaHit.current = true;
      }
      showToast("Migration failed: " + err.message, "error");
    }
  };
  

  const resolveAuctionConflict = (action) => {
    if (!pendingAuctionConflict) return;
    if (action === "apply_remote") {
      const remote = pendingAuctionConflict.remote || {};
      const remoteSessions = remote.auctionSessions || [];
      const remoteTemplates = remote.auctionTemplates || [];
      const remoteResources = remote.resourceCategories || ["Card Album", "Light & Dark"];
      setAuctionSessions(remoteSessions);
      setAuctionTemplates(remoteTemplates);
      setResourceCategories(remoteResources);
      prevData.current.auctionSessions = [...remoteSessions];
      prevData.current.auctionTemplates = [...remoteTemplates];
      prevData.current.resourceCategories = [...remoteResources];
      showToast("Applied latest remote auction changes.", "info");
    } else {
      showToast("Keeping local auction edits. Save to overwrite remote values.", "warning");
    }
    setPendingAuctionConflict(null);
    setMetadataNotice(null);
  };

  const submitJoinRequest = async (data) => {
    if (firebaseQuotaHit.current) {
      showToast("Firebase quota exceeded. Cannot submit registration.", "error");
      return false;
    }
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
      if (err.code === 'resource-exhausted' || err.message?.includes('Quota limit exceeded')) {
        firebaseQuotaHit.current = true;
      }
      showToast("Failed to submit registration", "error");
      return false;
    }
  };

  const submitReactivationRequest = async (data) => {
    try {
      const uid = (data.uid || "").toUpperCase();
      const normalizedDiscord = (data.discord || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const existing = members.find((m) => {
        const sameUid = (m.memberId || "").toUpperCase() === uid;
        const sameDiscord = (m.discord || "").toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedDiscord;
        return sameUid || sameDiscord;
      });
      if (!existing) {
        showToast("No existing member record found for this UID/Discord.", "error");
        return false;
      }
      const pendingExists = joinRequests.some((r) => {
        const sameUid = (r.uid || "").toUpperCase() === uid;
        const sameDiscord = (r.discord || "").toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedDiscord;
        return (sameUid || sameDiscord) && r.status === "pending" && r.requestType === "reactivation";
      });
      if (pendingExists) {
        showToast("A reactivation request is already pending for this account.", "error");
        return false;
      }
      const req = {
        discord: data.discord,
        ign: data.ign || existing.ign || "Unknown",
        uid,
        jobClass: existing.class || "Unknown",
        role: existing.role || "DPS",
        status: "pending",
        requestType: "reactivation",
        timestamp: new Date().toISOString()
      };
      await setDoc(doc(collection(db, "join_requests")), req);
      sendDiscordEmbed(
        "♻️ Account Reactivation Request",
        `A former member requested account reactivation for **${req.ign}**.`,
        0x6382E6,
        [
          { name: "IGN", value: req.ign, inline: true },
          { name: "UID", value: req.uid, inline: true },
          { name: "Discord", value: req.discord || "N/A", inline: true }
        ],
        "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png",
        "join_requests",
        "new_join",
        { ign: req.ign, class: req.jobClass, role: req.role, uid: req.uid, discord: req.discord || "N/A" }
      );
      showToast("Reactivation request submitted. Please wait for officer approval.", "success");
      return true;
    } catch (err) {
      console.error(err);
      showToast("Failed to submit reactivation request", "error");
      return false;
    }
  };

  const approveJoinRequest = async (requestId) => {
    if (firebaseQuotaHit.current) {
      showToast("Firebase quota exceeded. Cannot approve registration.", "error");
      return false;
    }
    try {
      const r = joinRequests.find(x => x.id === requestId);
      if (!r) return;
      const cleanDiscord = (r.discord || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const portalEmail = cleanDiscord ? `${cleanDiscord}@oblivion.com` : "";
      const password = (r.uid || "").toUpperCase().startsWith("OBL") ? r.uid.toUpperCase() : `OBL${r.uid.toUpperCase()}`;

      // Automatic Account Creation
      let secondaryApp = null;
      try {
        const appName = `approval-${Date.now()}`;
        secondaryApp = initializeApp(firebaseConfig, appName);
        const secondaryAuth = getAuth(secondaryApp);
        const cred = await createUserWithEmailAndPassword(secondaryAuth, portalEmail, password);
        
        // Create userroles document linked to this auth user
        await setDoc(doc(db, "userroles", cred.user.uid), {
          role: "member",
          memberId: r.uid,
          email: portalEmail,
          displayName: r.ign,
          createdAt: new Date().toISOString()
        });
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          console.log("Account already exists for this email, skipping auth creation.");
        } else {
          console.error("Failed to create auth account during approval:", authErr);
        }
      } finally {
        if (secondaryApp) await deleteApp(secondaryApp);
      }

      const existingMember = members.find(m => (m.memberId || "").toLowerCase() === (r.uid || "").toLowerCase());
      const newMember = {
        ...(existingMember || {}),
        memberId: r.uid,
        ign: r.ign,
        class: r.jobClass,
        role: r.role,
        discord: r.discord,
        guildRank: existingMember?.guildRank || "Member",
        joinDate: existingMember?.joinDate || new Date().toISOString().split('T')[0],
        status: "active",
        reactivatedAt: existingMember ? new Date().toISOString() : (existingMember?.reactivatedAt || null)
      };
      await setDoc(doc(db, "roster", r.uid), newMember);
      await setDoc(doc(db, "join_requests", requestId), {
        ...r,
        status: "approved",
        accountStatus: "activated",
        activatedAt: new Date().toISOString(),
        accountEmail: portalEmail
      });
      if (r.requestType !== "reactivation") {
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
      }
      showToast(`Welcome ${r.ign}! Registered successfully.`, "success");
      return true;
    } catch(err) {
      console.error(err);
      if (err.code === 'resource-exhausted' || err.message?.includes('Quota limit exceeded')) {
        firebaseQuotaHit.current = true;
      }
      showToast("Failed to approve registration", "error");
      return false;
    }
  };

  const rejectJoinRequest = async (requestId) => {
    try {
      const { error } = await supabase
        .from('join_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);
      if (error) throw error;
      setJoinRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'rejected' } : r));
      sessionStorage.removeItem("requests_cache_v1");
      showToast('Registration rejected', 'info');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to reject registration', 'error');
      return false;
    }
  };

  const deleteJoinRequest = async (requestId) => {
    try {
      const { error } = await supabase
        .from('join_requests')
        .delete()
        .eq('id', requestId);
      if (error) throw error;
      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
      sessionStorage.removeItem("requests_cache_v1");
      showToast('Registration record deleted', 'success');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to delete record', 'error');
      return false;
    }
  };

  const submitRequest = async (memberId, newData) => {
    if (firebaseQuotaHit.current) {
      showToast("Firebase quota exceeded. Cannot submit request.", "error");
      return false;
    }
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
      if (err.code === 'resource-exhausted' || err.message?.includes('Quota limit exceeded')) {
        firebaseQuotaHit.current = true;
      }
      showToast("Failed to submit request", "error");
      return false;
    }
  };

  const approveRequest = async (requestId) => {
    try {
      const r = requests.find(x => x.id === requestId);
      if (!r) return false;

      // Update Roster in Supabase
      const existingMember = members.find(x => x.memberId === r.memberId);
      const updatedMember = { ...(existingMember || {}), ...r.newData };
      const { error: rosterErr } = await supabase.from('roster').upsert({
        member_id: r.memberId,
        ign: updatedMember.ign || existingMember?.ign,
        class: updatedMember.class || existingMember?.class,
        guild_rank: updatedMember.guildRank || existingMember?.guildRank,
        status: updatedMember.status || 'active',
        level: Number(updatedMember.level || 0),
        cp: Number(updatedMember.cp || 0),
        metadata: updatedMember
      });
      if (rosterErr) throw rosterErr;

      // Update member in local state
      setMembers(prev => prev.map(m => m.memberId === r.memberId ? { ...m, ...r.newData } : m));

      // Update request status in Supabase
      const { error: reqErr } = await supabase
        .from('requests')
        .update({ status: 'approved' })
        .eq('id', requestId);
      if (reqErr) throw reqErr;

      setRequests(prev => prev.map(x => x.id === requestId ? { ...x, status: 'approved' } : x));
      sessionStorage.removeItem("requests_cache_v1");
      showToast(`Request approved for ${r.requesterIgn}`, 'success');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to approve request', 'error');
      return false;
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);
      if (error) throw error;
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'rejected' } : r));
      sessionStorage.removeItem("requests_cache_v1");
      showToast('Request rejected', 'info');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to reject request', 'error');
      return false;
    }
  };

  const deleteRequest = async (requestId) => {
    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', requestId);
      if (error) throw error;
      setRequests(prev => prev.filter(r => r.id !== requestId));
      sessionStorage.removeItem("requests_cache_v1");
      showToast('Request deleted from history', 'success');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to delete request', 'error');
      return false;
    }
  };

  const clearProcessedRequests = async () => {
    try {
      const processedIds = requests.filter(r => r.status !== 'pending').map(r => r.id);
      if (processedIds.length === 0) return true;
      const { error } = await supabase
        .from('requests')
        .delete()
        .in('id', processedIds);
      if (error) throw error;
      setRequests(prev => prev.filter(r => r.status === 'pending'));
      sessionStorage.removeItem("requests_cache_v1");
      showToast('Processed history cleared', 'success');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to clear history', 'error');
      return false;
    }
  };

  const migrateMemberData = async (oldId, newId) => {
    if (!oldId || !newId) return { success: false, message: "Invalid IDs provided." };
    if (firebaseQuotaHit.current) return { success: false, message: "Firebase quota exceeded. Cannot migrate data." };
    const batch = writeBatch(db);
    let count = 0;
    
    // Scan all event documents
    try {
      const evSnap = await getDocs(collection(db, "events"));
      evSnap.forEach(d => {
        const e = d.data();
        let changed = false;
        const update = {};
        
        if (e.attendanceData && e.attendanceData[oldId]) {
          update[`attendanceData.${newId}`] = e.attendanceData[oldId];
          update[`attendanceData.${oldId}`] = deleteField();
          changed = true;
        }
        if (e.performanceData && e.performanceData[oldId]) {
          update[`performanceData.${newId}`] = e.performanceData[oldId];
          update[`performanceData.${oldId}`] = deleteField();
          changed = true;
        }
        if (e.eoRatingsData && e.eoRatingsData[oldId]) {
          update[`eoRatingsData.${newId}`] = e.eoRatingsData[oldId];
          update[`eoRatingsData.${oldId}`] = deleteField();
          changed = true;
        }
        
        if (changed) {
          batch.update(d.ref, update);
          count++;
        }
      });

      // Update individual account mappings (userroles)
      const urSnap = await getDocs(collection(db, "userroles"));
      urSnap.forEach(d => {
        const data = d.data();
        if ((data.memberId || "").trim().toLowerCase() === oldId.trim().toLowerCase()) {
          batch.update(d.ref, { memberId: newId });
          count++;
        }
      });

      // Update centralized user registry (guildusers/list)
      const listRef = doc(db, "guildusers", "list");
      const listSnap = await getDoc(listRef);
      if (listSnap.exists()) {
        const usersArr = listSnap.data().users || [];
        let listChanged = false;
        const updatedUsers = usersArr.map(u => {
          if ((u.memberId || "").trim().toLowerCase() === oldId.trim().toLowerCase()) {
            count++;
            listChanged = true;
            return { ...u, memberId: newId };
          }
          return u;
        });
        if (listChanged) {
          batch.update(listRef, { users: updatedUsers });
        }
      }
      
      if (count > 0) {
        await batch.commit();
        showToast(`Migrated ${count} records!`, "success");
        return { success: true, message: `Successfully migrated ${count} records from ${oldId} to ${newId}.` };
      }
      return { success: false, message: "No records found for the old UID." };
    } catch (err) {
      console.error("Migration failed:", err);
      showToast("Migration failed", "error");
      return { success: false, message: err.message };
    }
  };

  // Aggregate Member Loot Stats (derive from session data)
  const memberLootStats = React.useMemo(() => {
    const stats = {};
    auctionSessions.forEach(s => {
      if (!s.cells) return;
      Object.entries(s.cells).forEach(([key, tags]) => {
        if (!tags || tags.length === 0) return;
        
        let col = s.columns?.find(c => key.endsWith(`_${c.id}`));
        if (!col) col = s.columns?.find(c => key.endsWith(`_${c.name}`));
        if (!col) return;

        const mIdFromKey = key.substring(0, key.length - (col.id || col.name).length - 1).trim().toLowerCase();
        const member = members.find(m => (m.memberId || "").trim().toLowerCase() === mIdFromKey);
        if (!member) return;

        const mId = member.memberId;
        if (!stats[mId]) stats[mId] = { cardAlbums: 0, feathers: 0 };

        tags.forEach(tag => {
          if (tag.startsWith("!")) return; // Skip outbids
          if (col.name === "Card Album") {
            stats[mId].cardAlbums += 1;
          } else if (col.name === "Light & Dark") {
            stats[mId].feathers += 1;
          }
        });
      });
    });
    return stats;
  }, [auctionSessions, members]);

  const submitWishlistRequest = async (memberId, resourceType, metadata = {}) => {
    if (firebaseQuotaHit.current) return false;
    try {
      const bidRef = doc(db, "auction_bids", memberId);
      const snap = await getDoc(bidRef);
      const data = snap.exists() ? snap.data() : { bids: [] };
      
      const newBid = {
        type: resourceType,
        ts: Date.now(),
        status: "pending",
        ...metadata
      };

      const updatedBids = [...(data.bids || []).filter(b => b.type !== resourceType), newBid];
      await setDoc(bidRef, { memberId, bids: updatedBids });
      return true;
    } catch (err) {
      console.error("Wishlist submission failed:", err);
      if (err.code === 'resource-exhausted' || err.message?.includes('Quota limit exceeded')) {
        firebaseQuotaHit.current = true;
      }
      return false;
    }
  };

  const updateWishlistMetadata = async (memberId, resourceType, metadata) => {
    if (firebaseQuotaHit.current) return;
    try {
      const bidRef = doc(db, "auction_bids", memberId);
      const snap = await getDoc(bidRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const updatedBids = (data.bids || []).map(b => 
        b.type === resourceType ? { ...b, ...metadata } : b
      );
      await setDoc(bidRef, { memberId, bids: updatedBids });
    } catch (err) {
      console.error("Wishlist metadata update failed:", err);
      if (err.code === 'resource-exhausted' || err.message?.includes('Quota limit exceeded')) {
        firebaseQuotaHit.current = true;
      }
    }
  };

  const removeWishlistRequest = async (memberId, resourceType) => {
    if (firebaseQuotaHit.current) return;
    try {
      const bidRef = doc(db, "auction_bids", memberId);
      const snap = await getDoc(bidRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const updatedBids = (data.bids || []).filter(b => b.type !== resourceType);
      await setDoc(bidRef, { memberId, bids: updatedBids });
    } catch (err) {
      console.error("Wishlist removal failed:", err);
      if (err.code === 'resource-exhausted' || err.message?.includes('Quota limit exceeded')) {
        firebaseQuotaHit.current = true;
      }
    }
  };

  const fetchHistoricalData = React.useCallback(async (startDate = null, endDate = null) => {
    try {
      setIsLoadingHistory(true);
      let query = supabase.from('events').select('*');
      if (startDate) query = query.gte('event_date', startDate);
      if (endDate) query = query.lte('event_date', endDate);
      
      const { data: eventsData, error } = await query.order('event_date', { ascending: false });
      if (error) throw error;

      if (eventsData) {
        const mappedEvents = eventsData.map(e => ({
          eventId: e.event_id,
          eventDate: e.event_date,
          type: e.type,
          eventType: e.type, // Backward compatibility
          title: e.title,
          auditor: e.auditor,
          attendanceData: e.attendance_data,
          performanceData: e.performance_data,
          eoRatingsData: e.eo_ratings_data
        }));

        const nestedAtt = [];
        const nestedPerf = [];
        const nestedEo = [];
        
        mappedEvents.forEach(e => {
          if (e.attendanceData) Object.entries(e.attendanceData).forEach(([mid, status]) => nestedAtt.push({ eventId: e.eventId, memberId: mid, status }));
          if (e.performanceData) Object.entries(e.performanceData).forEach(([mid, pData]) => nestedPerf.push({ ...pData, eventId: e.eventId, memberId: mid }));
          if (e.eoRatingsData) Object.entries(e.eoRatingsData).forEach(([mid, rating]) => nestedEo.push({ eventId: e.eventId, memberId: mid, rating }));
        });

        setHistoricalEvents(mappedEvents);
        setHistoricalAttendance(nestedAtt);
        setHistoricalPerformance(nestedPerf);
        setHistoricalEoRatings(nestedEo);
      }
    } catch (err) {
      console.error("Fetch historical data failed:", err);
      showToast("Failed to load historical data", "error");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [showToast]);


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
    partyOverrides, setPartyOverrides,
    leagueParties, setLeagueParties,
    leaguePartyNames, setLeaguePartyNames,
    eoRatings, setEoRatings,
    auctionSessions, setAuctionSessions,
    auctionTemplates, setAuctionTemplates,
    notifications, sendNotification, markNotifRead,
    requests, submitRequest, approveRequest, rejectRequest, deleteRequest, clearProcessedRequests, migrateMemberData,
    joinRequests, submitJoinRequest, submitReactivationRequest, approveJoinRequest, rejectJoinRequest, deleteJoinRequest,
    discordConfig, setDiscordConfig, sendDiscordEmbed, sendDiscordImage,
    battlelogConfig, setBattlelogConfig,
    resourceCategories, setResourceCategories,
    metadataNotice, setMetadataNotice, metadataActivity, pendingAuctionConflict, resolveAuctionConflict, syncStatus, triggerSyncRetry,
    resetDatabase, exportBackupSnapshot,
    migrateNestingToEvents, fetchFirebaseDirect, fetchFirebaseMetadataOnly, migrateLocalStorageToSupabase, bootstrapMyRole, migrateUserRoles,
    resetMonthlyScores,
    memberLootStats, auctionWishlist, submitWishlistRequest, removeWishlistRequest, updateWishlistMetadata,
    historicalEvents, historicalAttendance, historicalPerformance, historicalEoRatings, isLoadingHistory, fetchHistoricalData,
    fetchRequests, isFetchingRequests,
    isOfflineMode, setIsOfflineMode,
    firebaseQuotaHit
  };

  return (
    <GuildContext.Provider value={value}>
      {children}
    </GuildContext.Provider>
  );
};
