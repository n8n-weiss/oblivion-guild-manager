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
function SyncPill({ status, onRetry }) {
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
}

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
    channelStatus
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
      <SyncPill status={syncStatus} onRetry={triggerSyncRetry} />
      
      {/* Sidebar - Desktop */}
      <aside className="sidebar hide-mobile">
        <div className="sidebar-header">
          <div className="guild-logo">🛡️</div>
          <div className="sidebar-title">OBLIVION</div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => {
            if (item.id === 'users' && !isAdmin) return null;
            if (item.id === 'auditlog' && !isOfficer) return null;
            if (item.id === 'requests' && !isOfficer) return null;
            
            const label = item.label;
            const count = item.id === 'requests' ? (requests.length + joinRequests.length) : undefined;

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
                  <span style={{ background: "rgba(99,130,230,0.15)", color: "var(--accent)", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: "center" }}>
                    {count}
                  </span>
                )}
              </motion.div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-content">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: isArchitect ? "rgba(255,77,77,0.15)" : isAdmin ? "rgba(240,192,64,0.15)" : "rgba(99,130,230,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                {isArchitect ? "👁️" : isAdmin ? "⭐" : "🛡️"}
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {currentUser.user_metadata?.display_name || currentUser.email}
                </div>
                <div style={{ fontSize: 9, fontWeight: 900, color: isArchitect ? "#ff4d4d" : isAdmin ? "var(--gold)" : "var(--accent)", letterSpacing: 1, textTransform: 'uppercase' }}>
                  {isArchitect ? "Architect" : isAdmin ? "Admin" : isOfficer ? "Officer" : "Member"}
                </div>
              </div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: 10 }} onClick={() => setPage("members")}>
                  Profile
                </button>
                <button 
                  className="btn btn-ghost btn-sm btn-icon" 
                  onClick={() => {
                    triggerSyncRetry();
                    showToast("Re-fetching global data...", "info");
                  }}
                  title="Force Refresh Data"
                >
                  <Icon name="rotate-cw" size={12} />
                </button>
              </div>

              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: 16, background: "linear-gradient(135deg, rgba(240,192,64,0.2), rgba(240,192,64,0.05))", color: "var(--gold)", border: "1px solid var(--border)" }} onClick={() => setShowTreasury(true)}>
                <Icon name="star" size={14} /> Buy Me A Beer
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: syncStatus === "synced" ? "#10b981" : syncStatus === "saving" ? "var(--gold)" : "#ef4444", boxShadow: syncStatus === "synced" ? "0 0 8px #10b981" : "none" }} />
                  {syncStatus.toUpperCase()}
                </div>
                <div style={{ width: 1, height: 10, background: "var(--border)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: channelStatus === "subscribed" ? "#6382e6" : "var(--text-muted)", boxShadow: channelStatus === "subscribed" ? "0 0 8px #6382e6" : "none" }} />
                  LIVE
                </div>
              </div>
            </div>

            <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", fontSize: 10, marginTop: 8, opacity: 0.6 }} onClick={handleSignOut}>
              Exit System
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content" style={{ flex: 1, padding: "var(--content-padding)", position: "relative" }}>
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
                {effectivePage === "import" && <PageWrapper id="import"><ImportPage /></PageWrapper>}
                {effectivePage === "auction" && <PageWrapper id="auction"><AuctionBuilder /></PageWrapper>}
                {effectivePage === "users" && <PageWrapper id="users"><UserManagementPage /></PageWrapper>}
                {effectivePage === "auditlog" && <PageWrapper id="auditlog"><AuditLogPage /></PageWrapper>}
                {effectivePage === "requests" && <PageWrapper id="requests"><RequestsPage /></PageWrapper>}
              </React.Suspense>
            </PageErrorBoundary>
          )}
        </AnimatePresence>

        {/* Global Floating Elements */}
        <div style={{ position: "fixed", top: 24, right: 32, zIndex: 100, display: "flex", alignItems: "center", gap: 16 }}>
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
          <Modal isOpen={true} onClose={() => setShowTreasury(false)} title="Oblivion Treasury">
            <TreasuryModal />
          </Modal>
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
