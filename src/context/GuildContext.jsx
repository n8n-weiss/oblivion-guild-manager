import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { db, auth, firebaseConfig } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, writeBatch, onSnapshot, serverTimestamp, Timestamp, runTransaction, query, where, orderBy, limit, documentId, deleteField } from 'firebase/firestore';
import { onAuthStateChanged, getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { runMigration } from '../utils/migration';
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
  const [auctionSessions, setAuctionSessions] = useState([]);
  const [auctionTemplates, setAuctionTemplates] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [requests, setRequests] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [auctionWishlist, setAuctionWishlist] = useState([]);
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
      auction_results: { enabled: true, webhookUrl: "", mentions: {} }
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
  const [resourceCategories, setResourceCategories] = useState(["Card Album", "Light & Dark"]);
  const [onlineUsers, setOnlineUsers] = useState([]); // array of { uid, memberId, displayName, lastSeen }
  const [metadataNotice, setMetadataNotice] = useState(null); // { kind, message, timestamp }
  const [metadataActivity, setMetadataActivity] = useState([]); // recent shared metadata updates
  const [pendingAuctionConflict, setPendingAuctionConflict] = useState(null);
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

  // Refs for tracking changes (to avoid unnecessary writes)
  const prevData = useRef({});
  const metadataVersions = useRef({ parties: 0, auction: 0, discord: 0, battlelog: 0 });
  const liveAuctionRef = useRef({ auctionSessions: [], auctionTemplates: [], resourceCategories: [] });
  const saveBurstRef = useRef({ lastAt: 0, count: 0 });

  const showToast = (message, type = "success", action = null) => {
    setToast({ message, type, action, key: Date.now() });
  };
  const triggerSyncRetry = () => {
    setSyncRetryToken(v => v + 1);
    if (navigator.onLine) setSyncStatus("saving");
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
    discordConfig
  ]);

  // Derive rank from members if myMemberId is set
  const cleanMyId = (myMemberId || "").trim().toLowerCase();
  const myProfile = members.find(m => m.memberId?.trim().toLowerCase() === cleanMyId);
  const myRank = myProfile?.guildRank || "Member";
  const isStatusActive = (myProfile?.status || "active") === "active";
  
  const isArchitect =
    myRank === "System Architect" ||
    myRank === "System Architect (Creator)" ||
    myRank === "Creator" ||
    userRole === "architect";
  const hasAdminRank = ["Guild Master", "Vice Guild Master", "Commander"].includes(myRank) || isArchitect;
  const hasOfficerRank = ["Charisma Baby", "Baby Charisma", "Officer"].includes(myRank) || hasAdminRank;

  const isAdmin = (userRole === "admin" || userRole === "architect" || hasAdminRank) && (isStatusActive || isArchitect);
  const isOfficer = (isAdmin || userRole === "officer" || hasOfficerRank) && (isStatusActive || isArchitect);
  const isMember = (userRole === "member") && (isStatusActive || isArchitect);
  const canSeeRequestData = isOfficer || isAdmin || isArchitect;

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
    const heartbeat = setInterval(writePresence, 10 * 60 * 1000); // every 10 minutes

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

        const legacyMetaSnap = await getDoc(doc(db, "metadata", "current"));
        const legacyMeta = legacyMetaSnap.exists() ? legacyMetaSnap.data() : {};
        const partiesMetaRef = doc(db, "metadata", "parties");
        const auctionMetaRef = doc(db, "metadata", "auction");
        const discordMetaRef = doc(db, "metadata", "discord");
        const battlelogMetaRef = doc(db, "metadata", "battlelog");
        const readOnlyMemberSession = userRole === "member";

        if (!readOnlyMemberSession && legacyMetaSnap.exists()) {
          const [partiesSnap, auctionSnap, discordSnap] = await Promise.all([
            getDoc(partiesMetaRef),
            getDoc(auctionMetaRef),
            getDoc(discordMetaRef)
          ]);
          const battlelogSnap = await getDoc(battlelogMetaRef);
          const legacyVersion = Number(legacyMeta.version || 0);
          const legacyEditor = legacyMeta.lastEditorUid || null;
          const legacyUpdate = legacyMeta.lastUpdate || new Date().toISOString();

          const seedOps = [];
          if (!partiesSnap.exists() && (legacyMeta.parties || legacyMeta.partyNames || legacyMeta.raidParties || legacyMeta.raidPartyNames)) {
            seedOps.push(setDoc(partiesMetaRef, {
              parties: legacyMeta.parties || [],
              partyNames: legacyMeta.partyNames || [],
              raidParties: legacyMeta.raidParties || [],
              raidPartyNames: legacyMeta.raidPartyNames || [],
              version: legacyVersion,
              lastEditorUid: legacyEditor,
              lastUpdate: legacyUpdate
            }, { merge: true }));
          }
          if (!auctionSnap.exists() && (legacyMeta.auctionSessions || legacyMeta.auctionTemplates || legacyMeta.resourceCategories)) {
            seedOps.push(setDoc(auctionMetaRef, {
              auctionSessions: legacyMeta.auctionSessions || [],
              auctionTemplates: legacyMeta.auctionTemplates || [],
              resourceCategories: legacyMeta.resourceCategories || ["Card Album", "Light & Dark"],
              version: legacyVersion,
              lastEditorUid: legacyEditor,
              lastUpdate: legacyUpdate
            }, { merge: true }));
          }
          if (!discordSnap.exists() && legacyMeta.discord) {
            seedOps.push(setDoc(discordMetaRef, {
              discord: legacyMeta.discord || {},
              version: legacyVersion,
              lastEditorUid: legacyEditor,
              lastUpdate: legacyUpdate
            }, { merge: true }));
          }
          if (!battlelogSnap.exists()) {
            seedOps.push(setDoc(battlelogMetaRef, {
              weeklyAssignments: {},
              version: legacyVersion,
              lastEditorUid: legacyEditor,
              lastUpdate: legacyUpdate
            }, { merge: true }));
          }
          if (seedOps.length > 0) {
            await Promise.all(seedOps);
          }
        }

        if (readOnlyMemberSession) {
          metaLoaded = true;
          checkReady();
        }
        let metadataReadyCount = 0;
        const markMetadataReady = () => {
          metadataReadyCount += 1;
          if (metadataReadyCount >= 4 && !metaLoaded) {
            metaLoaded = true;
            checkReady();
          }
        };
        const emitExternalUpdate = (versionKey, nextVersion, lastEditorUid, area) => {
          const prevVersion = Number(metadataVersions.current[versionKey] || 0);
          if (nextVersion > prevVersion) {
            setMetadataActivity(prev => {
              const entry = {
                id: `${versionKey}-${nextVersion}`,
                area,
                by: lastEditorUid || "unknown",
                timestamp: Date.now()
              };
              return [entry, ...prev].slice(0, 8);
            });
          }
          const updatedByOtherOfficer =
            prevVersion > 0 &&
            nextVersion > prevVersion &&
            lastEditorUid &&
            lastEditorUid !== currentUser?.uid;
          if (!updatedByOtherOfficer) return;
          setMetadataNotice({
            kind: "external_update",
            message: `Another officer updated shared settings/data (${area}). Please review latest values before continuing edits.`,
            timestamp: Date.now()
          });
        };

        if (!readOnlyMemberSession) {
          const unsubPartiesMeta = onSnapshot(partiesMetaRef, (snap) => {
            const data = snap.exists() ? snap.data() : {};
          const cloudPartiesRaw = data.parties || [];
          const cloudParties = cloudPartiesRaw.map(p => Array.isArray(p) ? p : (p.members || []));
          const cloudRaidRaw = data.raidParties || [];
          const cloudRaid = cloudRaidRaw.map(p => Array.isArray(p) ? p : (p.members || []));
          const nextVersion = Number(data.version || 0);
          emitExternalUpdate("parties", nextVersion, data.lastEditorUid, "Parties");
          metadataVersions.current.parties = nextVersion;
          setParties(cloudParties);
          setRaidParties(cloudRaid);
          setPartyNames(data.partyNames || []);
          setRaidPartyNames(data.raidPartyNames || []);
          setPartyOverrides(data.partyOverrides || {});
          prevData.current.parties = [...cloudParties];
          prevData.current.raidParties = [...cloudRaid];
          prevData.current.partyNames = [...(data.partyNames || [])];
          prevData.current.raidPartyNames = [...(data.raidPartyNames || [])];
          prevData.current.partyOverrides = { ...(data.partyOverrides || {}) };
          markMetadataReady();
        });
        unsubs.push(unsubPartiesMeta);

        const unsubAuctionMeta = onSnapshot(auctionMetaRef, (snap) => {
          const data = snap.exists() ? snap.data() : {};
          const nextVersion = Number(data.version || 0);
          const incomingSessions = data.auctionSessions || [];
          const incomingTemplates = data.auctionTemplates || [];
          const incomingResources = data.resourceCategories || ["Card Album", "Light & Dark"];
          const prevAuctionVersion = Number(metadataVersions.current.auction || 0);
          const updatedByOtherOfficer =
            prevAuctionVersion > 0 &&
            nextVersion > prevAuctionVersion &&
            data.lastEditorUid &&
            data.lastEditorUid !== currentUser?.uid;
          const localUnsyncedAuctionChanges =
            JSON.stringify(liveAuctionRef.current.auctionSessions) !== JSON.stringify(prevData.current.auctionSessions) ||
            JSON.stringify(liveAuctionRef.current.auctionTemplates) !== JSON.stringify(prevData.current.auctionTemplates) ||
            JSON.stringify(liveAuctionRef.current.resourceCategories) !== JSON.stringify(prevData.current.resourceCategories);
          emitExternalUpdate("auction", nextVersion, data.lastEditorUid, "Auction");
          metadataVersions.current.auction = nextVersion;
          if (updatedByOtherOfficer && localUnsyncedAuctionChanges) {
            const localSessionsCount = (liveAuctionRef.current.auctionSessions || []).length;
            const localTemplatesCount = (liveAuctionRef.current.auctionTemplates || []).length;
            const localResourcesCount = (liveAuctionRef.current.resourceCategories || []).length;
            const localSessionNames = new Set((liveAuctionRef.current.auctionSessions || []).map(s => s?.name).filter(Boolean));
            const remoteSessionNames = new Set((incomingSessions || []).map(s => s?.name).filter(Boolean));
            const sessionNameChanges = Array.from(new Set([
              ...Array.from(localSessionNames).filter(n => !remoteSessionNames.has(n)),
              ...Array.from(remoteSessionNames).filter(n => !localSessionNames.has(n))
            ])).slice(0, 3);
            const localTemplateNames = new Set((liveAuctionRef.current.auctionTemplates || []).map(t => t?.name).filter(Boolean));
            const remoteTemplateNames = new Set((incomingTemplates || []).map(t => t?.name).filter(Boolean));
            const templateNameChanges = Array.from(new Set([
              ...Array.from(localTemplateNames).filter(n => !remoteTemplateNames.has(n)),
              ...Array.from(remoteTemplateNames).filter(n => !localTemplateNames.has(n))
            ])).slice(0, 3);
            setPendingAuctionConflict({
              remote: {
                auctionSessions: incomingSessions,
                auctionTemplates: incomingTemplates,
                resourceCategories: incomingResources
              },
              local: {
                auctionSessions: liveAuctionRef.current.auctionSessions || [],
                auctionTemplates: liveAuctionRef.current.auctionTemplates || [],
                resourceCategories: liveAuctionRef.current.resourceCategories || []
              },
              summary: {
                localSessionsCount,
                remoteSessionsCount: incomingSessions.length,
                localTemplatesCount,
                remoteTemplatesCount: incomingTemplates.length,
                localResourcesCount,
                remoteResourcesCount: incomingResources.length,
                sessionNameChanges,
                templateNameChanges
              },
              version: nextVersion,
              lastEditorUid: data.lastEditorUid,
              timestamp: Date.now()
            });
            setMetadataNotice({
              kind: "auction_conflict",
              message: "Auction changed remotely while you have unsaved local edits. Resolve conflict to continue.",
              timestamp: Date.now()
            });
            markMetadataReady();
            return;
          }
          setPendingAuctionConflict(null);
          setAuctionSessions(incomingSessions);
          setAuctionTemplates(incomingTemplates);
          setResourceCategories(incomingResources);
          prevData.current.auctionSessions = [...incomingSessions];
          prevData.current.auctionTemplates = [...incomingTemplates];
          prevData.current.resourceCategories = [...incomingResources];
          markMetadataReady();
        });
        unsubs.push(unsubAuctionMeta);

        const unsubDiscordMeta = onSnapshot(discordMetaRef, (snap) => {
          const data = snap.exists() ? snap.data() : {};
          const nextVersion = Number(data.version || 0);
          emitExternalUpdate("discord", nextVersion, data.lastEditorUid, "Discord Settings");
          metadataVersions.current.discord = nextVersion;
          const discRaw = data.discord || {};
          const disc = {
            webhookUrl: discRaw.webhookUrl || "",
            masterRoleId: discRaw.masterRoleId || "",
            officerRoleId: discRaw.officerRoleId || "",
            oblivionRoleId: discRaw.oblivionRoleId || "",
            eventTimeText: discRaw.eventTimeText || "7:55 PM – 8:20 PM (GMT+7) Server Time\n8:55 PM – 9:20 PM (GMT+8) Manila Time",
            notifications: {
              join_requests: { enabled: true, webhookUrl: "", mentions: { master: true, officer: true }, ...migrateMentions(discRaw.notifications?.join_requests || discRaw.notifications?.recruitment, "both") },
              welcome: { enabled: true, webhookUrl: "", mentions: { member: true }, ...migrateMentions(discRaw.notifications?.welcome || discRaw.notifications?.recruitment, "member") },
              vanguard: { enabled: true, webhookUrl: "", mentions: { officer: true }, ...migrateMentions(discRaw.notifications?.vanguard, "officer") },
              events: { enabled: true, webhookUrl: "", mentions: {}, ...migrateMentions(discRaw.notifications?.events, "none") },
              event_digest: { enabled: true, webhookUrl: "", mentions: {}, ...migrateMentions(discRaw.notifications?.event_digest, "none") },
              battlelog_reminder: { enabled: true, webhookUrl: "", mentions: { officer: true }, ...migrateMentions(discRaw.notifications?.battlelog_reminder, "officer") },
              absences: { enabled: true, webhookUrl: "", mentions: { officer: true, member: true }, ...migrateMentions(discRaw.notifications?.absences, "member") },
              auction_results: { enabled: true, webhookUrl: "", mentions: {}, ...migrateMentions(discRaw.notifications?.auction_results, "none") }
            },
            templates: {
              new_join: { title: "📝 New Join Request", description: "A new application from **{ign}**!", ...(discRaw.templates?.new_join || {}) },
              welcome: { title: "🎉 New Member Joined!", description: "Welcome **{ign}** to our Guild Portal!", ...(discRaw.templates?.welcome || {}) },
              vanguard: { title: "🛡️ Vanguard Request", description: "Member **{ign}** has submitted a profile update request.", ...(discRaw.templates?.vanguard || {}) },
              event_created: { title: "📅 New Event Scheduled: {type}", description: "A new **{type}** event has been scheduled for **{date}**. Please check your attendance.", ...(discRaw.templates?.event_created || {}) },
              event_digest: { title: "📊 Post-Event Digest ({type})", description: "Top 10 DPS, Top 10 Support/Utility, and Top 10 Attendance snapshot for **{date}**.", ...(discRaw.templates?.event_digest || {}) },
              battlelog_reminder: { title: "📘 Battlelog Reminder ({type})", description: "Assigned auditor **{auditor}** — please submit battlelog for **{date}**.", ...(discRaw.templates?.battlelog_reminder || {}) },
              absence_filed: { title: "🚨 New Absence Filed", description: "Si **{ign}** ay nag-file ng absence.", ...(discRaw.templates?.absence_filed || {}) },
              absence_removed: { title: "✅ Absence Removed", description: "Ang absence record ni **{ign}** ay binura.", ...(discRaw.templates?.absence_removed || {}) },
              auction_results: {
                title: "🏛️ Auction Table Results",
                description: "Loot session results for **{name}** have been finalized! 🏛️💎\n\n📖 **Legend:**\n• **P1** = Full Page 1 (Bulk Win)\n• **P1R1** = Page 1, Row 1 (Individual Slot)",
                ...(discRaw.templates?.auction_results || {})
              }
            }
          };
          if (JSON.stringify(disc) !== JSON.stringify(prevData.current.discordConfig)) {
            setDiscordConfig(disc);
            prevData.current.discordConfig = { ...disc };
          }
          markMetadataReady();
        });
        unsubs.push(unsubDiscordMeta);

        const unsubBattlelogMeta = onSnapshot(battlelogMetaRef, (snap) => {
          const data = snap.exists() ? snap.data() : {};
          const nextVersion = Number(data.version || 0);
          emitExternalUpdate("battlelog", nextVersion, data.lastEditorUid, "Battlelog Scheduler");
          metadataVersions.current.battlelog = nextVersion;
          const nextCfg = {
            weeklyAssignments: data.weeklyAssignments || {},
            rotationPoolMemberIds: Array.isArray(data.rotationPoolMemberIds) ? data.rotationPoolMemberIds : [],
            lastEditorUid: data.lastEditorUid || null,
            lastUpdate: data.lastUpdate || null
          };
          if (JSON.stringify(nextCfg) !== JSON.stringify(prevData.current.battlelogConfig)) {
            setBattlelogConfig(nextCfg);
            prevData.current.battlelogConfig = { ...nextCfg, weeklyAssignments: { ...(nextCfg.weeklyAssignments || {}) } };
          }
          markMetadataReady();
        });
        unsubs.push(unsubBattlelogMeta);
        }

        const notifQuery = myMemberId
          ? query(
              collection(db, "notifications"),
              where("targetId", "in", ["all", myMemberId]),
              orderBy("ts", "desc"),
              limit(120)
            )
          : query(collection(db, "notifications"), orderBy("ts", "desc"), limit(120));
        const unsubNotifs = onSnapshot(notifQuery, (snap) => {
          const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
          setNotifications(docs);
        });
        unsubs.push(unsubNotifs);

        if (canSeeRequestData) {
          const unsubReqs = onSnapshot(
            query(collection(db, "requests"), orderBy("timestamp", "desc"), limit(200)),
            (snap) => {
              const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
              setRequests(docs);
            }
          );
          unsubs.push(unsubReqs);

          const unsubJoinReqs = onSnapshot(
            query(collection(db, "join_requests"), orderBy("timestamp", "desc"), limit(200)),
            (snap) => {
              const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
              setJoinRequests(docs);
            }
          );
          unsubs.push(unsubJoinReqs);
          setJoinRequests([]);
        }

        // Loot Wishlist Listener
        const unsubAuctionWishlist = onSnapshot(
          collection(db, "auction_bids"),
          (snap) => {
            const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setAuctionWishlist(docs);
          }
        );
        unsubs.push(unsubAuctionWishlist);

      } catch (err) {
        console.error("Listener setup error:", err);
        setLoading(false);
      }
    };
    setupListeners();
    return () => { unsubs.forEach(u => u()); };
  }, [initialData, currentUser, userRole, myMemberId, canSeeRequestData]);

  // Heavy listeners are attached only on pages that need them to reduce Firestore reads on free tier.
  useEffect(() => {
    if ((!currentUser && !initialData) || !needsBattleData) return;
    const unsubs = [];
    const sourceEvents = events.length ? events : (initialData?.INITIAL_EVENTS || []);
    const eventIds = Array.from(new Set(sourceEvents.map(e => e?.eventId).filter(Boolean)));
    const monthKeys = Array.from(new Set(
      sourceEvents
        .map(e => String(e?.eventDate || "").slice(0, 7))
        .filter(Boolean)
    ));
    if (eventIds.length === 0) {
      if (prevData.current.attendance?.length) {
        setAttendance([]);
        prevData.current.attendance = [];
      }
      if (prevData.current.performance?.length) {
        setPerformance([]);
        prevData.current.performance = [];
      }
      if (prevData.current.eoRatings?.length) {
        setEoRatings([]);
        prevData.current.eoRatings = [];
      }
      return () => {};
    }
    const chunkSize = 10;
    const chunks = [];
    for (let i = 0; i < eventIds.length; i += chunkSize) {
      chunks.push(eventIds.slice(i, i + chunkSize));
    }
    const monthChunks = [];
    for (let i = 0; i < monthKeys.length; i += chunkSize) {
      monthChunks.push(monthKeys.slice(i, i + chunkSize));
    }
    const flattenSnapshotStores = (stores) => {
      const out = [];
      stores.forEach((arr) => out.push(...arr));
      return out;
    };
    const mergePreferBuckets = (legacyFlat, bucketFlat) => {
      const merged = new Map();
      legacyFlat.forEach((item) => {
        merged.set(`${item.eventId}__${item.memberId}`, item);
      });
      bucketFlat.forEach((item) => {
        merged.set(`${item.eventId}__${item.memberId}`, item);
      });
      return Array.from(merged.values());
    };

    const attendanceStores = new Map();
    const attendanceBucketStores = new Map();
    const emitAttendance = () => {
      const legacyFlat = flattenSnapshotStores(attendanceStores);
      const bucketFlat = flattenSnapshotStores(attendanceBucketStores);
      const merged = mergePreferBuckets(legacyFlat, bucketFlat);
      if (JSON.stringify(merged) !== JSON.stringify(prevData.current.attendance)) {
        setAttendance(merged);
        prevData.current.attendance = [...merged];
      }
    };
    chunks.forEach((ids, idx) => {
      const q = query(collection(db, "attendance"), where(documentId(), "in", ids));
      const unsubAtt = onSnapshot(q, (snap) => {
        const flat = [];
        snap.docs.forEach(d => {
          const { eventId, members: attMembers } = d.data();
          Object.entries(attMembers || {}).forEach(([memberId, status]) => {
            flat.push({ eventId, memberId, status });
          });
        });
        attendanceStores.set(idx, flat);
        emitAttendance();
      });
      unsubs.push(unsubAtt);
    });
    monthChunks.forEach((months, idx) => {
      const q = query(collection(db, "attendanceBuckets"), where("month", "in", months));
      const unsubAttBucket = onSnapshot(q, (snap) => {
        const flat = [];
        snap.docs.forEach(d => {
          const { eventId, members: attMembers } = d.data();
          if (!eventId || !eventIds.includes(eventId)) return;
          Object.entries(attMembers || {}).forEach(([memberId, status]) => {
            flat.push({ eventId, memberId, status });
          });
        });
        attendanceBucketStores.set(idx, flat);
        emitAttendance();
      });
      unsubs.push(unsubAttBucket);
    });

    const performanceStores = new Map();
    const performanceBucketStores = new Map();
    const emitPerformance = () => {
      const legacyFlat = flattenSnapshotStores(performanceStores);
      const bucketFlat = flattenSnapshotStores(performanceBucketStores);
      const merged = mergePreferBuckets(legacyFlat, bucketFlat);
      if (JSON.stringify(merged) !== JSON.stringify(prevData.current.performance)) {
        setPerformance(merged);
        prevData.current.performance = [...merged];
      }
    };
    chunks.forEach((ids, idx) => {
      const q = query(collection(db, "performance"), where(documentId(), "in", ids));
      const unsubPerf = onSnapshot(q, (snap) => {
        const flat = [];
        snap.docs.forEach(d => {
          const { eventId, members: perfMembers } = d.data();
          Object.entries(perfMembers || {}).forEach(([memberId, pData]) => {
            flat.push({ ...pData, eventId, memberId });
          });
        });
        performanceStores.set(idx, flat);
        emitPerformance();
      });
      unsubs.push(unsubPerf);
    });
    monthChunks.forEach((months, idx) => {
      const q = query(collection(db, "performanceBuckets"), where("month", "in", months));
      const unsubPerfBucket = onSnapshot(q, (snap) => {
        const flat = [];
        snap.docs.forEach(d => {
          const { eventId, members: perfMembers } = d.data();
          if (!eventId || !eventIds.includes(eventId)) return;
          Object.entries(perfMembers || {}).forEach(([memberId, pData]) => {
            flat.push({ ...pData, eventId, memberId });
          });
        });
        performanceBucketStores.set(idx, flat);
        emitPerformance();
      });
      unsubs.push(unsubPerfBucket);
    });

    const eoStores = new Map();
    const eoBucketStores = new Map();
    const emitEo = () => {
      const legacyFlat = flattenSnapshotStores(eoStores);
      const bucketFlat = flattenSnapshotStores(eoBucketStores);
      const merged = mergePreferBuckets(legacyFlat, bucketFlat);
      if (JSON.stringify(merged) !== JSON.stringify(prevData.current.eoRatings)) {
        setEoRatings(merged);
        prevData.current.eoRatings = [...merged];
      }
    };
    chunks.forEach((ids, idx) => {
      const q = query(collection(db, "eoRatings"), where(documentId(), "in", ids));
      const unsubEo = onSnapshot(q, (snap) => {
        const flat = [];
        snap.docs.forEach(d => {
          const { eventId, ratings: eoRatingsMap } = d.data();
          Object.entries(eoRatingsMap || {}).forEach(([memberId, rating]) => {
            flat.push({ eventId, memberId, rating });
          });
        });
        eoStores.set(idx, flat);
        emitEo();
      });
      unsubs.push(unsubEo);
    });
    monthChunks.forEach((months, idx) => {
      const q = query(collection(db, "eoRatingsBuckets"), where("month", "in", months));
      const unsubEoBucket = onSnapshot(q, (snap) => {
        const flat = [];
        snap.docs.forEach(d => {
          const { eventId, ratings: eoRatingsMap } = d.data();
          if (!eventId || !eventIds.includes(eventId)) return;
          Object.entries(eoRatingsMap || {}).forEach(([memberId, rating]) => {
            flat.push({ eventId, memberId, rating });
          });
        });
        eoBucketStores.set(idx, flat);
        emitEo();
      });
      unsubs.push(unsubEoBucket);
    });

    return () => { unsubs.forEach(u => u()); };
  }, [currentUser, initialData, needsBattleData, events]);

  useEffect(() => {
    if ((!currentUser && !initialData) || !needsPresenceData) return;
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
    return () => unsubPresence();
  }, [currentUser, initialData, needsPresenceData]);

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

  useEffect(() => {
    if (loading) return;
    const saveData = async () => {
      try {
        if (!navigator.onLine) {
          prevData.current.pendingSync = true;
          setSyncStatus("offline");
          return;
        }
        const batch = writeBatch(db);
        let changesCount = 0;
        let wroteMetadata = false;
        const eventMonthMap = new Map([
          ...prevData.current.events.map(e => [e.eventId, String(e?.eventDate || "").slice(0, 7)]),
          ...events.map(e => [e.eventId, String(e?.eventDate || "").slice(0, 7)])
        ]);
        const hasMetadataPartiesChanges =
          JSON.stringify(parties) !== JSON.stringify(prevData.current.parties) ||
          JSON.stringify(partyNames) !== JSON.stringify(prevData.current.partyNames) ||
          JSON.stringify(raidParties) !== JSON.stringify(prevData.current.raidParties) ||
          JSON.stringify(raidPartyNames) !== JSON.stringify(prevData.current.raidPartyNames) ||
          JSON.stringify(partyOverrides) !== JSON.stringify(prevData.current.partyOverrides);
        const hasMetadataAuctionChanges =
          JSON.stringify(auctionSessions) !== JSON.stringify(prevData.current.auctionSessions) ||
          JSON.stringify(auctionTemplates) !== JSON.stringify(prevData.current.auctionTemplates) ||
          JSON.stringify(resourceCategories) !== JSON.stringify(prevData.current.resourceCategories);
        const hasMetadataDiscordChanges =
          JSON.stringify(discordConfig) !== JSON.stringify(prevData.current.discordConfig);
        const hasMetadataBattlelogChanges =
          JSON.stringify(battlelogConfig) !== JSON.stringify(prevData.current.battlelogConfig);
        const hasAnyMetadataChanges = hasMetadataPartiesChanges || hasMetadataAuctionChanges || hasMetadataDiscordChanges || hasMetadataBattlelogChanges;

        if (
          JSON.stringify(members) !== JSON.stringify(prevData.current.members) ||
          JSON.stringify(events) !== JSON.stringify(prevData.current.events) ||
          JSON.stringify(attendance) !== JSON.stringify(prevData.current.attendance) ||
          JSON.stringify(performance) !== JSON.stringify(prevData.current.performance) ||
          JSON.stringify(eoRatings) !== JSON.stringify(prevData.current.eoRatings) ||
          JSON.stringify(absences) !== JSON.stringify(prevData.current.absences) ||
          hasAnyMetadataChanges
        ) {
          setSyncStatus("saving");
        }
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
              const eventMonth = eventMonthMap.get(eid);
              if (eventMonth) {
                batch.delete(doc(db, "attendanceBuckets", `${eventMonth}_${eid}`));
                batch.delete(doc(db, "performanceBuckets", `${eventMonth}_${eid}`));
                batch.delete(doc(db, "eoRatingsBuckets", `${eventMonth}_${eid}`));
              }
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
            const cleanMid = (a.memberId || "").trim();
            if (cleanMid) grouped[a.eventId][cleanMid] = a.status;
          });
          Object.keys(grouped).forEach(eid => {
            batch.set(doc(db, "attendance", eid), { eventId: eid, members: grouped[eid] });
            const month = eventMonthMap.get(eid);
            if (month) {
              batch.set(doc(db, "attendanceBuckets", `${month}_${eid}`), { eventId: eid, month, members: grouped[eid] });
            }
          });
          prevData.current.attendance = [...attendance];
          changesCount++;
        }
        if (JSON.stringify(performance) !== JSON.stringify(prevData.current.performance)) {
          const grouped = {};
          performance.forEach(p => {
            if (!grouped[p.eventId]) grouped[p.eventId] = {};
            const cleanMid = (p.memberId || "").trim();
            if (cleanMid) grouped[p.eventId][cleanMid] = { ...p, memberId: cleanMid };
          });
          Object.keys(grouped).forEach(eid => {
            batch.set(doc(db, "performance", eid), { eventId: eid, members: grouped[eid] });
            const month = eventMonthMap.get(eid);
            if (month) {
              batch.set(doc(db, "performanceBuckets", `${month}_${eid}`), { eventId: eid, month, members: grouped[eid] });
            }
          });
          prevData.current.performance = [...performance];
          changesCount++;
        }
        if (JSON.stringify(eoRatings) !== JSON.stringify(prevData.current.eoRatings)) {
          const grouped = {};
          eoRatings.forEach(r => {
            if (!grouped[r.eventId]) grouped[r.eventId] = {};
            const cleanMid = (r.memberId || "").trim();
            if (cleanMid) grouped[r.eventId][cleanMid] = r.rating;
          });
          Object.keys(grouped).forEach(eid => {
            batch.set(doc(db, "eoRatings", eid), { eventId: eid, ratings: grouped[eid] });
            const month = eventMonthMap.get(eid);
            if (month) {
              batch.set(doc(db, "eoRatingsBuckets", `${month}_${eid}`), { eventId: eid, month, ratings: grouped[eid] });
            }
          });
          prevData.current.eoRatings = [...eoRatings];
          changesCount++;
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
        const runMetadataSave = async (docId, baseVersion, payload) => {
          const metadataRef = doc(db, "metadata", docId);
          return runTransaction(db, async (tx) => {
            const snap = await tx.get(metadataRef);
            const remote = snap.exists() ? snap.data() : {};
            const remoteVersion = Number(remote.version || 0);
            if (remoteVersion !== baseVersion) {
              throw new Error("META_VERSION_CONFLICT");
            }
            const updatedVersion = remoteVersion + 1;
            tx.set(metadataRef, { ...payload, version: updatedVersion }, { merge: true });
            return updatedVersion;
          });
        };

        if (hasMetadataPartiesChanges) {
          const wrappedParties = parties.map(p => ({ members: p }));
          const wrappedRaids = raidParties.map(p => ({ members: p }));
          const nextVersion = await runMetadataSave("parties", Number(metadataVersions.current.parties || 0), {
            parties: wrappedParties,
            partyNames,
            raidParties: wrappedRaids,
            raidPartyNames,
            partyOverrides,
            lastUpdate: new Date().toISOString(),
            lastEditorUid: currentUser?.uid || null
          });
          metadataVersions.current.parties = nextVersion;
          prevData.current.parties = [...parties];
          prevData.current.partyNames = [...partyNames];
          prevData.current.raidParties = [...raidParties];
          prevData.current.raidPartyNames = [...raidPartyNames];
          prevData.current.partyOverrides = { ...partyOverrides };
          wroteMetadata = true;
        }
        if (hasMetadataAuctionChanges) {
          const nextVersion = await runMetadataSave("auction", Number(metadataVersions.current.auction || 0), {
            auctionSessions,
            auctionTemplates,
            resourceCategories,
            lastUpdate: new Date().toISOString(),
            lastEditorUid: currentUser?.uid || null
          });
          metadataVersions.current.auction = nextVersion;
          prevData.current.auctionSessions = [...auctionSessions];
          prevData.current.auctionTemplates = [...auctionTemplates];
          prevData.current.resourceCategories = [...resourceCategories];
          wroteMetadata = true;
        }
        if (hasMetadataDiscordChanges) {
          const nextVersion = await runMetadataSave("discord", Number(metadataVersions.current.discord || 0), {
            discord: discordConfig,
            lastUpdate: new Date().toISOString(),
            lastEditorUid: currentUser?.uid || null
          });
          metadataVersions.current.discord = nextVersion;
          prevData.current.discordConfig = { ...discordConfig };
          wroteMetadata = true;
        }
        if (hasMetadataBattlelogChanges) {
          const nextVersion = await runMetadataSave("battlelog", Number(metadataVersions.current.battlelog || 0), {
            weeklyAssignments: battlelogConfig?.weeklyAssignments || {},
            rotationPoolMemberIds: Array.isArray(battlelogConfig?.rotationPoolMemberIds) ? battlelogConfig.rotationPoolMemberIds : [],
            lastUpdate: new Date().toISOString(),
            lastEditorUid: currentUser?.uid || null
          });
          metadataVersions.current.battlelog = nextVersion;
          prevData.current.battlelogConfig = {
            weeklyAssignments: { ...(battlelogConfig?.weeklyAssignments || {}) },
            rotationPoolMemberIds: Array.isArray(battlelogConfig?.rotationPoolMemberIds) ? [...battlelogConfig.rotationPoolMemberIds] : [],
            lastEditorUid: battlelogConfig?.lastEditorUid || null,
            lastUpdate: battlelogConfig?.lastUpdate || null
          };
          wroteMetadata = true;
        }

        if (changesCount > 0 || wroteMetadata) {
          prevData.current.pendingSync = false;
          setSyncStatus("synced");
        }
      } catch (err) {
        prevData.current.pendingSync = true;
        setSyncStatus(navigator.onLine ? "error" : "offline");
        if (err?.message === "META_VERSION_CONFLICT") {
          setMetadataNotice({
            kind: "save_conflict",
            message: "Your save was blocked because newer shared changes exist. Latest metadata has been loaded.",
            timestamp: Date.now()
          });
          showToast("Another officer saved changes first. Reloaded latest metadata to avoid overwrite.", "warning");
          return;
        }
        console.error("Firebase save error:", err);
      }
    };
    const burstCount = Number(saveBurstRef.current.count || 1);
    const debounceMs = burstCount >= 5 ? 2200 : burstCount >= 3 ? 1600 : 1000;
    const timeout = setTimeout(saveData, debounceMs);
    return () => clearTimeout(timeout);
  }, [members, events, attendance, performance, absences, parties, partyNames, eoRatings, auctionSessions, auctionTemplates, raidParties, raidPartyNames, partyOverrides, discordConfig, battlelogConfig, resourceCategories, currentUser?.uid, loading, syncRetryToken]);

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

  const restoreBackupSnapshot = async (payload, mode = "replace") => {
    if (!isArchitect) throw new Error("FORBIDDEN");
    if (!payload || typeof payload !== "object") throw new Error("INVALID_PAYLOAD");
    const roster = Array.isArray(payload.roster) ? payload.roster : [];
    const eventsData = Array.isArray(payload.events) ? payload.events : [];
    const absencesData = Array.isArray(payload.absences) ? payload.absences : [];
    const metadata = payload.metadata || {};

    if (mode === "replace") {
      const [oldRoster, oldEvents, oldAbsences] = await Promise.all([
        getDocs(collection(db, "roster")),
        getDocs(collection(db, "events")),
        getDocs(collection(db, "absences"))
      ]);
      const clearBatch = writeBatch(db);
      oldRoster.docs.forEach(d => clearBatch.delete(doc(db, "roster", d.id)));
      oldEvents.docs.forEach(d => clearBatch.delete(doc(db, "events", d.id)));
      oldAbsences.docs.forEach(d => clearBatch.delete(doc(db, "absences", d.id)));
      await clearBatch.commit();
    }

    const writeInChunks = async (ops) => {
      for (let i = 0; i < ops.length; i += 400) {
        const b = writeBatch(db);
        ops.slice(i, i + 400).forEach(fn => fn(b));
        await b.commit();
      }
    };

    const ops = [];
    roster.forEach(m => {
      if (m?.memberId) ops.push((b) => b.set(doc(db, "roster", m.memberId), m));
    });
    eventsData.forEach(e => {
      if (e?.eventId) ops.push((b) => b.set(doc(db, "events", e.eventId), e));
    });
    absencesData.forEach(a => {
      if (a?.id) ops.push((b) => b.set(doc(db, "absences", a.id), a));
    });
    await writeInChunks(ops);

    await Promise.all([
      setDoc(doc(db, "metadata", "parties"), metadata.parties || {}, { merge: true }),
      setDoc(doc(db, "metadata", "auction"), metadata.auction || {}, { merge: true }),
      setDoc(doc(db, "metadata", "discord"), metadata.discord || {}, { merge: true })
    ]);
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

  const backfillBattleBuckets = async () => {
    const [eventsSnap, attSnap, perfSnap, eoSnap] = await Promise.all([
      getDocs(collection(db, "events")),
      getDocs(collection(db, "attendance")),
      getDocs(collection(db, "performance")),
      getDocs(collection(db, "eoRatings"))
    ]);
    const eventMonthMap = new Map();
    eventsSnap.docs.forEach((d) => {
      const ev = d.data();
      if (ev?.eventId) eventMonthMap.set(ev.eventId, String(ev?.eventDate || "").slice(0, 7));
    });
    const ops = [];
    attSnap.docs.forEach((d) => {
      const payload = d.data();
      const eventId = payload?.eventId || d.id;
      const month = eventMonthMap.get(eventId);
      if (!eventId || !month) return;
      ops.push((b) => b.set(doc(db, "attendanceBuckets", `${month}_${eventId}`), { eventId, month, members: payload?.members || {} }, { merge: true }));
    });
    perfSnap.docs.forEach((d) => {
      const payload = d.data();
      const eventId = payload?.eventId || d.id;
      const month = eventMonthMap.get(eventId);
      if (!eventId || !month) return;
      ops.push((b) => b.set(doc(db, "performanceBuckets", `${month}_${eventId}`), { eventId, month, members: payload?.members || {} }, { merge: true }));
    });
    eoSnap.docs.forEach((d) => {
      const payload = d.data();
      const eventId = payload?.eventId || d.id;
      const month = eventMonthMap.get(eventId);
      if (!eventId || !month) return;
      ops.push((b) => b.set(doc(db, "eoRatingsBuckets", `${month}_${eventId}`), { eventId, month, ratings: payload?.ratings || {} }, { merge: true }));
    });
    for (let i = 0; i < ops.length; i += 400) {
      const b = writeBatch(db);
      ops.slice(i, i + 400).forEach(fn => fn(b));
      await b.commit();
    }
    return { totalBucketDocs: ops.length };
  };
  const estimateBattleBucketBackfill = async () => {
    if (!isArchitect) throw new Error("FORBIDDEN");
    const [eventsSnap, attSnap, perfSnap, eoSnap] = await Promise.all([
      getDocs(collection(db, "events")),
      getDocs(collection(db, "attendance")),
      getDocs(collection(db, "performance")),
      getDocs(collection(db, "eoRatings"))
    ]);
    const eventMonthMap = new Map();
    eventsSnap.docs.forEach((d) => {
      const ev = d.data();
      if (ev?.eventId) eventMonthMap.set(ev.eventId, String(ev?.eventDate || "").slice(0, 7));
    });
    let attendanceEligible = 0;
    let performanceEligible = 0;
    let eoEligible = 0;
    attSnap.docs.forEach((d) => {
      const payload = d.data();
      const eventId = payload?.eventId || d.id;
      if (eventId && eventMonthMap.get(eventId)) attendanceEligible += 1;
    });
    perfSnap.docs.forEach((d) => {
      const payload = d.data();
      const eventId = payload?.eventId || d.id;
      if (eventId && eventMonthMap.get(eventId)) performanceEligible += 1;
    });
    eoSnap.docs.forEach((d) => {
      const payload = d.data();
      const eventId = payload?.eventId || d.id;
      if (eventId && eventMonthMap.get(eventId)) eoEligible += 1;
    });
    return {
      attendanceEligible,
      performanceEligible,
      eoEligible,
      totalBucketDocs: attendanceEligible + performanceEligible + eoEligible
    };
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

  const migrateMemberData = async (oldId, newId) => {
    if (!oldId || !newId) return { success: false, message: "Invalid IDs provided." };
    const batch = writeBatch(db);
    let count = 0;
    
    // Scan all event-based collections where member participation is stored as map keys
    const collections = [
      { name: "attendance", dataKey: "members" },
      { name: "attendanceBuckets", dataKey: "members" },
      { name: "performance", dataKey: "members" },
      { name: "performanceBuckets", dataKey: "members" },
      { name: "eoRatings", dataKey: "ratings" },
      { name: "eoRatingsBuckets", dataKey: "ratings" }
    ];

    try {
      for (const colInfo of collections) {
        const snap = await getDocs(collection(db, colInfo.name));
        snap.forEach(d => {
          const data = d.data();
          const map = data[colInfo.dataKey] || {};
          
          const targetKey = Object.keys(map).find(k => k.trim().toLowerCase() === oldId.trim().toLowerCase());
          
          if (targetKey) {
            const val = map[targetKey];
            batch.update(d.ref, {
              [`${colInfo.dataKey}.${newId}`]: val,
              [`${colInfo.dataKey}.${targetKey}`]: deleteField()
            });
            count++;
          }
        });
      }

      // Step 2: Update individual account mappings (userroles)
      const urSnap = await getDocs(collection(db, "userroles"));
      urSnap.forEach(d => {
        const data = d.data();
        if ((data.memberId || "").trim().toLowerCase() === oldId.trim().toLowerCase()) {
          batch.update(d.ref, { memberId: newId });
          count++;
        }
      });

      // Step 3: Update centralized user registry (guildusers/list)
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
      return false;
    }
  };

  const updateWishlistMetadata = async (memberId, resourceType, metadata) => {
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
    }
  };

  const removeWishlistRequest = async (memberId, resourceType) => {
    try {
      const bidRef = doc(db, "auction_bids", memberId);
      const snap = await getDoc(bidRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const updatedBids = (data.bids || []).filter(b => b.type !== resourceType);
      await setDoc(bidRef, { memberId, bids: updatedBids });
    } catch (err) {
      console.error("Wishlist removal failed:", err);
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
    partyOverrides, setPartyOverrides,
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
    resetDatabase, exportBackupSnapshot, restoreBackupSnapshot, backfillBattleBuckets, estimateBattleBucketBackfill,
    resetMonthlyScores,
    memberLootStats, auctionWishlist, submitWishlistRequest, removeWishlistRequest, updateWishlistMetadata


  };

  return (
    <GuildContext.Provider value={value}>
      {children}
    </GuildContext.Provider>
  );
};
