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
import Dashboard from "./pages/Dashboard";

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


function PresenceUI({ users }) {
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
}

function PageWrapper({ children, id }) {
  return (
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
}

function MyProfileSkeleton() {
  return (
    <div className="card animate-fade-in" style={{ maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 62, height: 62, borderRadius: 12, background: "rgba(255,255,255,0.08)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: "42%", height: 16, borderRadius: 8, background: "rgba(255,255,255,0.08)", marginBottom: 8 }} />
          <div style={{ width: "26%", height: 12, borderRadius: 8, background: "rgba(255,255,255,0.06)" }} />
        </div>
      </div>
      <div className="grid-2">
        <div style={{ height: 200, borderRadius: 12, background: "rgba(255,255,255,0.03)" }} />
        <div style={{ height: 200, borderRadius: 12, background: "rgba(255,255,255,0.03)" }} />
      </div>
    </div>
  );
}

export default function App() {
  const {
    authLoading, currentUser, myMemberId, isAdmin, isOfficer, isMember, isArchitect, isStatusActive,
    page, setPage,
    toast, setToast, showToast,
    notifications, requests, joinRequests, onlineUsers,
    syncStatus, triggerSyncRetry,
    channelStatus, isFetchingRequests
  } = useGuild();

  const [profileMember, setProfileMember] = useState(null);
  const [showTreasury, setShowTreasury] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [densityMode] = useState(() => localStorage.getItem("ui_density_mode") || "comfy");
  const [highContrastMode] = useState(() => localStorage.getItem("ui_high_contrast_mode") === "1");
  const [themeMode] = useState(() => localStorage.getItem("ui_theme_mode") || "dark");

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const prefetchPage = (pageId) => {
    if (prefetchedPages.has(pageId)) return;
    const prefetcher = pagePrefetchers[pageId];
    if (prefetcher) {
      prefetcher();
      prefetchedPages.add(pageId);
    }
  };

  const effectivePage = profileMember ? "member-profile" : page;

  if (authLoading) return <DashboardSkeleton />;
  if (!currentUser) return (
    <React.Suspense fallback={<DashboardSkeleton />}>
      <LoginPage />
    </React.Suspense>
  );

  return (
    <div 
      className={`app-container ${densityMode}-density ${highContrastMode ? "high-contrast" : ""} theme-${themeMode}`}
      style={{ display: "flex", minHeight: "100vh", background: "var(--bg-deepest)" }}
    >

      
      {/* Sidebar - Desktop */}
      <aside className="sidebar hide-mobile">
        <div className="sidebar-logo" style={{ textAlign: "center", overflow: "visible" }}>
          <div className="logo-halo-container" style={{ margin: "16px auto 12px", transform: "scale(0.7)", transformOrigin: "center top", height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="logo-halo" />
            <div className="logo-ring" />
            <div className="logo-frame-shimmer">
              <div className="logo-inner-frame">
                <div className="logo-flare" />
                <img 
                  src="oblivion-logo.png" 
                  alt="Oblivion Logo" 
                  style={{ width: 160, height: 160, objectFit: "cover", display: "block", position: "relative", zIndex: 1, borderRadius: 8, filter: "drop-shadow(0 0 15px var(--accent-glow))" }} 
                />
              </div>
            </div>
          </div>
          <div className="sidebar-title" style={{ marginTop: 10, letterSpacing: 4, fontWeight: 900, fontSize: 18 }}>OBLIVION</div>
          <div className="logo-sub" style={{ fontSize: 9, color: "var(--text-muted)", opacity: 0.5, letterSpacing: 2, marginTop: 4 }}>GUILD PORTAL</div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => {
            const hasStaffAccess = isOfficer || isAdmin || isArchitect;
            if (item.id === 'users' && !isAdmin && !isArchitect) return null;
            if (item.id === 'auditlog' && !hasStaffAccess) return null;
            if (item.id === 'requests' && !hasStaffAccess) return null;
            if (item.id === 'import' && !hasStaffAccess) return null;
            if (item.id === 'auction' && !hasStaffAccess) return null;
            
            const label = item.label;
            const pendingCount = (requests.filter(r => r.status === 'pending').length) + (joinRequests.filter(r => r.status === 'pending').length);
            const count = item.id === 'requests' ? pendingCount : undefined;

            return (
              <motion.div
                key={item.id}
                className={`nav-item ${effectivePage === item.id ? "active" : ""}`}
                onClick={() => { setPage(item.id); setProfileMember(null); window.scrollTo(0, 0); }}
                onMouseEnter={() => prefetchPage(item.id)}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                style={{ justifyContent: "space-between" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name={item.id === "members" && isMember ? "user" : item.icon} size={16} />
                  {label}
                </div>
                {count !== undefined && !isMember && count > 0 && (
                  <span style={{ 
                    background: "rgba(239, 68, 68, 0.2)", 
                    color: "#ef4444", 
                    borderRadius: 10, 
                    padding: "2px 8px", 
                    fontSize: 11, 
                    fontWeight: 800, 
                    minWidth: 20, 
                    textAlign: "center",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    boxShadow: "0 0 10px rgba(239, 68, 68, 0.2)"
                  }}>
                    {count}
                  </span>
                )}
              </motion.div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-content" style={{ padding: "16px", background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ 
                width: 42, height: 42, borderRadius: 12, 
                background: isArchitect ? "linear-gradient(135deg, #ff4d4d, #b91c1c)" : isAdmin ? "linear-gradient(135deg, var(--gold), #b45309)" : "linear-gradient(135deg, var(--accent), #1e3a8a)", 
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                boxShadow: isArchitect ? "0 0 15px rgba(255,77,77,0.4)" : isAdmin ? "0 0 15px rgba(240,192,64,0.4)" : "none",
                border: "1px solid rgba(255,255,255,0.1)"
              }}>
                {isArchitect ? "👁️" : isAdmin ? "⭐" : "🛡️"}
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {currentUser.user_metadata?.display_name || currentUser.email}
                </div>
                <div style={{ 
                  fontSize: 10, fontWeight: 900, 
                  color: isArchitect ? "#ff4d4d" : isAdmin ? "var(--gold)" : "var(--accent)", 
                  letterSpacing: 1.5, textTransform: 'uppercase',
                  textShadow: isArchitect ? "0 0 8px rgba(255,77,77,0.3)" : "none"
                }}>
                  {isArchitect ? "Architect" : isAdmin ? "Admin" : isOfficer ? "Officer" : "Member"}
                </div>
              </div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {!isMember ? (
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ width: "100%", fontSize: 10, justifyContent: "center", border: "1px solid rgba(255,255,255,0.05)" }}
                  onClick={() => {
                    triggerSyncRetry();
                    showToast("Re-fetching global data...", "info");
                  }}
                  title="Force Refresh Data"
                >
                  <Icon name="rotate-cw" size={12} /> Force Refresh
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm" style={{ width: "100%", fontSize: 10, justifyContent: "center" }} onClick={() => setProfileMember(myMemberId)}>
                  My Stats & Profile
                </button>
              )}

              <button 
                className="btn btn-primary premium-pill glass-panel relative overflow-hidden" 
                style={{ 
                  width: "100%", 
                  justifyContent: "center", 
                  background: "linear-gradient(135deg, rgba(240,192,64,0.15), rgba(240,192,64,0.05))", 
                  color: "var(--gold)", 
                  border: "1px solid rgba(240,192,64,0.4)",
                  fontSize: 11,
                  fontWeight: 800,
                  height: 36,
                  boxShadow: "0 4px 15px rgba(240,192,64,0.15)"
                }} 
                onClick={() => setShowTreasury(true)}
              >
                <div className="premium-shimmer" />
                <Icon name="star" size={14} /> Buy Me A Beer
              </button>
            </div>

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px solid var(--border)", fontSize: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ 
                    width: 6, height: 6, borderRadius: "50%", 
                    background: syncStatus === "synced" ? (isFetchingRequests ? "#6382e6" : "#10b981") : syncStatus === "saving" ? "var(--gold)" : "#ef4444", 
                    boxShadow: syncStatus === "synced" ? (isFetchingRequests ? "0 0 8px #6382e6" : "0 0 8px #10b981") : "none",
                    animation: isFetchingRequests ? "pulse 2s infinite" : "none"
                  }} />
                  {(isFetchingRequests ? "SYNCING" : syncStatus).toUpperCase()}
                </div>
                <div style={{ width: 1, height: 10, background: "var(--border)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: channelStatus === "subscribed" ? "#6382e6" : "var(--text-muted)", boxShadow: channelStatus === "subscribed" ? "0 0 8px #6382e6" : "none" }} />
                  LIVE
                </div>
              </div>
            </div>

            <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", fontSize: 10, marginTop: 8, opacity: 0.6, border: "1px solid rgba(255,255,255,0.03)" }} onClick={handleSignOut}>
              Exit System
            </button>

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div className="version-badge">
                <span className="version-dot" />
                v2.6.0 Stable
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.8, display: "flex", alignItems: "center", gap: 4 }}>
                Crafted by <span style={{ fontFamily: "Cinzel,serif", color: "#ff4d4d", letterSpacing: 2, fontWeight: 900, textShadow: "0 0 10px rgba(255,77,77,0.4)" }}>Ꮤ 𐌄 𐌉 𐌔 𐌔</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <AnimatePresence mode="wait">
          {!isStatusActive ? (
            <PageWrapper key="inactive" id="inactive">
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 }}>
                <div style={{ fontSize: 60, marginBottom: 20 }}>🛡️</div>
                <h1 className="page-title" style={{ marginBottom: 10 }}>Access Suspended</h1>
                <p className="text-secondary" style={{ maxWidth: 400, marginBottom: 30 }}>
                  Your account status is currently <strong>Inactive</strong>. This usually means you have left the guild or your access has been revoked by an administrator.
                </p>
                <button className="btn btn-ghost" onClick={handleSignOut} style={{ gap: 10 }}>
                  <Icon name="x" size={16} /> Exit System
                </button>
              </div>
            </PageWrapper>
          ) : (
            <PageErrorBoundary>
              <React.Suspense fallback={<DashboardSkeleton />}>
                {effectivePage === "dashboard" && <PageWrapper id="dashboard"><Dashboard /></PageWrapper>}
                {effectivePage === "members" && <PageWrapper id="members"><MembersPage /></PageWrapper>}
                {effectivePage === "member-profile" && (
                  <PageWrapper id="profile">
                    <MemberProfilePage 
                      memberId={profileMember || myMemberId} 
                      onClose={() => setProfileMember(null)} 
                    />
                  </PageWrapper>
                )}
                {effectivePage === "events" && <PageWrapper id="events"><EventsPage /></PageWrapper>}
                {effectivePage === "absences" && <PageWrapper id="absences"><AbsencesPage /></PageWrapper>}
                {effectivePage === "import" && ((isOfficer || isAdmin || isArchitect) ? <PageWrapper id="import"><ImportPage /></PageWrapper> : <Dashboard />)}
                {effectivePage === "auction" && ((isOfficer || isAdmin || isArchitect) ? <PageWrapper id="auction"><AuctionBuilder /></PageWrapper> : <Dashboard />)}
                {effectivePage === "users" && ((isAdmin || isArchitect) ? <PageWrapper id="users"><UserManagementPage /></PageWrapper> : <Dashboard />)}
                {effectivePage === "auditlog" && ((isOfficer || isAdmin || isArchitect) ? <PageWrapper id="auditlog"><AuditLogPage /></PageWrapper> : <Dashboard />)}
                {effectivePage === "requests" && ((isOfficer || isAdmin || isArchitect) ? <PageWrapper id="requests"><RequestsPage /></PageWrapper> : <Dashboard />)}
              </React.Suspense>
            </PageErrorBoundary>
          )}
        </AnimatePresence>

        {/* Global Floating Elements */}
        <div style={{ 
          position: "fixed", 
          top: 24, 
          right: 48, 
          zIndex: 100, 
          display: "flex", 
          alignItems: "center", 
          gap: 20,
          padding: "8px 16px",
          borderRadius: 20,
          background: "rgba(10,15,25,0.4)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.05)"
        }}>
          <PresenceUI users={onlineUsers} />
          <div className="cursor-pointer hover:scale-110 transition-transform" onClick={() => setShowNotifications(true)}>
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

        {/* Mobile Navigation Bar */}
        <nav className="mobile-nav show-mobile">
          {NAV_ITEMS.slice(0, 4).map(item => {
            const label = item.label.split(' ')[0];
            return (
              <button 
                key={item.id} 
                className={`mobile-nav-item ${effectivePage === item.id ? "active" : ""}`}
                onClick={() => { setPage(item.id); setProfileMember(null); window.scrollTo(0, 0); }}
              >
                <Icon name={item.id === "members" && isMember ? "user" : item.icon} size={20} />
                <span>{label}</span>
              </button>
            );
          })}
          <button className="mobile-nav-item" onClick={() => setShowNotifications(true)}>
            <Icon name="bell" size={20} />
            <span>Notifs</span>
          </button>
        </nav>
      </main>

      {/* Overlays */}
      <AnimatePresence>
        {showNotifications && (
          <NotificationCenter 
            onClose={() => setShowNotifications(false)} 
            onOpenProfile={(id) => { setProfileMember(id); setShowNotifications(false); }}
          />
        )}
        {showTreasury && (
          <TreasuryModal onClose={() => setShowTreasury(false)} />
        )}
      </AnimatePresence>

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          action={toast.action} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}
