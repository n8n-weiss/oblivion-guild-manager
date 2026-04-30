import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./supabase";
import { useGuild } from "./context/GuildContext";
import { NAV_ITEMS, JOB_CLASSES } from "./utils/constants";

// Styles & UI
import "./styles/index.css";
import Icon from "./components/ui/icons";
import Toast from "./components/ui/Toast";
import PageErrorBoundary from "./components/common/PageErrorBoundary";
import Modal from "./components/ui/Modal";

import TreasuryModal from "./components/common/TreasuryModal";
import { NotificationCenter } from "./components/common/NotificationCenter";
import { CardSkeleton } from "./components/ui/Skeleton";
import DashboardSkeleton from "./components/dashboard/DashboardSkeleton";

const lazyWithRetry = (importer, key) =>
  React.lazy(async () => {
    try {
      return await importer();
    } catch (err) {
      const shouldReload =
        typeof window !== "undefined" &&
        /Failed to fetch dynamically imported module|Loading chunk/i.test(String(err?.message || err));
      const reloadKey = `lazy-retry-${key}`;
      if (shouldReload && sessionStorage.getItem(reloadKey) !== "1") {
        sessionStorage.setItem(reloadKey, "1");
        sessionStorage.setItem("lazy-retry-notice", "1");
        window.location.reload();
        // Keep Suspense pending while reload starts.
        return new Promise(() => {});
      }
      sessionStorage.removeItem(reloadKey);
      throw err;
    }
  });

import Dashboard from "./pages/Dashboard";
const MembersPage = lazyWithRetry(() => import("./pages/MembersPage"), "members");
const EventsPage = lazyWithRetry(() => import("./pages/EventsPage"), "events");
const AbsencesPage = lazyWithRetry(() => import("./pages/AbsencesPage"), "absences");
const MemberProfilePage = lazyWithRetry(() => import("./pages/MemberProfilePage"), "member-profile");
const AuctionBuilder = lazyWithRetry(() => import("./pages/AuctionBuilder"), "auction");
const ImportPage = lazyWithRetry(() => import("./pages/ImportPage"), "import");
const AuditLogPage = lazyWithRetry(() => import("./pages/AuditLogPage"), "auditlog");
const LoginPage = lazyWithRetry(() => import("./pages/LoginPage"), "login");
const UserManagementPage = lazyWithRetry(() => import("./pages/UserManagementPage"), "users");
const RequestsPage = lazyWithRetry(() => import("./pages/RequestsPage"), "requests");
const MotionDiv = motion.div;
const pagePrefetchers = {
  dashboard: () => import("./pages/Dashboard"),
  members: () => import("./pages/MembersPage"),
  "member-profile": () => import("./pages/MemberProfilePage"),
  events: () => import("./pages/EventsPage"),
  absences: () => import("./pages/AbsencesPage"),
  import: () => import("./pages/ImportPage"),
  auction: () => import("./pages/AuctionBuilder"),
  users: () => import("./pages/UserManagementPage"),
  auditlog: () => import("./pages/AuditLogPage"),
  requests: () => import("./pages/RequestsPage")
};
const prefetchedPages = new Set();

// --- Helper Components for Premium UI ---
const SyncPill = ({ status, onRetry }) => {
  const isSyncing = status === 'syncing';
  const isError = status === 'error';
  const isOffline = status === 'offline';
  
  return (
    <div className="fixed bottom-6 right-6 z-[200] animate-float" style={{ animationDelay: '1s' }}>
      <div className="premium-pill glass-panel" style={{ padding: '8px 16px', gap: 10 }}>
        <div className={`status-dot ${isSyncing ? 'animate-pulse' : ''}`} style={{ 
          background: isError ? '#ef4444' : isSyncing || isOffline ? '#f59e0b' : '#10b981',
          boxShadow: `0 0 12px ${isError ? '#ef4444' : isSyncing || isOffline ? '#f59e0b' : '#10b981'}`
        }} />
        <span style={{ color: 'var(--text-primary)', fontSize: 10 }}>
          {isSyncing ? 'CLOUD SYNCING...' : isError ? 'SYNC ERROR' : isOffline ? 'OFFLINE' : 'CLOUD SYNCED'}
        </span>
        <button onClick={onRetry} className="btn-ghost" style={{ padding: 4, borderRadius: 6 }}>
          <Icon name="rotate-cw" size={12} />
        </button>
      </div>
    </div>
  );
};

const PresenceUI = ({ users }) => {
  const userList = Object.values(users || {}).slice(0, 5);
  const extraCount = Object.keys(users || {}).length - 5;

  return (
    <div className="presence-avatar-list">
      {extraCount > 0 && (
        <div className="presence-avatar" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', fontSize: 10 }}>
          +{extraCount}
        </div>
      )}
      {userList.map((u, i) => (
        <div key={i} className="presence-avatar" title={`${u.ign} is on ${u.page} (${u.status})`}>
          {u.ign?.slice(0, 2).toUpperCase()}
          <div className={`status-dot ${u.status === 'online' ? 'status-online' : u.status === 'idle' ? 'status-idle' : 'status-away'}`} />
        </div>
      ))}
    </div>
  );
};

const PageWrapper = ({ children, id }) => (
  <MotionDiv
    key={id}
    initial={{ opacity: 0, y: 10, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -10, scale: 0.98 }}
    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
    style={{ width: '100%', height: '100%' }}
  >
    {children}
  </MotionDiv>
);
const MyProfileSkeleton = () => (
  <div className="card animate-fade-in" style={{ maxWidth: 920, margin: "0 auto" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
      <div style={{ width: 62, height: 62, borderRadius: 12, background: "rgba(255,255,255,0.08)" }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: "42%", height: 16, borderRadius: 8, background: "rgba(255,255,255,0.08)", marginBottom: 8 }} />
        <div style={{ width: "26%", height: 12, borderRadius: 8, background: "rgba(255,255,255,0.06)" }} />
      </div>
    </div>
    <div className="grid-2">
      <CardSkeleton />
      <CardSkeleton />
    </div>
  </div>
);

export default function App() {
  const {
    loading, authLoading, currentUser, myMemberId, isAdmin, isOfficer, isMember, isArchitect, isStatusActive,
    page, setPage,
    toast, setToast, showToast,
    members, events, absences,
    notifications, requests, joinRequests, onlineUsers,
    metadataNotice, setMetadataNotice, metadataActivity, pendingAuctionConflict, syncStatus, triggerSyncRetry,
    channelStatus
  } = useGuild();

  const [profileMember, setProfileMember] = useState(null);
  const [showTreasury, setShowTreasury] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const [diagCopied, setDiagCopied] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [densityMode, setDensityMode] = useState(() => localStorage.getItem("ui_density_mode") || "comfy");
  const [highContrastMode] = useState(() => localStorage.getItem("ui_high_contrast_mode") === "1");
  const [themeMode] = useState(() => localStorage.getItem("ui_theme_mode") || "dark");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [recentCommandIds, setRecentCommandIds] = useState(() => {
    try {
      const raw = localStorage.getItem("recent_command_ids_v1");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  
  const unreadCount = notifications.filter(n => n.targetId === "all" || (n.targetId === myMemberId && !n.isRead)).length;
  const effectivePage = (isMember && !(isAdmin || isOfficer || isArchitect) && page !== "import") ? "members" : page;
  const pendingRequestsCount = 
    requests.filter(r => r.status === "pending").length + 
    joinRequests.filter(r => r.status === "pending").length;

  console.log("AppDebug: myMemberId:", myMemberId, "Members count:", members.length);
  const ownMember = React.useMemo(() => {
    if (!myMemberId || members.length === 0) return null;
    const normalizedMyId = (myMemberId || "").trim().toLowerCase();
    const found = members.find(m => (m.memberId || "").trim().toLowerCase() === normalizedMyId);
    
    if (!found) {
      console.warn("AppDebug: Member NOT found. Available IDs:", members.slice(0, 10).map(m => m.memberId));
    } else {
      console.log("AppDebug: Member found:", found.ign);
    }
    return found || null;
  }, [members, myMemberId]);

  const prefetchPage = React.useCallback((pageId) => {
    if (!pageId || prefetchedPages.has(pageId)) return;
    const loader = pagePrefetchers[pageId];
    if (!loader) return;
    prefetchedPages.add(pageId);
    loader().catch(() => {
      prefetchedPages.delete(pageId);
    });
  }, []);

  React.useEffect(() => {
    if (sessionStorage.getItem("lazy-retry-notice") === "1") {
      sessionStorage.removeItem("lazy-retry-notice");
      showToast("App updated to the latest version after sync. Please retry your action.", "info");
    }
  }, [showToast]);
  React.useEffect(() => {
    if (isMember) {
      prefetchPage("member-profile");
    }
  }, [isMember, prefetchPage]);
  React.useEffect(() => {
    localStorage.setItem("ui_density_mode", densityMode);
  }, [densityMode]);
  React.useEffect(() => {
    localStorage.setItem("ui_high_contrast_mode", highContrastMode ? "1" : "0");
  }, [highContrastMode]);
  React.useEffect(() => {
    localStorage.setItem("recent_command_ids_v1", JSON.stringify(recentCommandIds.slice(0, 6)));
  }, [recentCommandIds]);
  React.useEffect(() => {
    localStorage.setItem("ui_theme_mode", themeMode);
    document.documentElement.setAttribute("data-theme", themeMode);
  }, [themeMode]);
  React.useEffect(() => {
    let rafId = 0;
    const updateStickyState = () => {
      rafId = 0;
      const stickyNodes = document.querySelectorAll(".sticky-actions");
      stickyNodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        const topOffset = Number.parseFloat(window.getComputedStyle(node).top || "0") || 0;
        const isStuck = rect.top <= topOffset + 0.5;
        node.classList.toggle("is-stuck", isStuck);
      });
    };
    const onScrollOrResize = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateStickyState);
    };
    updateStickyState();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [page, densityMode, highContrastMode, showCommandPalette, showNotifications]);

  // ── Global Drag-to-Scroll + Shift+Wheel for all .table-responsive tables ──
  React.useEffect(() => {
    const setupEl = (el) => {
      if (el._dragScroll) return; // already set up
      el._dragScroll = true;

      let isDown = false, startX = 0, scrollLeftStart = 0;

      const onDown = (e) => {
        // Only left mouse button; ignore clicks on buttons/inputs inside table
        if (e.button !== 0) return;
        if (['button','input','select','textarea','a'].includes(e.target?.tagName?.toLowerCase())) return;
        isDown = true;
        startX = e.clientX;
        scrollLeftStart = el.scrollLeft;
        el.style.cursor = 'grabbing';
        el.style.userSelect = 'none';
      };
      const onUp = () => {
        if (!isDown) return;
        isDown = false;
        el.style.cursor = '';
        el.style.userSelect = '';
      };
      const onMove = (e) => {
        if (!isDown) return;
        e.preventDefault();
        el.scrollLeft = scrollLeftStart - (e.clientX - startX);
      };
      // Shift + mousewheel = horizontal scroll
      const onWheel = (e) => {
        if (!e.shiftKey) return;
        e.preventDefault();
        el.scrollLeft += e.deltaY * 0.8;
      };

      el.addEventListener('mousedown', onDown);
      el.addEventListener('mouseup', onUp);
      el.addEventListener('mouseleave', onUp);
      el.addEventListener('mousemove', onMove);
      el.addEventListener('wheel', onWheel, { passive: false });

      // Store cleanup fn
      el._dragScrollCleanup = () => {
        el.removeEventListener('mousedown', onDown);
        el.removeEventListener('mouseup', onUp);
        el.removeEventListener('mouseleave', onUp);
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('wheel', onWheel);
      };
    };

    // Apply immediately to existing elements
    document.querySelectorAll('.table-responsive').forEach(setupEl);

    // Watch for React-mounted new tables
    const observer = new MutationObserver(() => {
      document.querySelectorAll('.table-responsive').forEach(setupEl);
    });
    observer.observe(document.body, { subtree: true, childList: true });

    return () => {
      observer.disconnect();
      document.querySelectorAll('.table-responsive').forEach(el => {
        el._dragScrollCleanup?.();
        el._dragScroll = false;
      });
    };
  }, []);



  React.useEffect(() => {
    let awaitingGo = false;
    let goTimeout = null;
    const resetGo = () => {
      awaitingGo = false;
      if (goTimeout) {
        window.clearTimeout(goTimeout);
        goTimeout = null;
      }
    };
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette(true);
        return;
      }
      const targetTag = (e.target?.tagName || "").toLowerCase();
      const typing = e.target?.isContentEditable || targetTag === "input" || targetTag === "textarea" || targetTag === "select";
      if (e.key === "Escape") {
        setShowNotifications(false);
        setShowDiag(false);
        setShowShortcutsHelp(false);
        setShowCommandPalette(false);
        resetGo();
        return;
      }
      if (typing) return;
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcutsHelp(true);
        resetGo();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        const search = document.querySelector('input[placeholder*="Search"], input[placeholder*="search"]');
        if (search) search.focus();
        resetGo();
        return;
      }
      if (awaitingGo) {
        const key = e.key.toLowerCase();
        const map = { m: "members", e: "events", a: "auction", l: "leaderboard", d: "dashboard", p: "party", i: "import" };
        if (map[key]) {
          e.preventDefault();
          setPage(map[key]);
          setProfileMember(null);
          window.scrollTo(0, 0);
        }
        resetGo();
        return;
      }
      if (e.key.toLowerCase() === "g") {
        awaitingGo = true;
        goTimeout = window.setTimeout(resetGo, 1400);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      resetGo();
    };
  }, [setPage]);
  const commandActions = React.useMemo(() => {
    const actions = [];
    const pageActions = NAV_ITEMS.filter(item => {
      if (isArchitect) return true;
      if (isMember) return item.id === "members";
      if (isAdmin) return !(item.id === "users" && !isArchitect);
      if (isOfficer) return item.id !== "users" && item.id !== "auditlog";
      return false;
    }).map(item => ({
      id: `page-${item.id}`,
      label: `Go to ${item.label}`,
      group: "Navigation",
      hint: "g + key",
      keywords: `${item.id} ${item.label} page navigate`,
      run: () => {
        setPage(item.id);
        setProfileMember(null);
        window.scrollTo(0, 0);
      }
    }));
    actions.push(...pageActions);
    actions.push({
      id: "open-notifications",
      label: "Open Notifications",
      group: "View",
      hint: "bell",
      keywords: "notifications alerts bell",
      run: () => setShowNotifications(true)
    });
    actions.push({
      id: "toggle-density",
      label: `Switch Density (${densityMode === "compact" ? "to Comfy" : "to Compact"})`,
      group: "View",
      hint: "display",
      keywords: "density compact comfy display",
      run: () => setDensityMode(v => v === "compact" ? "comfy" : "compact")
    });
    if (isArchitect) {
      actions.push({
        id: "toggle-diag",
        label: `${showDiag ? "Hide" : "Show"} Architect Diagnostics`,
        group: "Admin",
        hint: "architect",
        keywords: "diagnostics debug panel architect",
        run: () => setShowDiag(v => !v)
      });
    }
    return actions;
  }, [isMember, isAdmin, isOfficer, isArchitect, densityMode, showDiag, setPage]);
  const filteredCommandActions = React.useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) {
      const byId = new Map(commandActions.map(a => [a.id, a]));
      const recent = recentCommandIds.map(id => byId.get(id)).filter(Boolean).map(a => ({ ...a, group: "Recent" }));
      const recentIds = new Set(recent.map(a => a.id));
      const rest = commandActions.filter(a => !recentIds.has(a.id));
      return [...recent, ...rest];
    }
    return commandActions.filter(a => a.label.toLowerCase().includes(q) || a.keywords.toLowerCase().includes(q));
  }, [commandActions, commandQuery, recentCommandIds]);
  React.useEffect(() => {
    if (!showCommandPalette) return;
    setCommandIndex(0);
  }, [showCommandPalette, commandQuery]);
  const runCommandAction = React.useCallback((action) => {
    if (!action) return;
    setRecentCommandIds(prev => [action.id, ...prev.filter(id => id !== action.id)].slice(0, 6));
    action.run();
    setShowCommandPalette(false);
    setCommandQuery("");
  }, []);


  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setPage("dashboard");
    showToast("Signed out successfully", "success");
  };
  const copyDiagnostics = async () => {
    const payload = {
      page,
      syncStatus,
      unreadCount,
      onlineUsers: onlineUsers?.length || 0,
      pendingRequestsCount,
      hasMetadataNotice: !!metadataNotice,
      hasAuctionConflict: !!pendingAuctionConflict,
      metadataActivityCount: metadataActivity?.length || 0,
      auth: currentUser?.email ? "auth" : "anon",
      role: isAdmin ? "admin" : isOfficer ? "officer" : isMember ? "member" : "unknown",
      mode: import.meta.env.MODE,
      ts: new Date().toISOString()
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setDiagCopied(true);
      window.setTimeout(() => setDiagCopied(false), 1600);
    } catch {
      showToast("Failed to copy diagnostics", "error");
    }
  };

  // Dynamic Theme Tinting
  React.useEffect(() => {
    let activeColorVar = null;
    
    // Find the user's class if they are logged in and linked
    if (currentUser && members && myMemberId && page !== "import") {
      const me = members.find(m => m.memberId === myMemberId);
      if (me && me.class) {
        for (const branch of JOB_CLASSES) {
          const job = branch.jobs.find(j => j.name === me.class);
          if (job && job.color) {
             activeColorVar = job.color;
             break;
          }
        }
      }
    }
    
    if (activeColorVar) {
      const rootStyles = getComputedStyle(document.documentElement);
      const cssVarName = activeColorVar.replace("var(", "").replace(")", ""); // e.g. "--color-knight"
      const hexColor = rootStyles.getPropertyValue(cssVarName).trim(); 
      
      if (hexColor) {
         document.documentElement.style.setProperty('--accent', hexColor);
         document.documentElement.style.setProperty('--accent-light', hexColor);
         
         const hex = hexColor.replace("#", "");
         const r = parseInt(hex.substring(0,2), 16) || 0;
         const g = parseInt(hex.substring(2,4), 16) || 0;
         const b = parseInt(hex.substring(4,6), 16) || 0;
         document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.5)`);
      }
    } else {
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-light');
      document.documentElement.style.removeProperty('--accent-glow');
    }
    
    return () => {
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-light');
      document.documentElement.style.removeProperty('--accent-glow');
    };
  }, [currentUser, myMemberId, members, page]);

  // Show auth loading
  if (authLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-deepest)", flexDirection: "column", gap: 16 }}>
      <div style={{ fontFamily: "Cinzel,serif", fontSize: 28, color: "var(--accent)", textShadow: "0 0 20px rgba(99,130,230,0.5)" }}>OBLIVION</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13, letterSpacing: 3, textTransform: "uppercase" }}>Initializing...</div>
    </div>
  );

  // Show login if not authenticated
  if (!currentUser) {
    return (
      <PageErrorBoundary>
        <React.Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg-deepest)" }} />}>
          <LoginPage />
        </React.Suspense>
      </PageErrorBoundary>
    );
  }

  if (loading) return (
    <div className={`app-root density-${densityMode} ${highContrastMode ? "high-contrast" : ""}`}>
      <nav className="sidebar" style={{ opacity: 0.5 }}>
        <div className="sidebar-logo">
          <div className="font-cinzel" style={{ fontSize: 28, color: "var(--accent)" }}>OBLIVION</div>
        </div>
      </nav>
      <main className="main-content">
        <div className="page-header">
          <div style={{ width: 200, height: 32, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }} />
        </div>
        <div className="grid-2">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </main>
    </div>
  );

  return (
    <div className={`app-root density-${densityMode} ${highContrastMode ? "high-contrast" : ""}`}>
      <SyncPill status={syncStatus} onRetry={triggerSyncRetry} />
      {/* Sidebar */}
      <nav className="sidebar glass-panel">
        <div className="sidebar-logo" style={{ textAlign: "center", overflow: "visible" }}>
          <div className="logo-halo-container" style={{ margin: "16px auto 12px", transform: "scale(0.7)", transformOrigin: "center top" }}>
            <div className="logo-halo" />
            <div className="logo-ring" />
            <div className="logo-frame-shimmer">
               <div className="logo-inner-frame">
                 <div className="logo-flare" />
                 <img
                   src={`${import.meta.env.BASE_URL}oblivion-logo.png`}
                   alt="Oblivion Guild"
                   style={{ width: 160, height: 160, objectFit: "cover", display: "block", position: "relative", zIndex: 1, borderRadius: 8 }}
                 />
               </div>
            </div>
          </div>
          <div className="logo-sub">Guild Manager</div>
          
          <div 
            className="absolute top-4 right-4 cursor-pointer hover:scale-110 transition-transform" 
            onClick={() => setShowNotifications(true)}
            style={{ zIndex: 10 }}
          >
            <div className="relative">
              <Icon name="bell" size={20} color={unreadCount > 0 ? "var(--gold)" : "var(--text-muted)"} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="sidebar-nav">
          {NAV_ITEMS.filter(item => {
            if (item.id === "import" && isArchitect) return true; 
            
            // Restricted view for members
            if (isMember && !(isAdmin || isOfficer || isArchitect)) return item.id === "members";
            
            // Admin/Officer views
            if (isAdmin) {
              if (item.id === "users" && !isArchitect) return false;
              return true;
            }
            if (isOfficer) return item.id !== "users" && item.id !== "auditlog";
            
            return false;
          }).map(item => {
            const activeMembersCount = members.filter(m => (m.status || "active") === "active").length;
            const counts = { members: activeMembersCount, events: events.length, absences: absences.length };
            const count = counts[item.id];

            let label = item.label;
            if (isMember && !(isAdmin || isOfficer || isArchitect) && item.id === "members") label = "My Profile";

            return (
              <MotionDiv 
                key={item.id} 
                className={`nav-item ${effectivePage === item.id ? "active" : ""}`} 
                onClick={() => { setPage(item.id); setProfileMember(null); }}
                onMouseEnter={() => prefetchPage(item.id)}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.05 * NAV_ITEMS.findIndex(i => i.id === item.id) }}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                style={{ justifyContent: "space-between" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name={item.id === "members" && isMember ? "user" : item.icon} size={16} />
                  {label}
                </div>
                {count !== undefined && !isMember && (
                  <span style={{ background: "rgba(99,130,230,0.15)", color: "var(--accent)", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: "center" }}>
                    {count}
                  </span>
                )}
                {item.id === "requests" && pendingRequestsCount > 0 && (
                  <span style={{ background: "var(--red)", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 10px rgba(239,68,68,0.5)" }}>
                    {pendingRequestsCount}
                  </span>
                )}
  </MotionDiv>
            );
          })}
        </div>
        <div className="sidebar-footer">

          {currentUser && (
            <div className="sidebar-user-profile glass-panel" style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ 
                  width: 32, height: 32, borderRadius: 8, 
                  background: isArchitect ? "linear-gradient(135deg, #ff4d4d, #b91c1c)" : isAdmin ? "linear-gradient(135deg, var(--gold), #b45309)" : "linear-gradient(135deg, var(--accent), #1e3a8a)", 
                  color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Cinzel,serif", fontSize: 11, fontWeight: 900, flexShrink: 0, 
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                }}>
                  {(currentUser.displayName || currentUser.email || "").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {currentUser.displayName || currentUser.ign || currentUser.email}
                  </div>
                  <div style={{ 
                    fontSize: 9, 
                    fontWeight: 900,
                    color: isArchitect ? "#ff4d4d" : isAdmin ? "var(--gold)" : isOfficer ? "var(--accent)" : "var(--text-muted)", 
                    letterSpacing: 1,
                    textTransform: 'uppercase'
                  }}>
                    {isArchitect ? "Architect" : isAdmin ? "Admin" : isOfficer ? "Officer" : "Member"}
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", fontSize: 10, borderRadius: 6, opacity: 0.7 }} onClick={handleSignOut}>
                Disconnect
              </button>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between", 
              padding: "8px 12px", 
              background: "rgba(0,0,0,0.2)", 
              borderRadius: 8, 
              border: "1px solid var(--border)",
              fontSize: 10
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ 
                    width: 6, height: 6, borderRadius: "50%", 
                    background: syncStatus === "synced" ? "#10b981" : syncStatus === "saving" ? "var(--gold)" : "#ef4444",
                    boxShadow: syncStatus === "synced" ? "0 0 8px #10b981" : "none"
                  }} />
                  {syncStatus.toUpperCase()}
                </div>
                <div style={{ width: 1, height: 10, background: "var(--border)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ 
                    width: 6, height: 6, borderRadius: "50%", 
                    background: channelStatus === "subscribed" ? "#6382e6" : "var(--text-muted)",
                    boxShadow: channelStatus === "subscribed" ? "0 0 8px #6382e6" : "none"
                  }} />
                  LIVE
                </div>
              </div>
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ padding: "2px 4px", height: "auto", minWidth: 0 }}
                onClick={() => {
                  triggerSyncRetry();
                  showToast("Re-fetching global data...", "info");
                }}
                title="Force Refresh Data"
              >
                <Icon name="rotate-cw" size={12} />
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", marginBottom: 16, background: "linear-gradient(135deg, rgba(240,192,64,0.2), rgba(240,192,64,0.05))", color: "var(--gold)", border: "1px solid var(--border)" }}
            data-shiny="true"
            onClick={() => setShowTreasury(true)}
          >
            <Icon name="star" size={14} /> Buy Me A Beer
          </button>

          <div style={{ marginTop: 12, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--text-muted)", opacity: 0.6, letterSpacing: 1, textTransform: "uppercase" }}>
              Oblivion Guild Portal v2.5
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              Crafted by <span style={{ fontFamily: "Cinzel,serif", color: "#ff4d4d", letterSpacing: 2, fontWeight: 800, textShadow: "0 0 12px rgba(255,77,77,0.7)" }}>Ꮤ 𐌄 𐌉 𐌔 𐌔</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        {NAV_ITEMS.filter(item => {
          const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
          if (isLocal || isArchitect) return true;
          if (item.id === "import") return true; // Force show Import for migration
          if (isMember && !(isAdmin || isOfficer || isArchitect)) return item.id === "members";
          // Only show top 5 relevant items on mobile nav to avoid clutter
          const mobileWhitelisted = ["dashboard", "members", "events", "leaderboard"];
          if (!mobileWhitelisted.includes(item.id)) return false;
          
          if (isAdmin) return true;
          if (isOfficer) return item.id !== "users" && item.id !== "auditlog";
          return false;
        }).map(item => {
          let label = item.label;
          if (isMember && !(isAdmin || isOfficer || isArchitect) && item.id === "members") label = "Profile";
          if (label === "Dashboard") label = "Home"; // Shorten for mobile
          if (label === "Leaderboard") label = "Rank";

          return (
            <button
              key={item.id}
              className={`mobile-nav-item ${effectivePage === item.id ? "active" : ""}`}
              onClick={() => { setPage(item.id); setProfileMember(null); window.scrollTo(0, 0); }}
              onMouseEnter={() => prefetchPage(item.id)}
              onTouchStart={() => prefetchPage(item.id)}
            >
              <Icon name={item.id === "members" && isMember ? "user" : item.icon} size={20} />
              <span>{label}</span>
            </button>
          );
        })}
        {/* Extra: Quick sign out for mobile */}
        <button className="mobile-nav-item" onClick={handleSignOut} style={{ opacity: 0.6 }}>
          <Icon name="x" size={18} />
          <span>Exit</span>
        </button>
      </nav>

      {/* Main Content Areas */}
      <main className="main-content">
        {isArchitect && (
          <div className="architect-diag-container hide-on-mobile">
            <button
              className="btn btn-ghost btn-sm"
              style={{ border: "1px solid rgba(255,255,255,0.2)", fontSize: 11 }}
              onClick={() => setShowDiag(v => !v)}
            >
              {showDiag ? "Hide Diagnostics" : "Show Diagnostics"}
            </button>
            {showDiag && (
              <div className="architect-diag-panel">
                <div style={{ fontSize: 10, fontWeight: 900, color: "var(--accent)", letterSpacing: 1, marginBottom: 8 }}>ARCHITECT DIAGNOSTICS</div>
                <div className="diag-grid">
                  <div>Page: <strong>{page}</strong></div>
                  <div>Sync: <strong>{syncStatus}</strong></div>
                  <div>Unread: <strong>{unreadCount}</strong></div>
                  <div>Online: <strong>{onlineUsers?.length || 0}</strong></div>
                  <div>Req Pending: <strong>{pendingRequestsCount}</strong></div>
                  <div>Meta Notice: <strong>{metadataNotice ? "yes" : "no"}</strong></div>
                  <div>Auction Conflict: <strong>{pendingAuctionConflict ? "yes" : "no"}</strong></div>
                  <div style={{ gridColumn: "span 2", marginTop: 8 }}>
                    <button 
                      className="btn btn-primary btn-sm" 
                      style={{ width: "100%", fontSize: 10, padding: "4px 8px", background: "var(--red)", borderColor: "rgba(255,0,0,0.3)" }}
                      onClick={() => {
                        triggerSyncRetry();
                        showToast("Forcing fresh sync from Supabase...", "info");
                      }}
                    >
                      <Icon name="rotate-cw" size={12} /> Force Refresh Database
                    </button>
                  </div>
                </div>
                  <div>Recent Meta Events: <strong>{metadataActivity?.length || 0}</strong></div>
                  <div>User: <strong>{currentUser?.email ? "auth" : "anon"}</strong></div>
                  <div>Role Flags: <strong>{isAdmin ? "admin" : isOfficer ? "officer" : isMember ? "member" : "n/a"}</strong></div>
                <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)" }}>
                  Build: {import.meta.env.MODE} | {new Date().toLocaleTimeString()}
                </div>
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={copyDiagnostics}>
                    {diagCopied ? "Copied!" : "Copy Diagnostics"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
        <div className="status-bar glass-panel" style={{ padding: '8px 16px', borderRadius: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1 }}>STATUS</div>
              <span className="premium-pill" style={{ background: 'rgba(99,130,230,0.05)', border: 'none', boxShadow: 'none' }}>
                Density: {densityMode.toUpperCase()}
              </span>
              {highContrastMode && (
                <span className="premium-pill" style={{ background: 'rgba(240,192,64,0.05)', border: 'none', boxShadow: 'none', color: 'var(--gold)' }}>
                  A11Y ON
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>
                ACTIVE OFFICERS
              </div>
              <PresenceUI users={onlineUsers} />
            </div>
          </div>
        </div>
        {metadataNotice && (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(240,192,64,0.35)",
              background: "rgba(240,192,64,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap"
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
              ⚠️ {metadataNotice.message}
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm"
                style={{ border: "1px solid rgba(255,255,255,0.2)" }}
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
              <button
                className="btn btn-sm"
                style={{ background: "var(--gold)", color: "#111", fontWeight: 800 }}
                onClick={() => setMetadataNotice(null)}
              >
                Apply Latest
              </button>
            </div>
          </div>
        )}
        
        {(!isStatusActive && !isArchitect && page !== "import") ? (
          <PageWrapper id="access-revoked">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🛡️</div>
              <h2 style={{ fontFamily: "Cinzel, serif", fontSize: 24, color: "var(--accent)", marginBottom: 12 }}>Access Restricted</h2>
              <p style={{ color: "var(--text-secondary)", maxWidth: 450, margin: "0 auto 24px", lineHeight: 1.6 }}>
                Ang iyong access sa Oblivion Guild Portal ay pansamantalang naka-disable dahil ikaw ay kasalukuyang nasa **Archived** status (Left Guild).
              </p>
              <div style={{ padding: "16px 20px", background: "rgba(224,80,80,0.1)", border: "1px solid rgba(224,80,80,0.2)", borderRadius: 12, color: "var(--red)", fontSize: 13, display: "flex", alignItems: "center", gap: 10, marginBottom: 30 }}>
                ⚠️ Please contact any Guild Officer or Administrator if this is a mistake or if you have returned to the guild.
              </div>
              <button className="btn btn-ghost" onClick={handleSignOut} style={{ gap: 10 }}>
                <Icon name="x" size={16} /> Exit System
              </button>
            </div>
          </PageWrapper>
        ) : (
          <PageErrorBoundary>
            <React.Suspense
              fallback={
                effectivePage === "members" && isMember
                  ? <MyProfileSkeleton />
                  : (effectivePage === "dashboard"
                      ? <DashboardSkeleton />
                      : (
                        <div className="grid-2">
                          <CardSkeleton />
                          <CardSkeleton />
                          <CardSkeleton />
                          <CardSkeleton />
                        </div>
                      ))
              }
            >
              <AnimatePresence mode="wait">
            {effectivePage === "dashboard" && (
              <PageWrapper id="dashboard">
                <Dashboard />
              </PageWrapper>
            )}

            {effectivePage === "members" && (
              <PageWrapper id={profileMember ? `profile-${profileMember.memberId}` : "members"}>
                {isMember && !(isAdmin || isOfficer || isArchitect) ? (
                  ownMember ? (
                    <MemberProfilePage
                      member={ownMember}
                      isOwnProfile={true}
                    />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-muted)", textAlign: "center", padding: 20 }}>
                      <div style={{ fontSize: 48, filter: "grayscale(1) opacity(0.5)", marginBottom: 16 }}>👻</div>
                      <div style={{ fontFamily: "Cinzel,serif", fontSize: 20, color: "var(--text-primary)", marginBottom: 8 }}>Profile Data Missing</div>
                      <div style={{ fontSize: 13, maxWidth: 400, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                        Your account is not linked to any active guild member in the current roster.<br /><br />
                        If the database was recently wiped for update, please wait for an Admin to upload the new roster.
                      </div>
                    </div>
                  )
                ) : (
                  profileMember ? (
                    <MemberProfilePage member={profileMember} onBack={() => setProfileMember(null)} />
                  ) : (
                    <MembersPage onViewProfile={setProfileMember} />
                  )
                )}
              </PageWrapper>
            )}

            {effectivePage === "events" && (
              <PageWrapper id="events">
                <EventsPage />
              </PageWrapper>
            )}

            {effectivePage === "absences" && (
              <PageWrapper id="absences">
                <AbsencesPage />
              </PageWrapper>
            )}

            {effectivePage === "import" && (
              <PageWrapper id="import">
                <ImportPage />
              </PageWrapper>
            )}



            {effectivePage === "auction" && (
              <PageWrapper id="auction">
                <AuctionBuilder />
              </PageWrapper>
            )}

            {effectivePage === "users" && isArchitect && (
              <PageWrapper id="users">
                <UserManagementPage />
              </PageWrapper>
            )}

            {effectivePage === "auditlog" && isAdmin && (
              <PageWrapper id="auditlog">
                <AuditLogPage />
              </PageWrapper>
            )}

            {effectivePage === "requests" && isOfficer && (
              <PageWrapper id="requests">
                <RequestsPage />
              </PageWrapper>
            )}
              </AnimatePresence>
            </React.Suspense>
          </PageErrorBoundary>
        )}
      </main>

      {showTreasury && <TreasuryModal onClose={() => setShowTreasury(false)} />}
      {showShortcutsHelp && (
        <Modal
          title="Keyboard Shortcuts"
          onClose={() => setShowShortcutsHelp(false)}
          footer={<button className="btn btn-primary" onClick={() => setShowShortcutsHelp(false)}>Close</button>}
        >
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
            <div><strong>/</strong> Focus first search input</div>
            <div><strong>g then m/e/a/l/d/p/r/i</strong> Quick go to page</div>
            <div><strong>?</strong> Open this help</div>
            <div><strong>Esc</strong> Close overlays/panels</div>
          </div>
        </Modal>
      )}
      {showCommandPalette && (
        <Modal
          title="Command Palette"
          onClose={() => { setShowCommandPalette(false); setCommandQuery(""); }}
          footer={<button className="btn btn-ghost" onClick={() => { setShowCommandPalette(false); setCommandQuery(""); }}>Close</button>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              className="form-input"
              autoFocus
              placeholder="Type a command (e.g. members, notifications, density)"
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCommandIndex((i) => Math.min(i + 1, Math.max(0, filteredCommandActions.length - 1)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCommandIndex((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  runCommandAction(filteredCommandActions[commandIndex]);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setShowCommandPalette(false);
                  setCommandQuery("");
                }
              }}
            />
            <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredCommandActions.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 4px" }}>No matching commands.</div>
              )}
              {filteredCommandActions.map((action, idx) => (
                <React.Fragment key={action.id}>
                  {(idx === 0 || filteredCommandActions[idx - 1]?.group !== action.group) && (
                    <div
                      style={{
                        marginTop: idx === 0 ? 0 : 6,
                        padding: "2px 4px",
                        fontSize: 10,
                        color: "var(--text-muted)",
                        letterSpacing: 1,
                        textTransform: "uppercase"
                      }}
                    >
                      {action.group || "General"}
                    </div>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onMouseEnter={() => setCommandIndex(idx)}
                    onClick={() => runCommandAction(action)}
                    style={{
                      justifyContent: "space-between",
                      border: idx === commandIndex ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.1)",
                      background: idx === commandIndex ? "rgba(99,130,230,0.12)" : "transparent"
                    }}
                  >
                    <span>{action.label}</span>
                    {action.hint && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.9 }}>
                        {action.hint}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        </Modal>
      )}
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} action={toast.action} onDone={() => setToast(null)} />}
    </div>
  );
}
