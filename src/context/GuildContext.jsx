import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../supabase';



import { resetMonthlyData } from '../services/guildService';
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
  const [onlineUsers] = useState([]); // array of { uid, memberId, displayName, lastSeen }
  const [metadataNotice, setMetadataNotice] = useState(null); // { kind, message, timestamp }
  const [metadataActivity] = useState([]); // recent shared metadata updates
  const [pendingAuctionConflict, setPendingAuctionConflict] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState("synced"); // "saving" | "synced" | "offline" | "error"
  const [auctionBids, setAuctionBids] = useState([]);
  const [battlelogConfig, setBattlelogConfig] = useState({ weeklyAssignments: {}, rotationPoolMemberIds: [], lastEditorUid: null, lastUpdate: null });

  const storageKey = `sb-ngmgxqahznycnzuaraez-auth-token`;

  const getAuthHeaders = useCallback(() => {
    // Try both standard and project-specific storage keys
    const projectKey = `sb-ngmgxqahznycnzuaraez-auth-token`;
    const genericKey = `supabase.auth.token`;
    
    const sessionStr = localStorage.getItem(projectKey) || localStorage.getItem(genericKey);
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    const token = session?.access_token || supabaseAnonKey;
    
    return {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

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
      const emptyState = { 
        main: Array.from({ length: 8 }, () => []), 
        sub: Array.from({ length: 8 }, () => []) 
      };
      if (!saved) return emptyState;
      const parsed = JSON.parse(saved);
      const data = parsed.data || emptyState;
      // Sanitize
      const sanitize = (arr) => Array.isArray(arr) ? arr.map(p => Array.isArray(p) ? p : (p.members || [])) : Array.from({ length: 8 }, () => []);
      return { main: sanitize(data.main), sub: sanitize(data.sub) };
    } catch { 
      return { 
        main: Array.from({ length: 8 }, () => []), 
        sub: Array.from({ length: 8 }, () => []) 
      }; 
    }
  });

  const [leaguePartyNames, setLeaguePartyNames] = useState(() => {
    try {
      const saved = localStorage.getItem('guild_leaguePartyNames');
      const emptyNames = { 
        main: Array.from({ length: 8 }, () => ""), 
        sub: Array.from({ length: 8 }, () => "") 
      };
      if (!saved) return emptyNames;
      const parsed = JSON.parse(saved);
      const data = parsed.data || emptyNames;
      return { 
        main: Array.isArray(data.main) ? data.main : Array.from({ length: 8 }, () => ""), 
        sub: Array.isArray(data.sub) ? data.sub : Array.from({ length: 8 }, () => "") 
      };
    } catch { 
      return { 
        main: Array.from({ length: 8 }, () => ""), 
        sub: Array.from({ length: 8 }, () => "") 
      }; 
    }
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
    leagueParties: { main: Array.from({ length: 8 }, () => []), sub: Array.from({ length: 8 }, () => []) },
    leaguePartyNames: { main: Array.from({ length: 8 }, () => ""), sub: Array.from({ length: 8 }, () => "") },
    eoRatings: [],
    auctionSessions: [],
    auctionTemplates: [],
    resourceCategories: [],
    isFetching: false,
    discordConfig: {},
    battlelogConfig: {}
  });
  const liveAuctionRef = useRef({ auctionSessions: [], auctionTemplates: [], resourceCategories: [] });
  const saveBurstRef = useRef({ lastAt: 0, count: 0 });
  const roleFetchedRef = useRef(false); // Prevents duplicate user_roles queries on login

  const showToast = useCallback((message, type = "success", action = null) => {
    setToast({ message, type, action, key: Date.now() });
  }, []);
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

  // Data Loading from Supabase
  const GLOBAL_CACHE_KEY = "global_guild_data_v4";
  const GLOBAL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache

  const processFetchedData = useCallback((rosterData, eventsData, absenceData, metaData, bidsData, attendanceData, performanceData, eoRatingsData, auctionSessionsData) => {
    if (Array.isArray(rosterData)) {
      const mappedMembers = rosterData.map(r => ({ 
        ...r,
        ...r.metadata, 
        memberId: r.member_id,
        discord: r.discord || r.metadata?.discord || "",
        guildRank: r.guild_rank,
        isDonator: r.is_donator
      }));

      setMembers(mappedMembers);
      prevData.current.members = [...mappedMembers];
    }

    if (Array.isArray(eventsData)) {
      const allAtt = Array.isArray(attendanceData) ? attendanceData.map(a => ({ ...a, memberId: a.member_id || a.memberId, eventId: a.event_id || a.eventId })) : [];
      const allPerf = Array.isArray(performanceData) ? performanceData.map(p => ({ ...p, memberId: p.member_id || p.memberId, eventId: p.event_id || p.eventId })) : [];
      const allEo = Array.isArray(eoRatingsData) ? eoRatingsData.map(r => ({ ...r, memberId: r.member_id || r.memberId, eventId: r.event_id || r.eventId })) : [];

      const mappedEvents = eventsData.map(e => {
        const eventId = e.event_id || e.eventId;
        
        // Flatten nested attendance if present
        if (e.attendance_data && typeof e.attendance_data === 'object' && Object.keys(e.attendance_data).length > 0) {
          console.log(`GuildContext: Flattening ${Object.keys(e.attendance_data).length} att for ${eventId}`);
          Object.entries(e.attendance_data).forEach(([mId, status]) => {
            if (!allAtt.find(a => a.eventId === eventId && a.memberId === mId)) {
              allAtt.push({ eventId, memberId: mId, status });
            }
          });
        }

        // Flatten nested performance if present
        if (e.performance_data && typeof e.performance_data === 'object' && Object.keys(e.performance_data).length > 0) {
          Object.entries(e.performance_data).forEach(([mId, p]) => {
            if (!allPerf.find(perf => perf.eventId === eventId && perf.memberId === mId)) {
              allPerf.push({ 
                eventId, 
                memberId: mId, 
                ...p,
                kills: p.kills || 0,
                assists: p.assists || 0,
                ctf1: p.ctf1 || p.ctfPoints || 0,
                ctfPoints: p.ctfPoints || 0,
                performancePoints: p.performancePoints || 0
              });
            }
          });
        }

        // Flatten nested EO ratings if present
        if (e.eo_ratings_data && typeof e.eo_ratings_data === 'object' && Object.keys(e.eo_ratings_data).length > 0) {
          Object.entries(e.eo_ratings_data).forEach(([mId, rating]) => {
            if (!allEo.find(r => r.eventId === eventId && r.memberId === mId)) {
              allEo.push({ eventId, memberId: mId, rating });
            }
          });
        }

        return {
          eventId,
          eventDate: e.event_date,
          type: e.type,
          eventType: e.type,
          title: e.title,
          auditor: e.auditor,
          glMode: e.gl_mode || e.metadata?.glMode || 'vale',
          battlelogAudit: e.battlelog_audit || e.metadata?.battlelogAudit || null,
          digestMeta: e.digest_meta || e.metadata?.digestMeta || null,
          attendanceData: e.attendance_data || {},
          performanceData: e.performance_data || {},
          eoRatingsData: e.eo_ratings_data || {},
          createdAt: e.created_at
        };
      });

      setEvents(mappedEvents);
      setAttendance(allAtt);
      setPerformance(allPerf);
      setEoRatings(allEo);
      
      prevData.current.events = [...mappedEvents];
      prevData.current.attendance = [...allAtt];
      prevData.current.performance = [...allPerf];
      prevData.current.eoRatings = [...allEo];
    }

    if (Array.isArray(absenceData)) {
      try {
        const mappedAbsences = absenceData.map(a => ({
          id: a.id,
          memberId: a.member_id || a.memberId,
          eventType: a.event_type || a.eventType || 'Guild League',
          eventDate: a.event_date || a.start_date || a.eventDate,
          reason: a.reason,
          onlineStatus: a.online_status || a.onlineStatus || 'No',
          createdAt: a.created_at || a.createdAt
        }));
        setAbsences(mappedAbsences);
        prevData.current.absences = [...mappedAbsences];
      } catch (err) {
        console.error("Absence mapping error:", err);
        setAbsences(absenceData); // Fallback to raw data
      }
    }

    if (Array.isArray(metaData)) {
      const auctionGroup = metaData.find(m => m.key === 'auction')?.data || {};
      const discordGroup = metaData.find(m => m.key === 'discord')?.data || {};
      const battlelogGroup = metaData.find(m => m.key === 'battlelog')?.data || {};

      const eoRatings = Array.isArray(metaData.find(m => m.key === 'eoRatings')?.data) ? metaData.find(m => m.key === 'eoRatings').data : [];
      
      const auctionTemplates = Array.isArray(auctionGroup.auctionTemplates) ? auctionGroup.auctionTemplates : [];
      const resourceCategories = Array.isArray(auctionGroup.resourceCategories) ? auctionGroup.resourceCategories : ["Card Album", "Light & Dark"];
      
      const discordConfig = discordGroup.discord || {};
      const battlelogConfig = battlelogGroup || {};

      if (Array.isArray(auctionSessionsData)) {
        setAuctionSessions(auctionSessionsData);
        prevData.current.auctionSessions = [...auctionSessionsData];
      }

      setEoRatings(eoRatings);
      setAuctionTemplates(auctionTemplates);
      setResourceCategories(resourceCategories);
      setDiscordConfig(discordConfig);
      setBattlelogConfig(battlelogConfig);

      prevData.current.eoRatings = [...eoRatings];
      // Removed stale outer auctionSessions reference that was causing continuous re-saves and data wiping
      prevData.current.auctionTemplates = [...auctionTemplates];
      prevData.current.resourceCategories = [...resourceCategories];
      prevData.current.discordConfig = { ...discordConfig };
      prevData.current.battlelogConfig = { ...battlelogConfig };
    }

    if (Array.isArray(bidsData)) {
      const mappedBids = bidsData.map(b => ({
        ...b,
        id: b.member_id || b.id
      }));
      setAuctionBids(mappedBids);
      setAuctionWishlist(mappedBids);
    }
  }, []);

  const fetchGlobalData = useCallback(async (force = false) => {
    if (prevData.current.isFetching) return;
    if (!currentUser) {
      setLoading(false);
      return;
    }
    
    // Check Cache
    if (!force) {
      try {
        const cached = sessionStorage.getItem(GLOBAL_CACHE_KEY);
        if (cached) {
          const { data, fetchedAt } = JSON.parse(cached);
          if (Date.now() - fetchedAt < GLOBAL_CACHE_TTL) {
            // Force refresh if roster is empty
            if (!data.rosterData || data.rosterData.length === 0) {
              console.log("GuildContext: Cache has empty roster, forcing refresh");
            } else {
              processFetchedData(data.rosterData, data.eventsData, data.absenceData, data.metaData, data.bidsData, data.attendanceData, data.performanceData, data.eoRatingsData, data.auctionSessionsData);
              setLoading(false);
              setSyncStatus("synced");
              return;
            }
          }
        }
      } catch (e) { console.warn("Cache read failed", e); }
    }

    try {
      prevData.current.isFetching = true;
      setSyncStatus("loading");
      const headers = getAuthHeaders();
      const cutoffDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const [rosterRes, eventsRes, absenceRes, metaRes, bidsRes, attendanceRes, performanceRes, eoRatingsRes, auctionSessionsRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/roster?select=member_id,ign,class,role,discord,guild_rank,status,level,cp,metadata,is_donator`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/events?select=event_id,event_date,type,title,auditor,gl_mode,battlelog_audit,digest_meta,attendance_data,performance_data,eo_ratings_data,created_at&event_date=gte.${cutoffDate}`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/absences?select=*`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/metadata?select=key,data,updated_at`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/auction_bids?select=member_id,id,data,updated_at`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/attendance?select=member_id,event_id,status`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/performance?select=*`, { headers }), // Performance varies by GL mode, select all score fields
        fetch(`${supabaseUrl}/rest/v1/eo_ratings?select=event_id,member_id,rating`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/auction_sessions?select=id,name,date,columns,members,cells&order=date.desc`, { headers })
      ]);

      const rosterData = rosterRes.ok ? await rosterRes.json() : [];
      const eventsData = eventsRes.ok ? await eventsRes.json() : [];
      let absenceData = absenceRes.ok ? await absenceRes.json() : [];
      if (!Array.isArray(absenceData)) {
        console.error("Absences fetch returned non-array:", absenceData);
        absenceData = [];
      }
      const metaData = metaRes.ok ? await metaRes.json() : [];
      const bidsData = bidsRes.ok ? await bidsRes.json() : [];
      const attendanceData = attendanceRes.ok ? await attendanceRes.json() : [];
      const performanceData = performanceRes.ok ? await performanceRes.json() : [];
      const eoRatingsData = eoRatingsRes.ok ? await eoRatingsRes.json() : [];
      let auctionSessionsData = auctionSessionsRes.ok ? await auctionSessionsRes.json() : [];

      // RECOVERY LOGIC: If the migration script dropped the data, restore from the user's local v3 cache before it's gone
      if (auctionSessionsData.length === 0) {
        try {
          const oldCache = sessionStorage.getItem("global_guild_data_v3");
          if (oldCache) {
            const parsed = JSON.parse(oldCache);
            const oldMeta = parsed.data?.metaData?.find(m => m.key === 'auction');
            const recoveredSessions = oldMeta?.data?.auctionSessions || [];
            
            if (recoveredSessions.length > 0) {
              console.warn("Recovering lost auction sessions from local v3 cache!");
              // Post them back to the new table to save them
              await fetch(`${supabaseUrl}/rest/v1/auction_sessions`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify(recoveredSessions)
              });
              auctionSessionsData = recoveredSessions;
            }
          }
        } catch (err) {
          console.error("Auction recovery failed", err);
        }
      }

      processFetchedData(rosterData, Array.isArray(eventsData) ? eventsData : [], absenceData, metaData, bidsData, attendanceData, performanceData, eoRatingsData, auctionSessionsData);

      sessionStorage.setItem(GLOBAL_CACHE_KEY, JSON.stringify({
        data: { rosterData, eventsData, absenceData, metaData, bidsData, attendanceData, performanceData, eoRatingsData, auctionSessionsData },
        fetchedAt: Date.now()
      }));

      setSyncStatus("synced");
    } catch (err) {
      console.error("Supabase fetch failed:", err);
      setSyncStatus("error");
      showToast("Data sync failed. Some data may be missing.", "error");
    } finally {
      setLoading(false);
      prevData.current.isFetching = false;
    }
  }, [showToast, getAuthHeaders, currentUser, processFetchedData, GLOBAL_CACHE_TTL]);

  const triggerSyncRetry = useCallback(() => {
    if (navigator.onLine) setSyncStatus("saving");
    fetchGlobalData(); // Manual refresh trigger
  }, [fetchGlobalData]);

  // Auth Listener (Native Supabase Mode)
  useEffect(() => {
    const initAuth = async () => {
      try {
        setAuthLoading(true);
        console.log("Initializing Auth with getSession()...");
        
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (currentUser?.id !== session.user.id) {
          setCurrentUser(session.user);
        }
        console.log("Session found for user:", session.user.email);
          
          // Skip if SIGNED_IN handler already fetched the role
          if (!roleFetchedRef.current) {
            roleFetchedRef.current = true;
            const headers = getAuthHeaders();
            const roleRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?uid=eq.${session.user.id}&select=*`, {
              headers
            });
            
            if (roleRes.ok) {
              const roles = await roleRes.json();
              console.log("AuthInit: user_roles results:", roles);
              if (roles && roles[0]) {
                console.log("AuthInit: User role found:", roles[0].role, "MemberID:", roles[0].member_id);
                setUserRole(roles[0].role);
                setMyMemberId(roles[0].member_id || null);
              } else {
                console.log("AuthInit: No user_roles found. Attempting auto-link...");
                // Only perform auto-linking if no manual role exists in user_roles
                const identifier = session.user.email.split('@')[0].toLowerCase();
                console.log("AuthInit: Search identifier:", identifier);
                const rosterRes = await fetch(`${supabaseUrl}/rest/v1/roster?or=(discord.ilike.${identifier},ign.ilike.${identifier})&select=*`, { headers });
                
                if (rosterRes.ok) {
                  const rosterMatch = await rosterRes.json();
                  console.log("AuthInit: Roster match results:", rosterMatch);
                  if (rosterMatch && rosterMatch[0]) {
                    const m = rosterMatch[0];
                    const rank = m.guild_rank || "";
                    
                    let newRole = 'member';
                    if (rank.toLowerCase().includes('architect')) newRole = 'architect';
                    else if (['Admin', 'Guild Master', 'Vice Guild Master'].includes(rank)) newRole = 'admin';
                    else if (['Officer', 'Commander', 'Charisma Baby'].includes(rank)) newRole = 'officer';
                    
                    console.log(`Auto-assigning role: ${newRole} for ${session.user.email} (Matched via roster)`);
                    
                    await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
                      method: 'POST',
                      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                      body: JSON.stringify({
                        uid: session.user.id,
                        email: session.user.email,
                        role: newRole,
                        member_id: m.member_id,
                        updated_at: new Date().toISOString()
                      })
                    });
                    
                    setUserRole(newRole);
                    setMyMemberId(m.member_id);
                  } else {
                    setUserRole('member');
                  }
                }
              }
            } else {
              // roleRes is defined here — safe to read
              const errBody = await roleRes.text();
              console.error("Role fetch failed status:", roleRes.status, "Body:", errBody);
            }

          }



        } else {
          console.log("No active session found.");
          setCurrentUser(null);
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("Auth state change event:", _event);
      if (session) {
        if (currentUser?.id !== session.user.id) {
          setCurrentUser(session.user);
        }

        // On actual sign-in (not the initial session load which initAuth handles),
        // fetch the role immediately to avoid the race condition where userRole
        // stays null and the user is briefly redirected to the member profile page.
        if (_event === "SIGNED_IN" && !roleFetchedRef.current) {
          roleFetchedRef.current = true;
          try {
            const headers = getAuthHeaders();
            const roleRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?uid=eq.${session.user.id}&select=*`, { headers });
            console.log("AuthChange: user_roles results:", roleRes.status);
            if (roleRes.ok) {
              const roles = await roleRes.json();
              console.log("AuthChange: roles:", roles);
              if (roles && roles[0]) {
                console.log("AuthChange: Staff role found:", roles[0].role);
                setUserRole(roles[0].role);
                setMyMemberId(roles[0].member_id || null);
              } else {
                // Regular member: use metadata member_id stored during auto-signup
                const metaMemberId = session.user.user_metadata?.member_id || null;
                console.log("AuthChange: No role found, using metadata member_id:", metaMemberId);
                if (metaMemberId) {
                  setUserRole('member');
                  setMyMemberId(metaMemberId);
                }
              }
              // Force fresh data to ensure new members are in the roster
              fetchGlobalData(true);
            }
          } catch (err) {
            console.warn("Role fetch on SIGNED_IN failed:", err);
          }
        }
      } else {
        // Reset on sign out
        roleFetchedRef.current = false;
        setCurrentUser(null);
        setUserRole(null);
        setMyMemberId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [currentUser?.id, fetchGlobalData, getAuthHeaders]);




  // --- Real-time Subscriptions ---
  useEffect(() => {
    if (!currentUser || authLoading || loading) return;

    console.log("GuildContext: Initializing Real-time Subscriptions...");

    const channel = supabase
      .channel('guild_changes')
      // 1. Roster
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roster' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          setMembers(prev => {
            const exists = prev.find(m => m.memberId === newRow.member_id);
            const updated = exists 
              ? prev.map(m => m.memberId === newRow.member_id ? { ...m, ...newRow.metadata, memberId: newRow.member_id } : m)
              : [...prev, { ...newRow.metadata, memberId: newRow.member_id }];
            prevData.current.members = [...updated];
            return updated;
          });
        } else if (eventType === 'DELETE') {
          setMembers(prev => {
            const updated = prev.filter(m => m.memberId !== oldRow.member_id);
            prevData.current.members = [...updated];
            return updated;
          });
        }
      })
      // 2. Events
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const mapped = {
            eventId: newRow.event_id,
            eventDate: newRow.event_date,
            type: newRow.type,
            eventType: newRow.type,
            title: newRow.title,
            auditor: newRow.auditor,
            glMode: newRow.gl_mode || 'vale',
            battlelogAudit: newRow.battlelog_audit,
            digestMeta: newRow.digest_meta,
            attendanceData: newRow.attendance_data || {},
            performanceData: newRow.performance_data || {},
            eoRatingsData: newRow.eo_ratings_data || {},
            createdAt: newRow.created_at
          };
          setEvents(prev => {
            const exists = prev.find(e => e.eventId === mapped.eventId);
            const updated = exists 
              ? prev.map(e => e.eventId === mapped.eventId ? mapped : e)
              : [...prev, mapped].sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));
            prevData.current.events = [...updated];
            return updated;
          });
        } else if (eventType === 'DELETE') {
          setEvents(prev => {
            const updated = prev.filter(e => e.eventId !== oldRow.event_id);
            prevData.current.events = [...updated];
            return updated;
          });
        }
      })
      // 3. Attendance
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const mapped = { memberId: newRow.member_id, eventId: newRow.event_id, status: newRow.status };
          setAttendance(prev => {
            const exists = prev.find(a => a.eventId === mapped.eventId && a.memberId === mapped.memberId);
            const updated = exists 
              ? prev.map(a => (a.eventId === mapped.eventId && a.memberId === mapped.memberId) ? mapped : a)
              : [...prev, mapped];
            prevData.current.attendance = [...updated];
            return updated;
          });
        } else if (eventType === 'DELETE') {
          setAttendance(prev => {
            const updated = prev.filter(a => !(a.eventId === oldRow.event_id && a.memberId === oldRow.member_id));
            prevData.current.attendance = [...updated];
            return updated;
          });
        }
      })
      // 4. Performance
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performance' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const { event_id, member_id, ...rest } = newRow;
          const mapped = { eventId: event_id, memberId: member_id, ...rest };
          setPerformance(prev => {
            const exists = prev.find(p => p.eventId === mapped.eventId && p.memberId === mapped.memberId);
            const updated = exists 
              ? prev.map(p => (p.eventId === mapped.eventId && p.memberId === mapped.memberId) ? mapped : p)
              : [...prev, mapped];
            prevData.current.performance = [...updated];
            return updated;
          });
        } else if (eventType === 'DELETE') {
          setPerformance(prev => {
            const updated = prev.filter(p => !(p.eventId === oldRow.event_id && p.memberId === oldRow.member_id));
            prevData.current.performance = [...updated];
            return updated;
          });
        }
      })
      // 5. Auction Sessions (Individual Rows)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_sessions' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          setAuctionSessions(prev => {
            const exists = prev.find(s => s.id === newRow.id);
            const updated = exists 
              ? prev.map(s => s.id === newRow.id ? newRow : s)
              : [...prev, newRow].sort((a, b) => new Date(b.date) - new Date(a.date));
            prevData.current.auctionSessions = [...updated];
            return updated;
          });
        } else if (eventType === 'DELETE') {
          setAuctionSessions(prev => {
            const updated = prev.filter(s => s.id !== oldRow.id);
            prevData.current.auctionSessions = [...updated];
            return updated;
          });
        }
      })
      // 6. Roster (Members)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roster' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const mapped = { 
            ...newRow,
            ...newRow.metadata, 
            memberId: newRow.member_id,
            discord: newRow.discord || newRow.metadata?.discord || "",
            guildRank: newRow.guild_rank,
            isDonator: newRow.is_donator
          };
          setMembers(prev => {
            const exists = prev.find(m => m.memberId === mapped.memberId);
            const updated = exists 
              ? prev.map(m => m.memberId === mapped.memberId ? mapped : m)
              : [...prev, mapped].sort((a, b) => a.ign.localeCompare(b.ign));
            prevData.current.members = [...updated];
            return updated;
          });
        } else if (eventType === 'DELETE') {
          setMembers(prev => {
            const updated = prev.filter(m => m.memberId !== oldRow.member_id);
            prevData.current.members = [...updated];
            return updated;
          });
        }
      })
      // 7. Metadata (Auctions, Discord Config, etc.)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'metadata' }, payload => {
        const { eventType, new: newRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const key = newRow.key;
          const data = newRow.data || {};
          
          if (key === 'auction') {
            setAuctionTemplates(data.auctionTemplates || []);
            setResourceCategories(data.resourceCategories || ["Card Album", "Light & Dark"]);
            prevData.current.auctionData = { ...data };
          } else if (key === 'discord') {
            setDiscordConfig(data.discord || {});
            prevData.current.discordData = { ...(data.discord || {}) };
          } else if (key === 'battlelog') {
            setBattlelogConfig(data || {});
            prevData.current.battlelogConfig = { ...data };
          }
        }
      })
      // 6. Absences
      .on('postgres_changes', { event: '*', schema: 'public', table: 'absences' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const mapped = { 
            id: newRow.id, 
            memberId: newRow.member_id, 
            eventType: newRow.event_type || 'Guild League',
            eventDate: newRow.event_date || newRow.start_date, 
            reason: newRow.reason,
            onlineStatus: newRow.online_status || 'No',
            createdAt: newRow.created_at
          };
          setAbsences(prev => {
            const exists = prev.find(a => a.id === mapped.id);
            const updated = exists ? prev.map(a => a.id === mapped.id ? mapped : a) : [...prev, mapped];
            prevData.current.absences = [...updated];
            return updated;
          });
        } else if (eventType === 'DELETE') {
          setAbsences(prev => {
            const updated = prev.filter(a => a.id !== oldRow.id);
            prevData.current.absences = [...updated];
            return updated;
          });
        }
      })
      // 7. Auction Bids / Wishlist
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_bids' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const mapped = { ...newRow, id: newRow.member_id || newRow.id };
          setAuctionBids(prev => {
            const exists = prev.find(b => b.id === mapped.id);
            const updated = exists ? prev.map(b => b.id === mapped.id ? mapped : b) : [...prev, mapped];
            return updated;
          });
          setAuctionWishlist(prev => {
            const exists = prev.find(b => b.id === mapped.id);
            const updated = exists ? prev.map(b => b.id === mapped.id ? mapped : b) : [...prev, mapped];
            return updated;
          });
        } else if (eventType === 'DELETE') {
          setAuctionBids(prev => prev.filter(b => b.id !== (oldRow.member_id || oldRow.id)));
          setAuctionWishlist(prev => prev.filter(b => b.id !== (oldRow.member_id || oldRow.id)));
        }
      })
      // 8. Join Requests
      .on('postgres_changes', { event: '*', schema: 'public', table: 'join_requests' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const mapped = { ...newRow, requestType: newRow.request_type || newRow.requestType };
          setJoinRequests(prev => {
            // Deduplicate by ID OR Business Key (UID) for pending requests
            const isDuplicate = prev.some(r => r.id === mapped.id || (mapped.status === 'pending' && r.uid === mapped.uid && r.status === 'pending'));
            if (isDuplicate) {
              return prev.map(r => (r.id === mapped.id || (mapped.status === 'pending' && r.uid === mapped.uid && r.status === 'pending')) ? mapped : r);
            }
            return [...prev, mapped];
          });
        } else if (eventType === 'DELETE') {
          setJoinRequests(prev => prev.filter(r => r.id !== oldRow.id));
        }
      })
      // 9. Profile Update Requests (Vanguard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, payload => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          setRequests(prev => {
            // Deduplicate by ID OR Business Key (member_id) for pending requests
            const isDuplicate = prev.some(r => r.id === newRow.id || (newRow.status === 'pending' && r.member_id === newRow.member_id && r.status === 'pending'));
            if (isDuplicate) {
              return prev.map(r => (r.id === newRow.id || (newRow.status === 'pending' && r.member_id === newRow.member_id && r.status === 'pending')) ? newRow : r);
            }
            return [...prev, newRow];
          });
        } else if (eventType === 'DELETE') {
          setRequests(prev => prev.filter(r => r.id !== oldRow.id));
        }
      })
      // 10. Notifications
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, payload => {
        const { eventType, new: newRow } = payload;
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          // Only add if it's for this user or 'all'
          if (newRow.target_id === 'all' || (myMemberId && newRow.target_id === myMemberId)) {
            const mapped = { ...newRow, id: newRow.id, ts: newRow.ts, targetId: newRow.target_id };
            setNotifications(prev => {
              const exists = prev.find(n => n.id === mapped.id);
              const updated = exists ? prev.map(n => n.id === mapped.id ? mapped : n) : [mapped, ...prev];
              return updated.slice(0, 30); // Keep last 30
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, authLoading, loading, myMemberId]);

  useEffect(() => {
    fetchGlobalData();
  }, [currentUser, fetchGlobalData, initialData]);

  // Notifications Initial Fetch (Realtime handles subsequent updates)
  useEffect(() => {
    if (!currentUser || authLoading || loading) return;
    
    const fetchNotifs = async () => {
      try {
        const headers = getAuthHeaders();

        let url = `${supabaseUrl}/rest/v1/notifications?select=*&order=ts.desc&limit=30`;
        if (myMemberId) {
          url += `&or=(target_id.eq.all,target_id.eq.${myMemberId})`;
        }

        const res = await fetch(url, {
          headers
        });
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) {
          setNotifications(data.map(n => ({ ...n, id: n.id, ts: n.ts, targetId: n.target_id })));
        }
      } catch (err) {
        console.error("Supabase notif fetch error:", err);
      }
    };

    fetchNotifs();
  }, [currentUser, authLoading, loading, myMemberId, getAuthHeaders]);

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
      const headers = getAuthHeaders();

      const [reqsRes, joinRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/requests?select=*&order=timestamp.desc&limit=50`, {
          headers
        }),
        fetch(`${supabaseUrl}/rest/v1/join_requests?select=*&order=timestamp.desc&limit=50`, {
          headers
        })
      ]);

      const reqsData = await reqsRes.json().catch(() => []);
      const joinData = await joinRes.json().catch(() => []);
      
      const mappedReqs = (Array.isArray(reqsData) ? reqsData : []).map(r => ({
        ...r,
        memberId: r.member_id || r.memberId,
        requesterIgn: r.requester_ign || r.requesterIgn,
        oldData: r.old_data || r.oldData,
        newData: r.new_data || r.newData,
        timestamp: r.timestamp || r.created_at
      }));

      const mappedJoin = (Array.isArray(joinData) ? joinData : []).map(r => ({
        ...r,
        // Ensure standard fields for join requests too
        jobClass: r.jobClass || r.class,
        requestType: r.request_type || r.requestType || 'join',
        timestamp: r.timestamp || r.created_at
      }));

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- REQUESTS_CACHE_TTL is a constant; getAuthHeaders is stable; excluded intentionally
  }, [currentUser, canSeeRequestData, isFetchingRequests]);



  // fetchRequests is now LAZY — only called when user visits the Requests page.
  useEffect(() => {
    if (!canSeeRequestData) {
      setRequests([]);
      setJoinRequests([]);
    }
  }, [canSeeRequestData]);

  useEffect(() => {
    const onOffline = () => setSyncStatus("offline");
    const onOnline = () => setSyncStatus("synced");
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);


  // Auto-save to Supabase — smart dirty tracking
  useEffect(() => {
    // Only Staff/Architects should attempt to auto-save global data.
    // Regular members can only view, so we skip the sync logic for them.
    if (!canSeeRequestData) return;
    if (!currentUser || authLoading || loading || syncStatus === "offline") return;
    if (members.length === 0 && events.length === 0) return;
    
      const saveToSupabase = async () => {
      // HARD SAFEGUARD: Never save if roster or events are empty when they weren't before
    const prevMemberCount = prevData.current.members?.length || 0;
    const prevEventCount = prevData.current.events?.length || 0;

    if (members.length === 0 && prevMemberCount > 0) {
      console.error("[CRITICAL SAFEGUARD] Save blocked: Members list is empty but was previously", prevMemberCount);
      setSyncStatus("error");
      return;
    }

    if (events.length === 0 && prevEventCount > 0) {
      console.error("[CRITICAL SAFEGUARD] Save blocked: Events list is empty but was previously", prevEventCount);
      setSyncStatus("error");
      return;
    }

    // Additional check: Don't allow saving if count dropped by more than 20% suddenly (unless intentional)
    if (prevMemberCount > 10 && members.length < prevMemberCount * 0.8) {
       console.warn("[SAFEGUARD] Large data drop detected. Verifying before save...");
       // For now, we allow it but log it. In a stricter mode, we could block it.
    }

    setSyncStatus("saving");
      
      // Prevent saving if attendance/performance state just "vanished" (potential fetch error)
      if (attendance.length === 0 && (prevData.current.attendance?.length || 0) > 0) {
        console.error("[SAFEGUARD] Aborting save: Attendance records vanished from state!");
        return;
      }
      if (performance.length === 0 && (prevData.current.performance?.length || 0) > 0) {
        console.error("[SAFEGUARD] Aborting save: Performance records vanished from state!");
        return;
      }

      setSyncStatus("saving");
      try {
        const headers = getAuthHeaders();

        // --- 1. Roster ---
        const prevMemberMap = new Map(
          (prevData.current.members || []).map(m => [m.memberId, JSON.stringify({
            memberId: m.memberId,
            ign: m.ign,
            class: m.class,
            role: m.role || 'DPS',
            discord: m.discord || '',
            guildRank: m.guildRank,
            status: m.status || 'active',
            level: Number(m.level || 0),
            cp: Number(m.cp || 0)
          })])
        );
        const dirtyMembers = members.filter(m => {
          const currentStr = JSON.stringify({
            memberId: m.memberId,
            ign: m.ign,
            class: m.class,
            role: m.role || 'DPS',
            discord: m.discord || '',
            guildRank: m.guildRank,
            status: m.status || 'active',
            level: Number(m.level || 0),
            cp: Number(m.cp || 0)
          });
          return currentStr !== prevMemberMap.get(m.memberId);
        });

        if (dirtyMembers.length > 0) {
          const payload = dirtyMembers.map(m => ({
            member_id: m.memberId,
            ign: m.ign,
            class: m.class,
            role: m.role || 'DPS',
            discord: m.discord || '',
            guild_rank: m.guildRank,
            status: m.status || 'active',
            level: Number(m.level || 0),
            cp: Number(m.cp || 0),
            metadata: m
          }));


          const res = await fetch(`${supabaseUrl}/rest/v1/roster`, {
            method: 'POST',
            headers: { 
              ...headers,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`Roster Save Failed: ${res.status}`);
          prevData.current.members = [...members];
        } else {
          // Always update cache
          prevData.current.members = [...members];
        }

        // --- 2. Metadata ---
        const auctionMetaData = { auctionTemplates, resourceCategories }; // removed auctionSessions from here
        if (JSON.stringify(auctionMetaData) !== JSON.stringify(prevData.current.auctionMetaData)) {
          const res = await fetch(`${supabaseUrl}/rest/v1/metadata`, {
            method: 'POST',
            headers: { 
              ...headers,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ key: 'auction', data: auctionMetaData, updated_at: new Date().toISOString() })
          });
          if (!res.ok) throw new Error(`Auction Metadata Save Failed: ${res.status}`);
          prevData.current.auctionMetaData = { ...auctionMetaData };
        }

        // --- 2.1 Auction Sessions (Individual Rows) ---
        const prevAuctionMap = new Map(
          (prevData.current.auctionSessions || []).map(s => [s.id, JSON.stringify({
            id: s.id,
            name: s.name,
            date: s.date,
            columns: s.columns || [],
            members: s.members || [],
            cells: s.cells || {}
          })])
        );
        const dirtyAuctions = auctionSessions.filter(s => {
          const currentStr = JSON.stringify({
            id: s.id,
            name: s.name,
            date: s.date,
            columns: s.columns || [],
            members: s.members || [],
            cells: s.cells || {}
          });
          return currentStr !== prevAuctionMap.get(s.id);
        });

        if (dirtyAuctions.length > 0) {
          const res = await fetch(`${supabaseUrl}/rest/v1/auction_sessions`, {
            method: 'POST',
            headers: { 
              ...headers,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(dirtyAuctions)
          });
          if (!res.ok) throw new Error(`Auction Sessions Save Failed: ${res.status}`);
          prevData.current.auctionSessions = [...auctionSessions];
        } else {
          // Always update cache to match current state
          prevData.current.auctionSessions = [...auctionSessions];
        }

        if (JSON.stringify(discordConfig) !== JSON.stringify(prevData.current.discordData)) {
          const res = await fetch(`${supabaseUrl}/rest/v1/metadata`, {
            method: 'POST',
            headers: { 
              ...headers,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ key: 'discord', data: { discord: discordConfig }, updated_at: new Date().toISOString() })
          });
          if (!res.ok) throw new Error(`Discord Save Failed: ${res.status}`);
          prevData.current.discordData = { ...discordConfig };
        }

        // --- 3. Events ---
        const attByEvent = {};
        attendance.forEach(a => {
          if (!attByEvent[a.eventId]) attByEvent[a.eventId] = {};
          attByEvent[a.eventId][a.memberId] = a.status;
        });
        const perfByEvent = {};
        performance.forEach(p => {
          if (!perfByEvent[p.eventId]) perfByEvent[p.eventId] = {};
          // eslint-disable-next-line no-unused-vars
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
          (prevData.current.events || []).map(e => [e.eventId, JSON.stringify({
            eventId: e.eventId,
            eventDate: e.eventDate,
            eventType: e.eventType || e.type,
            title: e.title || '',
            glMode: e.glMode || 'vale',
            battlelogAudit: e.battlelogAudit || null,
            attendanceData: e.attendanceData || {},
            performanceData: e.performanceData || {},
            eoRatingsData: e.eoRatingsData || {}
          })])
        );

        const dirtyEvents = mappedEvents.filter(e => {
          const currentStr = JSON.stringify({
            eventId: e.eventId,
            eventDate: e.eventDate,
            eventType: e.eventType || e.type,
            title: e.title || '',
            glMode: e.glMode || 'vale',
            battlelogAudit: e.battlelogAudit || null,
            attendanceData: e.attendanceData || {},
            performanceData: e.performanceData || {},
            eoRatingsData: e.eoRatingsData || {}
          });
          return currentStr !== prevEventMap.get(e.eventId);
        });

        if (dirtyEvents.length > 0) {
          const payload = dirtyEvents.map(e => ({
            event_id: e.eventId,
            event_date: e.eventDate,
            type: e.eventType || e.type,
            title: e.title || '',
            auditor: e.battlelogAudit?.assignedIgn || e.auditor || '',
            gl_mode: e.glMode || 'vale',
            battlelog_audit: e.battlelogAudit || null,
            digest_meta: e.digestMeta || null,
            attendance_data: e.attendanceData || {},
            performance_data: e.performanceData || {},
            eo_ratings_data: e.eoRatingsData || {},
            created_at: e.createdAt || new Date().toISOString()
          }));

          const res = await fetch(`${supabaseUrl}/rest/v1/events`, {
            method: 'POST',
            headers: { 
              ...headers,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`Events Save Failed: ${res.status}`);
          prevData.current.events = [...mappedEvents];
        } else {
          // Even if no events were dirty, update prevData with current mapped state 
          // to ensure future checks compare against the latest derived values.
          prevData.current.events = [...mappedEvents];
        }

        // --- 4. Absences ---
        const prevAbsenceMap = new Map(
          (prevData.current.absences || []).map(a => [a.id, JSON.stringify(a)])
        );
        const dirtyAbsences = absences.filter(a =>
          a.id && JSON.stringify(a) !== prevAbsenceMap.get(a.id)
        );
        if (dirtyAbsences.length > 0) {
          const payload = dirtyAbsences.map(a => ({
            id: a.id,
            member_id: a.memberId,
            event_type: a.eventType,
            event_date: a.eventDate,
            start_date: a.eventDate, // backward compatibility
            reason: a.reason,
            online_status: a.onlineStatus,
            status: a.status || 'pending'
          }));

          const res = await fetch(`${supabaseUrl}/rest/v1/absences`, {
            method: 'POST',
            headers: { 
              ...headers,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`Absences Save Failed: ${res.status}`);
          prevData.current.absences = [...absences];
        }

        setSyncStatus("synced");

        // Update local cache after successful save to ensure freshness on refresh
        sessionStorage.setItem(GLOBAL_CACHE_KEY, JSON.stringify({
          data: { 
            rosterData: members.map(m => ({ 
              member_id: m.memberId, 
              ign: m.ign, 
              class: m.class, 
              guild_rank: m.guildRank, 
              status: m.status, 
              level: m.level, 
              cp: m.cp, 
              metadata: m 
            })), 
            eventsData: mappedEvents.map(e => ({
              event_id: e.eventId,
              event_date: e.eventDate,
              type: e.eventType || e.type,
              title: e.title,
              auditor: e.auditor,
              attendance_data: e.attendanceData,
              performance_data: e.performanceData,
              eo_ratings_data: e.eoRatingsData
            })),
            absenceData: absences.map(a => ({
              id: a.id,
              member_id: a.memberId,
              start_date: a.startDate,
              end_date: a.endDate,
              reason: a.reason,
              status: a.status
            })),
            metaData: [
              { key: 'auction', data: { auctionTemplates, resourceCategories } },
              { key: 'discord', data: { discord: discordConfig } }
            ],
            bidsData: auctionWishlist.map(b => ({
              member_id: b.member_id,
              bids: b.bids,
              updated_at: b.updated_at
            })),
            attendanceData: attendance,
            performanceData: performance,
            eoRatingsData: eoRatings
          },
          fetchedAt: Date.now()
        }));
      } catch (err) {
        console.error("Supabase save error:", err);
        setSyncStatus("error");
      }
    };

    const timer = setTimeout(saveToSupabase, 8000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- authLoading/currentUser/getAuthHeaders/loading/syncStatus excluded intentionally: adding them would re-trigger the 8s save debounce on every auth state change
  }, [members, events, absences, auctionSessions, auctionTemplates, resourceCategories, discordConfig, attendance, performance, eoRatings]);

  const sendNotification = useCallback(async (targetId, title, message, type = "info") => {
    const headers = getAuthHeaders();

    const notif = {
      target_id: targetId,
      title,
      message,
      type,
      ts: new Date().toISOString(),
      readBy: []
    };
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers,
        body: JSON.stringify([notif])
      });
      if (!res.ok) throw new Error(`Notification failed: ${res.status}`);
      showToast("Notification sent", "success");
    } catch(err) {
      console.error("Supabase notification error:", err);
      showToast("Failed to send notification", "error");
    }
  }, [getAuthHeaders, showToast]);

   const sendDiscordEmbed = useCallback(async (title, description, color = 0x6382e6, fields = [], thumbnail = null, category = null, templateKey = null, placeholders = {}, memberMentionId = null, overridePing = null) => {
     const catConfig = category ? discordConfig.notifications?.[category] : null;

     if (catConfig && !catConfig.enabled) {
       if (isAdmin) showToast(`Discord: Notification category '${category}' is disabled.`, "info");
       return;
     }

     const targetUrl = (catConfig?.webhookUrl && catConfig.webhookUrl.trim() !== "") 
       ? catConfig.webhookUrl 
       : discordConfig.webhookUrl;

    if (!targetUrl || !targetUrl.startsWith('http')) {
      if (isAdmin) showToast(`Discord: Invalid or missing Webhook URL.`, "error");
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
  }, [discordConfig, isAdmin, showToast]);

  const sendDiscordImage = useCallback(async (blob, fileName, caption, category = "auction_results", placeholders = {}) => {
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
  }, [discordConfig, isAdmin, showToast]);

  const markNotifRead = useCallback(async (id) => {
    try {
      const headers = getAuthHeaders();
      await fetch(`${supabaseUrl}/rest/v1/notifications?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ read_at: new Date().toISOString() })
      });
    } catch(err) {
      console.error(err);
    }
  }, [getAuthHeaders]);

  const resetMonthlyScores = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await resetMonthlyData(monthYear);

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
  }, [showToast]);

  const resolveAuctionConflict = useCallback((action) => {
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
  }, [pendingAuctionConflict, showToast]);

  const submitJoinRequest = useCallback(async (data) => {
    try {
      const headers = getAuthHeaders();

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
        id: crypto.randomUUID?.() || Date.now().toString(),
        ign: data.ign,
        class: data.jobClass,
        role: data.role,
        uid: data.uid,
        discord: data.discord,
        status: "pending",
        request_type: "join",
        timestamp: Date.now()
      };
      
      const res = await fetch(`${supabaseUrl}/rest/v1/join_requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify([req])
      });
      if (!res.ok) throw new Error(`Join request failed: ${res.status}`);

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
  }, [getAuthHeaders, members, joinRequests, sendDiscordEmbed, showToast]);

  const submitReactivationRequest = useCallback(async (data) => {
    try {
      const headers = getAuthHeaders();

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
        id: crypto.randomUUID?.() || Date.now().toString(),
        discord: data.discord,
        ign: data.ign || existing.ign || "Unknown",
        uid,
        class: existing.class || "Unknown",
        role: existing.role || "DPS",
        status: "pending",
        request_type: "reactivation",
        timestamp: Date.now()
      };
      
      const res = await fetch(`${supabaseUrl}/rest/v1/join_requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify([req])
      });
      if (!res.ok) throw new Error(`Reactivation failed: ${res.status}`);

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
  }, [getAuthHeaders, members, joinRequests, sendDiscordEmbed, showToast]);

  const approveJoinRequest = useCallback(async (requestId) => {
    try {
      const headers = getAuthHeaders();

      const r = joinRequests.find(x => x.id === requestId);
      if (!r) return;

      const jobClass = r.jobClass || r.class || "Unknown";
      const existingMember = members.find(m => (m.memberId || "").toLowerCase() === (r.uid || "").toLowerCase());
      const newMember = {
        ...(existingMember || {}),
        memberId: r.uid,
        ign: r.ign,
        class: jobClass,
        role: r.role,
        discord: r.discord,
        guildRank: existingMember?.guildRank || "Member",
        joinDate: existingMember?.joinDate || new Date().toISOString().split('T')[0],
        status: "active",
        reactivatedAt: existingMember ? new Date().toISOString() : (existingMember?.reactivatedAt || null)
      };
      // 1. Activate in Supabase Roster
      const rosterPayload = {
        member_id: newMember.memberId,
        ign: newMember.ign,
        class: newMember.class,
        role: newMember.role || 'DPS',
        discord: newMember.discord || '',
        guild_rank: newMember.guildRank,
        status: newMember.status,
        level: Number(newMember.level || 0),
        cp: Number(newMember.cp || 0),
        metadata: newMember
      };

      
      const rosterRes = await fetch(`${supabaseUrl}/rest/v1/roster`, {
        method: 'POST',
        headers: { 
          ...headers,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify([rosterPayload])
      });
      if (!rosterRes.ok) throw new Error(`Roster activation failed: ${rosterRes.status}`);

      // Delete join request after approval to keep DB clean
      const reqRes = await fetch(`${supabaseUrl}/rest/v1/join_requests?id=eq.${requestId}`, {
        method: 'DELETE',
        headers
      });
      if (!reqRes.ok) throw new Error(`Join request cleanup failed: ${reqRes.status}`);

      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
      sessionStorage.removeItem("requests_cache_v1");

      if (r.request_type !== "reactivation" && r.requestType !== "reactivation") {
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
      fetchGlobalData(true); // Force refresh to clear cache
      return true;
    } catch(err) {
      console.error(err);
      showToast("Failed to approve registration", "error");
      return false;
    }
  }, [getAuthHeaders, joinRequests, members, sendDiscordEmbed, showToast, fetchGlobalData]);

  const deleteEvent = useCallback(async (eventId) => {
    try {
      const headers = getAuthHeaders();
      
      // 1. Delete from Supabase Events table
      const res = await fetch(`${supabaseUrl}/rest/v1/events?event_id=eq.${eventId}`, {
        method: 'DELETE',
        headers
      });
      
      if (!res.ok) throw new Error(`Event deletion failed: ${res.status}`);

      // 2. Cleanup related data in separate tables (using event_id)
      await Promise.allSettled([
        fetch(`${supabaseUrl}/rest/v1/attendance?event_id=eq.${eventId}`, { method: 'DELETE', headers }),
        fetch(`${supabaseUrl}/rest/v1/performance?event_id=eq.${eventId}`, { method: 'DELETE', headers }),
        fetch(`${supabaseUrl}/rest/v1/eo_ratings?event_id=eq.${eventId}`, { method: 'DELETE', headers })
      ]);

      // 3. Update local state
      setEvents(prev => {
        const updated = prev.filter(ev => ev.eventId !== eventId);
        prevData.current.events = [...updated];
        return updated;
      });
      setAttendance(prev => {
        const updated = prev.filter(a => a.eventId !== eventId);
        prevData.current.attendance = [...updated];
        return updated;
      });
      setPerformance(prev => {
        const updated = prev.filter(p => p.eventId !== eventId);
        prevData.current.performance = [...updated];
        return updated;
      });
      setEoRatings(prev => {
        const updated = prev.filter(r => r.eventId !== eventId);
        prevData.current.eoRatings = [...updated];
        return updated;
      });

      showToast("Event deleted permanently", "success");
      return true;
    } catch (err) {
      console.error("Delete event error:", err);
      showToast("Failed to delete event from database", "error");
      return false;
    }
  }, [getAuthHeaders, showToast]);

  const rejectJoinRequest = useCallback(async (requestId) => {
    try {
      const headers = getAuthHeaders();

      const res = await fetch(`${supabaseUrl}/rest/v1/join_requests?id=eq.${requestId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error(`Rejection/Cleanup failed: ${res.status}`);

      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
      sessionStorage.removeItem("requests_cache_v1");
      showToast('Registration rejected and removed', 'info');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to reject registration', 'error');
      return false;
    }
  }, [getAuthHeaders, showToast]);

  const deleteJoinRequest = useCallback(async (requestId) => {
    try {
      const headers = getAuthHeaders();

      const res = await fetch(`${supabaseUrl}/rest/v1/join_requests?id=eq.${requestId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);

      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
      sessionStorage.removeItem("requests_cache_v1");
      showToast('Registration record deleted', 'success');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to delete record', 'error');
      return false;
    }
  }, [getAuthHeaders, showToast]);

  const deleteAuctionSession = useCallback(async (sessionId) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${supabaseUrl}/rest/v1/auction_sessions?id=eq.${sessionId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error(`Auction session deletion failed: ${res.status}`);

      setAuctionSessions(prev => {
        const updated = prev.filter(s => s.id !== sessionId);
        prevData.current.auctionSessions = [...updated];
        return updated;
      });

      showToast("Auction session deleted permanently", "success");
      return true;
    } catch (err) {
      console.error("Delete auction error:", err);
      showToast("Failed to delete auction session", "error");
      return false;
    }
  }, [getAuthHeaders, showToast]);
  
  const deleteMember = useCallback(async (memberId) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${supabaseUrl}/rest/v1/roster?member_id=eq.${memberId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error(`Member deletion failed: ${res.status}`);

      setMembers(prev => {
        const updated = prev.filter(m => m.memberId !== memberId);
        prevData.current.members = [...updated];
        return updated;
      });

      showToast("Member deleted permanently", "success");
      return true;
    } catch (err) {
      console.error("Delete member error:", err);
      showToast("Failed to delete member from database", "error");
      return false;
    }
  }, [getAuthHeaders, showToast]);

  const submitRequest = useCallback(async (memberId, newData) => {
    try {
      const headers = getAuthHeaders();

      const m = members.find(x => x.memberId === memberId);
      if (!m) return;

      // Duplicate Check: Already pending request for this member?
      const alreadyPending = requests.some(r => r.member_id === memberId && r.status === "pending");
      if (alreadyPending) {
        showToast("You already have a pending profile update request.", "error");
        return false;
      }

      const req = {
        id: crypto.randomUUID?.() || Date.now().toString(),
        member_id: memberId,
        requester_ign: m.ign,
        old_data: { ign: m.ign, class: m.class, role: m.role },
        new_data: newData,
        status: "pending",
        timestamp: Date.now()
      };
      
      const res = await fetch(`${supabaseUrl}/rest/v1/requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify([req])
      });
      if (!res.ok) throw new Error(`Request submission failed: ${res.status}`);

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
  }, [getAuthHeaders, members, requests, sendDiscordEmbed, showToast]);

  const approveRequest = useCallback(async (requestId) => {
    try {
      const headers = getAuthHeaders();

      const r = requests.find(x => x.id === requestId);
      if (!r) return false;

      // Update Roster in Supabase
      const existingMember = members.find(x => x.memberId === r.member_id);
      const updatedMember = { ...(existingMember || {}), ...r.new_data };
      const rosterPayload = {
        member_id: r.member_id,
        ign: updatedMember.ign || existingMember?.ign,
        class: updatedMember.class || existingMember?.class,
        role: updatedMember.role || existingMember?.role || 'DPS',
        discord: updatedMember.discord || existingMember?.discord || '',
        guild_rank: updatedMember.guildRank || existingMember?.guildRank,
        status: updatedMember.status || 'active',
        level: Number(updatedMember.level || 0),
        cp: Number(updatedMember.cp || 0),
        metadata: updatedMember
      };


      const rosterRes = await fetch(`${supabaseUrl}/rest/v1/roster`, {
        method: 'POST',
        headers: { 
          ...headers,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify([rosterPayload])
      });
      if (!rosterRes.ok) throw new Error(`Roster update failed: ${rosterRes.status}`);

      // Update member in local state
      setMembers(prev => prev.map(m => m.memberId === r.member_id ? { ...m, ...r.new_data } : m));

      // Delete request after approval to keep DB clean (History is in Audit Logs)
      const reqRes = await fetch(`${supabaseUrl}/rest/v1/requests?id=eq.${requestId}`, {
        method: 'DELETE',
        headers
      });
      if (!reqRes.ok) throw new Error(`Request cleanup failed: ${reqRes.status}`);

      setRequests(prev => prev.filter(x => x.id !== requestId));
      sessionStorage.removeItem("requests_cache_v1");
      showToast(`Request approved for ${r.requester_ign}`, 'success');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to approve request', 'error');
      return false;
    }
  }, [getAuthHeaders, requests, members, showToast]);

  const rejectRequest = useCallback(async (requestId) => {
    try {
      const headers = getAuthHeaders();

      const res = await fetch(`${supabaseUrl}/rest/v1/requests?id=eq.${requestId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error(`Rejection/Cleanup failed: ${res.status}`);

      setRequests(prev => prev.filter(r => r.id !== requestId));
      sessionStorage.removeItem("requests_cache_v1");
      showToast('Request rejected and removed', 'info');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to reject request', 'error');
      return false;
    }
  }, [getAuthHeaders, showToast]);

  const deleteRequest = useCallback(async (requestId) => {
    try {
      const headers = getAuthHeaders();

      const res = await fetch(`${supabaseUrl}/rest/v1/requests?id=eq.${requestId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);

      setRequests(prev => prev.filter(r => r.id !== requestId));
      sessionStorage.removeItem("requests_cache_v1");
      showToast('Request deleted from history', 'success');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to delete request', 'error');
      return false;
    }
  }, [getAuthHeaders, showToast]);

  const clearProcessedRequests = useCallback(async () => {
    try {
      const headers = getAuthHeaders();

      const pIds = requests.filter(r => r.status !== 'pending').map(r => r.id);
      const jIds = joinRequests.filter(r => r.status !== 'pending').map(r => r.id);
      
      if (pIds.length === 0 && jIds.length === 0) return true;

      const deleteCalls = [];
      if (pIds.length > 0) {
        deleteCalls.push(fetch(`${supabaseUrl}/rest/v1/requests?id=in.(${pIds.join(',')})`, {
          method: 'DELETE',
          headers
        }));
      }
      if (jIds.length > 0) {
        deleteCalls.push(fetch(`${supabaseUrl}/rest/v1/join_requests?id=in.(${jIds.join(',')})`, {
          method: 'DELETE',
          headers
        }));
      }

      const results = await Promise.all(deleteCalls);
      const failed = results.find(r => !r.ok);
      if (failed) throw new Error(`Clear processed failed with status ${failed.status}`);

      setRequests(prev => prev.filter(r => r.status === 'pending'));
      setJoinRequests(prev => prev.filter(r => r.status === 'pending'));
      sessionStorage.removeItem("requests_cache_v1");
      showToast('Processed history cleared', 'success');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to clear history', 'error');
      return false;
    }
  }, [getAuthHeaders, requests, joinRequests, showToast]);

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

  const submitWishlistRequest = useCallback(async (memberId, resourceType, metadata = {}) => {
    try {
      const headers = getAuthHeaders();

      // GET current bids natively
      const getRes = await fetch(`${supabaseUrl}/rest/v1/auction_bids?member_id=eq.${memberId}&select=*`, {
        headers
      });
      const data = await getRes.json();
      const currentBids = data[0]?.bids || [];

      const newBid = {
        type: resourceType,
        ts: Date.now(),
        status: "pending",
        ...metadata
      };

      const updatedBids = [...currentBids.filter(b => b.type !== resourceType), newBid];
      
      const upsertRes = await fetch(`${supabaseUrl}/rest/v1/auction_bids`, {
        method: 'POST',
        headers: { 
          ...headers,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ member_id: memberId, bids: updatedBids })
      });
      if (!upsertRes.ok) throw new Error(`Wishlist upsert failed: ${upsertRes.status}`);

      setAuctionWishlist(prev => {
        const existing = prev.find(p => p.id === memberId);
        if (existing) return prev.map(p => p.id === memberId ? { id: memberId, bids: updatedBids } : p);
        return [...prev, { id: memberId, bids: updatedBids }];
      });

      return true;
    } catch (err) {
      console.error("Wishlist submission failed:", err);
      return false;
    }
  }, [getAuthHeaders]);

  const updateWishlistMetadata = useCallback(async (memberId, resourceType, metadata) => {
    try {
      const headers = getAuthHeaders();

      const getRes = await fetch(`${supabaseUrl}/rest/v1/auction_bids?member_id=eq.${memberId}&select=*`, {
        headers
      });
      const data = await getRes.json();
      if (!data[0]) return;

      const updatedBids = (data[0].bids || []).map(b => 
        b.type === resourceType ? { ...b, ...metadata } : b
      );

      await fetch(`${supabaseUrl}/rest/v1/auction_bids`, {
        method: 'POST',
        headers: { 
          ...headers, 
          'Prefer': 'resolution=merge-duplicates' 
        },
        body: JSON.stringify({ member_id: memberId, bids: updatedBids })
      });

      setAuctionWishlist(prev => prev.map(p => p.id === memberId ? { id: memberId, bids: updatedBids } : p));
    } catch (err) {
      console.error("Wishlist metadata update failed:", err);
    }
  }, [getAuthHeaders]);

  const removeWishlistRequest = useCallback(async (memberId, resourceType) => {
    try {
      const headers = getAuthHeaders();

      const getRes = await fetch(`${supabaseUrl}/rest/v1/auction_bids?member_id=eq.${memberId}&select=*`, {
        headers
      });
      const data = await getRes.json();
      if (!data[0]) return;

      const updatedBids = (data[0].bids || []).filter(b => b.type !== resourceType);

      await fetch(`${supabaseUrl}/rest/v1/auction_bids`, {
        method: 'POST',
        headers: { 
          ...headers, 
          'Prefer': 'resolution=merge-duplicates' 
        },
        body: JSON.stringify({ member_id: memberId, bids: updatedBids })
      });

      setAuctionWishlist(prev => prev.map(p => p.id === memberId ? { id: memberId, bids: updatedBids } : p));
    } catch (err) {
      console.error("Wishlist removal failed:", err);
    }
  }, [getAuthHeaders]);

  const fetchHistoricalData = React.useCallback(async (startDate = null, endDate = null) => {
    try {
      setIsLoadingHistory(true);

      const sessionStr = localStorage.getItem(storageKey);
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      const accessToken = session?.access_token || supabaseAnonKey;

      let url = `${supabaseUrl}/rest/v1/events?select=*&order=event_date.desc`;
      if (startDate) url += `&event_date=gte.${startDate}`;
      if (endDate) url += `&event_date=lte.${endDate}`;

      const res = await fetch(url, {
        headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${accessToken}` }
      });
      const eventsData = await res.json();

      if (Array.isArray(eventsData)) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- storageKey is a stable string derived from guild config; not reactive
  }, [showToast]);


  const value = React.useMemo(() => ({
    loading, authLoading, currentUser, userRole, myMemberId, isAdmin, isOfficer, isMember, isArchitect, isStatusActive,
    onlineUsers,
    page, setPage,
    toast, setToast, showToast,
    members, setMembers, deleteMember,
    events, setEvents, deleteEvent,
    auctionSessions, setAuctionSessions, deleteAuctionSession,
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
    auctionTemplates, setAuctionTemplates,
    notifications, sendNotification, markNotifRead,
    requests, submitRequest, approveRequest, rejectRequest, deleteRequest, clearProcessedRequests,
    joinRequests, submitJoinRequest, submitReactivationRequest, approveJoinRequest, rejectJoinRequest, deleteJoinRequest,
    discordConfig, setDiscordConfig, sendDiscordEmbed, sendDiscordImage,
    battlelogConfig, setBattlelogConfig,
    resourceCategories, setResourceCategories,
    metadataNotice, setMetadataNotice, metadataActivity, pendingAuctionConflict, resolveAuctionConflict, syncStatus, triggerSyncRetry,
    resetMonthlyScores,
    memberLootStats, auctionWishlist, submitWishlistRequest, removeWishlistRequest, updateWishlistMetadata,
    historicalEvents, historicalAttendance, historicalPerformance, historicalEoRatings, isLoadingHistory, fetchHistoricalData,
    fetchGlobalData, fetchRequests, isFetchingRequests,
    auctionBids, setAuctionBids,
    isOfflineMode, setIsOfflineMode
  }), [
    loading, authLoading, currentUser, userRole, myMemberId, isAdmin, isOfficer, isMember, isArchitect, isStatusActive,
    onlineUsers, page, toast, members, events, auctionSessions, attendance, performance, absences,
    parties, partyNames, raidParties, raidPartyNames, partyOverrides, leagueParties, leaguePartyNames,
    eoRatings, auctionTemplates, notifications, requests, joinRequests, discordConfig, battlelogConfig,
    resourceCategories, metadataNotice, metadataActivity, pendingAuctionConflict, syncStatus,
    memberLootStats, auctionWishlist, historicalEvents, historicalAttendance, historicalPerformance, historicalEoRatings,
    isLoadingHistory, isFetchingRequests, auctionBids, isOfflineMode, showToast, fetchHistoricalData, fetchGlobalData, fetchRequests,
    deleteEvent, deleteAuctionSession, deleteMember,
    approveJoinRequest, approveRequest, clearProcessedRequests, deleteJoinRequest, deleteRequest, markNotifRead, rejectJoinRequest, rejectRequest, removeWishlistRequest, resetMonthlyScores, resolveAuctionConflict, sendDiscordEmbed, sendDiscordImage, sendNotification, submitJoinRequest, submitReactivationRequest, submitRequest, submitWishlistRequest, triggerSyncRetry, updateWishlistMetadata
  ]);

  return (
    <GuildContext.Provider value={value}>
      {children}
    </GuildContext.Provider>
  );
};
