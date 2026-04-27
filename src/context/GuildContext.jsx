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
  const [auctionWishlist] = useState([]);
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
    discordConfig: {},
    battlelogConfig: {}
  });
  const metadataVersions = useRef({ parties: 0, auction: 0, discord: 0, battlelog: 0 });
  const liveAuctionRef = useRef({ auctionSessions: [], auctionTemplates: [], resourceCategories: [] });
  const saveBurstRef = useRef({ lastAt: 0, count: 0 });
  const roleFetchedRef = useRef(false); // Prevents duplicate user_roles queries on login

  const showToast = useCallback((message, type = "success", action = null) => {
    setToast({ message, type, action, key: Date.now() });
  }, []);
  const triggerSyncRetry = () => {
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

  // Auth Listener (Native Supabase Mode)
  useEffect(() => {
    const initAuth = async () => {
      try {
        setAuthLoading(true);
        console.log("Initializing Auth with getSession()...");
        
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        
        if (sessionErr) throw sessionErr;

        if (session) {
          const user = session.user;
          console.log("Session found for user:", user.email);
          setCurrentUser(user);
          
          // Skip if SIGNED_IN handler already fetched the role
          if (!roleFetchedRef.current) {
            roleFetchedRef.current = true;
            const headers = getAuthHeaders();
            const roleRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?uid=eq.${user.id}&select=*`, {
              headers
            });
            
            if (roleRes.ok) {
              const roles = await roleRes.json();
              if (roles && roles[0]) {
                console.log("User role found:", roles[0].role);
                setUserRole(roles[0].role);
                setMyMemberId(roles[0].member_id || null);
              } else {
                // Only perform auto-linking if no manual role exists in user_roles
                const identifier = user.email.split('@')[0].toLowerCase();
                const rosterRes = await fetch(`${supabaseUrl}/rest/v1/roster?or=(discord.ilike.${identifier},ign.ilike.${identifier})&select=*`, { headers });
                
                if (rosterRes.ok) {
                  const rosterMatch = await rosterRes.json();
                  if (rosterMatch && rosterMatch[0]) {
                    const m = rosterMatch[0];
                    const rank = m.guild_rank || "";
                    
                    let newRole = 'member';
                    if (rank.toLowerCase().includes('architect')) newRole = 'architect';
                    else if (['Admin', 'Guild Master', 'Vice Guild Master'].includes(rank)) newRole = 'admin';
                    else if (['Officer', 'Commander', 'Charisma Baby'].includes(rank)) newRole = 'officer';
                    
                    console.log(`Auto-assigning role: ${newRole} for ${user.email} (Matched via roster)`);
                    
                    await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
                      method: 'POST',
                      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                      body: JSON.stringify({
                        uid: user.id,
                        email: user.email,
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
        setCurrentUser(session.user);

        // On actual sign-in (not the initial session load which initAuth handles),
        // fetch the role immediately to avoid the race condition where userRole
        // stays null and the user is briefly redirected to the member profile page.
        if (_event === "SIGNED_IN" && !roleFetchedRef.current) {
          roleFetchedRef.current = true;
          try {
            const headers = getAuthHeaders();
            const roleRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?uid=eq.${session.user.id}&select=*`, { headers });
            if (roleRes.ok) {
              const roles = await roleRes.json();
              if (roles && roles[0]) {
                // Staff account: has an explicit role + member_id
                setUserRole(roles[0].role);
                setMyMemberId(roles[0].member_id || null);
              } else {
                // Regular member: use metadata member_id stored during auto-signup
                const metaMemberId = session.user.user_metadata?.member_id || null;
                if (metaMemberId) {
                  setUserRole('member');
                  setMyMemberId(metaMemberId);
                }
              }
            }
          } catch (err) {
            console.warn("Role fetch on SIGNED_IN failed:", err);
          }
        }

      } else {
        // Reset on sign out so re-login fetches fresh role
        roleFetchedRef.current = false;
        setCurrentUser(null);
        setUserRole(null);
        setMyMemberId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [getAuthHeaders]);


  // Data Loading from Supabase
  const GLOBAL_CACHE_KEY = "global_guild_data_v1";
  const GLOBAL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache

  const fetchGlobalData = useCallback(async (force = false) => {
    if (prevData.current.isFetching) return;
    
    // Check Cache
    if (!force) {
      try {
        const cached = sessionStorage.getItem(GLOBAL_CACHE_KEY);
        if (cached) {
          const { data, fetchedAt } = JSON.parse(cached);
          if (Date.now() - fetchedAt < GLOBAL_CACHE_TTL) {
            console.log("Serving global data from cache...");
            processFetchedData(data.rosterData, data.eventsData, data.absenceData, data.metaData);
            setLoading(false);
            setSyncStatus("synced");
            return;
          }
        }
      } catch (e) { console.warn("Cache read failed", e); }
    }

    try {
      prevData.current.isFetching = true;
      setSyncStatus("loading");
      const t0 = Date.now();
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const cutoffDate = ninetyDaysAgo.toISOString().split("T")[0];

      const headers = getAuthHeaders();

      const [rosterRes, eventsRes, absenceRes, metaRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/roster?select=*`, {
          headers
        }),
        fetch(`${supabaseUrl}/rest/v1/events?select=*&event_date=gte.${cutoffDate}`, {
          headers
        }),
        fetch(`${supabaseUrl}/rest/v1/absences?select=*`, {
          headers
        }),
        fetch(`${supabaseUrl}/rest/v1/metadata?select=*`, {
          headers
        })
      ]);

      const rosterData = await rosterRes.json().catch(() => []);
      const eventsData = await eventsRes.json().catch(() => []);
      const absenceData = await absenceRes.json().catch(() => []);
      const metaData = await metaRes.json().catch(() => []);

      if (rosterRes.status === 403) console.warn("Roster fetch 403 - check RLS");

      processFetchedData(rosterData, eventsData, absenceData, metaData);

      // Save to Cache
      sessionStorage.setItem(GLOBAL_CACHE_KEY, JSON.stringify({
        data: { rosterData, eventsData, absenceData, metaData },
        fetchedAt: Date.now()
      }));

      setSyncStatus("synced");
      console.log("Global fetch completed total:", Date.now() - t0, "ms");
    } catch (err) {
      console.error("Supabase fetch failed:", err);
      setSyncStatus("error");
      showToast("Data sync failed. Some data may be missing.", "error");
    } finally {
      setLoading(false);
      prevData.current.isFetching = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- GLOBAL_CACHE_TTL and processFetchedData are stable constants; adding them would not change behavior
  }, [showToast, getAuthHeaders]);

  const processFetchedData = useCallback((rosterData, eventsData, absenceData, metaData) => {
    if (rosterData) {
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

    if (eventsData) {
      const mappedEvents = eventsData.map(e => ({
        eventId: e.event_id,
        eventDate: e.event_date,
        type: e.type,
        eventType: e.type,
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

    if (metaData) {
      metaData.forEach(m => {
        const d = m.data;
        if (m.key === 'parties') {
          setParties(d.parties || []);
          setPartyNames(d.partyNames || []);
          setRaidParties(d.raidParties || []);
          setRaidPartyNames(d.raidPartyNames || []);
          setPartyOverrides(d.partyOverrides || {});
          setLeagueParties(d.leagueParties || { 
            main: Array.from({ length: 8 }, () => []), 
            sub: Array.from({ length: 8 }, () => []) 
          });
          setLeaguePartyNames(d.leaguePartyNames || { 
            main: Array.from({ length: 8 }, () => ""), 
            sub: Array.from({ length: 8 }, () => "") 
          });
          metadataVersions.current.parties = m.version;
        } else if (m.key === 'auction') {
          setAuctionSessions(d.auctionSessions || []);
          setAuctionTemplates(d.auctionTemplates || []);
          setResourceCategories(d.resourceCategories || ["Card Album", "Light & Dark"]);
          metadataVersions.current.auction = m.version;
        } else if (m.key === 'discord') {
          const config = d.discord ? d.discord : d;
          setDiscordConfig(config || {});
          metadataVersions.current.discord = m.version;
        } else if (m.key === 'battlelog') {
          setBattlelogConfig(d);
          metadataVersions.current.battlelog = m.version;
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!currentUser && !initialData) return;
    fetchGlobalData();
  }, [currentUser, fetchGlobalData, initialData]);

  // Supabase notification poll interval — 5 minutes is sufficient for a guild.
  const NOTIF_POLL_INTERVAL = 5 * 60 * 1000;

  // Notifications Listener (Migrated to Supabase)
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
        const data = await res.json();
        setNotifications(data.map(n => ({ ...n, id: n.id, ts: n.ts, targetId: n.target_id })));
      } catch (err) {
        console.error("Supabase notif fetch error:", err);
      }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, NOTIF_POLL_INTERVAL);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- NOTIF_POLL_INTERVAL is a module constant; getAuthHeaders is stable; adding them would restart the poll interval unnecessarily
  }, [currentUser, authLoading, loading, myMemberId]);

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

      const reqsData = await reqsRes.json();
      const joinData = await joinRes.json();

      setRequests(reqsData || []);
      setJoinRequests(joinData || []);

      // Cache to sessionStorage
      sessionStorage.setItem(REQUESTS_CACHE_KEY, JSON.stringify({
        requests: reqsData || [],
        joinRequests: joinData || [],
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
    if (!currentUser || authLoading || loading || syncStatus === "offline") return;
    if (members.length === 0 && events.length === 0) return;
    
    const saveToSupabase = async () => {
      setSyncStatus("saving");
      try {
        const headers = getAuthHeaders();

        // --- 1. Roster ---
        const prevMemberMap = new Map(
          (prevData.current.members || []).map(m => [m.memberId, JSON.stringify(m)])
        );
        const dirtyMembers = members.filter(m =>
          JSON.stringify(m) !== prevMemberMap.get(m.memberId)
        );
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
        }

        // --- 2. Metadata ---
        const partiesData = { parties, partyNames, raidParties, raidPartyNames, partyOverrides, leagueParties, leaguePartyNames };
        if (JSON.stringify(partiesData) !== JSON.stringify(prevData.current.partiesData)) {
          const res = await fetch(`${supabaseUrl}/rest/v1/metadata`, {
            method: 'POST',
            headers: { 
              ...headers,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ key: 'parties', data: partiesData, updated_at: new Date().toISOString() })
          });
          if (!res.ok) throw new Error(`Parties Save Failed: ${res.status}`);
          prevData.current.partiesData = { ...partiesData };
        }

        const auctionData = { auctionSessions, auctionTemplates, resourceCategories };
        if (JSON.stringify(auctionData) !== JSON.stringify(prevData.current.auctionData)) {
          const res = await fetch(`${supabaseUrl}/rest/v1/metadata`, {
            method: 'POST',
            headers: { 
              ...headers,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ key: 'auction', data: auctionData, updated_at: new Date().toISOString() })
          });
          if (!res.ok) throw new Error(`Auction Save Failed: ${res.status}`);
          prevData.current.auctionData = { ...auctionData };
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
          (prevData.current.events || []).map(e => [e.eventId, JSON.stringify(e)])
        );
        const dirtyEvents = mappedEvents.filter(e =>
          JSON.stringify(e) !== prevEventMap.get(e.eventId)
        );

        if (dirtyEvents.length > 0) {
          const payload = dirtyEvents.map(e => ({
            event_id: e.eventId,
            event_date: e.eventDate,
            type: e.eventType || e.type,
            title: e.title || '',
            auditor: e.battlelogAudit?.assignedIgn || e.auditor || '',
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
            start_date: a.startDate,
            end_date: a.endDate,
            reason: a.reason,
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
              { key: 'parties', data: partiesData },
              { key: 'auction', data: auctionData },
              { key: 'discord', data: { discord: discordConfig } }
            ]
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
  };

  const resetMonthlyScores = async () => {
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
        ign: data.ign,
        class: data.jobClass,
        role: data.role,
        uid: data.uid,
        discord: data.discord,
        status: "pending",
        timestamp: new Date().toISOString()
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
  };

  const submitReactivationRequest = async (data) => {
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
        discord: data.discord,
        ign: data.ign || existing.ign || "Unknown",
        uid,
        jobClass: existing.class || "Unknown",
        role: existing.role || "DPS",
        status: "pending",
        requestType: "reactivation",
        timestamp: new Date().toISOString()
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
  };

  const approveJoinRequest = async (requestId) => {
    try {
      const headers = getAuthHeaders();

      const r = joinRequests.find(x => x.id === requestId);
      if (!r) return;

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

      // 2. Mark request as approved
      const reqRes = await fetch(`${supabaseUrl}/rest/v1/join_requests?id=eq.${requestId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ 
          status: 'approved',
          metadata: {
            ...r,
            accountStatus: "activated",
            activatedAt: new Date().toISOString()
          }
        })
      });
      if (!reqRes.ok) throw new Error(`Request approval failed: ${reqRes.status}`);

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
      fetchGlobalData(true); // Force refresh to clear cache
      fetchRequests(true);
      return true;
    } catch(err) {
      console.error(err);
      showToast("Failed to approve registration", "error");
      return false;
    }
  };

  const rejectJoinRequest = async (requestId) => {
    try {
      const headers = getAuthHeaders();

      const res = await fetch(`${supabaseUrl}/rest/v1/join_requests?id=eq.${requestId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'rejected' })
      });
      if (!res.ok) throw new Error(`Rejection failed: ${res.status}`);

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
  };

  const submitRequest = async (memberId, newData) => {
    try {
      const headers = getAuthHeaders();

      const m = members.find(x => x.memberId === memberId);
      if (!m) return;
      const req = {
        member_id: memberId,
        requester_ign: m.ign,
        old_data: { ign: m.ign, class: m.class, role: m.role },
        new_data: newData,
        status: "pending",
        timestamp: new Date().toISOString()
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
  };

  const approveRequest = async (requestId) => {
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

      // Update request status
      const reqRes = await fetch(`${supabaseUrl}/rest/v1/requests?id=eq.${requestId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'approved' })
      });
      if (!reqRes.ok) throw new Error(`Request update failed: ${reqRes.status}`);

      setRequests(prev => prev.map(x => x.id === requestId ? { ...x, status: 'approved' } : x));
      sessionStorage.removeItem("requests_cache_v1");
      showToast(`Request approved for ${r.requester_ign}`, 'success');
      return true;
    } catch(err) {
      console.error(err);
      showToast('Failed to approve request', 'error');
      return false;
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      const headers = getAuthHeaders();

      const res = await fetch(`${supabaseUrl}/rest/v1/requests?id=eq.${requestId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'rejected' })
      });
      if (!res.ok) throw new Error(`Rejection failed: ${res.status}`);

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
  };

  const clearProcessedRequests = async () => {
    try {
      const headers = getAuthHeaders();

      const processedIds = requests.filter(r => r.status !== 'pending').map(r => r.id);
      if (processedIds.length === 0) return true;

      const res = await fetch(`${supabaseUrl}/rest/v1/requests?id=in.(${processedIds.join(',')})`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error(`Clear processed failed: ${res.status}`);

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

      return true;
    } catch (err) {
      console.error("Wishlist submission failed:", err);
      return false;
    }
  };

  const updateWishlistMetadata = async (memberId, resourceType, metadata) => {
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
    } catch (err) {
      console.error("Wishlist metadata update failed:", err);
    }
  };

  const removeWishlistRequest = async (memberId, resourceType) => {
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
    } catch (err) {
      console.error("Wishlist removal failed:", err);
    }
  };

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- storageKey is a stable string derived from guild config; not reactive
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
    isOfflineMode, setIsOfflineMode
  };

  return (
    <GuildContext.Provider value={value}>
      {children}
    </GuildContext.Provider>
  );
};
