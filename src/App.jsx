import React, { useState } from "react";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";
import { useGuild } from "./context/GuildContext";
import { NAV_ITEMS } from "./utils/constants";

// Styles & UI
import "./styles/index.css";
import Icon from "./components/ui/icons";
import Toast from "./components/ui/Toast";
import { MemberAvatar } from "./components/common/MemberAvatar";

// Components
import TreasuryModal from "./components/common/TreasuryModal";
import { NotificationCenter } from "./components/common/NotificationCenter";
import Dashboard from "./pages/Dashboard";
import MembersPage from "./pages/MembersPage";
import EventsPage from "./pages/EventsPage";
import AbsencesPage from "./pages/AbsencesPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import PartyBuilder from "./pages/PartyBuilder";
import MemberProfilePage from "./pages/MemberProfilePage";
import WeeklyReportPage from "./pages/WeeklyReportPage";
import AuctionBuilder from "./pages/AuctionBuilder";
import ImportPage from "./pages/ImportPage";
import AuditLogPage from "./pages/AuditLogPage";
import LoginPage from "./pages/LoginPage";
import UserManagementPage from "./pages/UserManagementPage";
import RequestsPage from "./pages/RequestsPage";

export default function App() {
  const {
    loading, authLoading, currentUser, userRole, myMemberId, isAdmin, isOfficer, isMember, isArchitect,
    page, setPage,
    toast, setToast, showToast,
    members, events, absences,
    notifications, requests, joinRequests
  } = useGuild();

  const [profileMember, setProfileMember] = useState(null);
  const [showTreasury, setShowTreasury] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const unreadCount = notifications.filter(n => n.targetId === "all" || (n.targetId === myMemberId && !n.isRead)).length;
  const pendingRequestsCount = 
    requests.filter(r => r.status === "pending").length + 
    joinRequests.filter(r => r.status === "pending").length;


  const handleSignOut = async () => {
    await signOut(auth);
    setPage("dashboard");
    showToast("Signed out successfully", "success");
  };

  // RBAC: Redirect members if they are on a restricted page
  React.useEffect(() => {
    if (isMember && page !== "members") {
      setPage("members");
    }
  }, [isMember, page, setPage]);

  // Show auth loading
  if (authLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-deepest)", flexDirection: "column", gap: 16 }}>
      <div style={{ fontFamily: "Cinzel,serif", fontSize: 28, color: "var(--accent)", textShadow: "0 0 20px rgba(99,130,230,0.5)" }}>OBLIVION</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13, letterSpacing: 3, textTransform: "uppercase" }}>Initializing...</div>
    </div>
  );

  // Show login if not authenticated
  if (!currentUser) return <LoginPage />;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-deepest)", flexDirection: "column", gap: 16 }}>
      <div style={{ fontFamily: "Cinzel,serif", fontSize: 28, color: "var(--accent)", textShadow: "0 0 20px rgba(99,130,230,0.5)" }}>OBLIVION</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13, letterSpacing: 3, textTransform: "uppercase" }}>Loading Guild Data...</div>
    </div>
  );

  return (
    <div className="app-root">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <img
            src={`${import.meta.env.BASE_URL}oblivion-logo.png`}
            alt="Oblivion Guild"
            style={{ width: "100%", maxWidth: 160, height: "auto", display: "block", margin: "0 auto 8px", borderRadius: 8 }}
          />
          <div className="logo-sub" style={{ textAlign: "center" }}>Guild Manager</div>
          
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
            if (isMember) return item.id === "members";
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
            if (isMember && item.id === "members") label = "My Profile";

            return (
              <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => { setPage(item.id); setProfileMember(null); }}
                style={{ justifyContent: "space-between" }}>
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
              </div>
            );
          })}
        </div>
        <div className="sidebar-footer">
          {currentUser && (
            <div className="sidebar-user-profile">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ 
                  width: 30, height: 30, borderRadius: 6, 
                  background: isArchitect ? "rgba(255,77,77,0.18)" : isAdmin ? "rgba(240,192,64,0.18)" : "rgba(99,130,230,0.18)", 
                  color: isArchitect ? "#ff4d4d" : isAdmin ? "var(--gold)" : "var(--accent)", 
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Cinzel,serif", fontSize: 11, fontWeight: 700, flexShrink: 0, 
                  boxShadow: isArchitect ? "0 0 10px rgba(255,77,77,0.3)" : "inset 0 0 8px rgba(0,0,0,0.2)" 
                }}>
                  {(currentUser.displayName || currentUser.email || "").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {currentUser.displayName || currentUser.email}
                  </div>
                  <div style={{ 
                    fontSize: 10, 
                    color: isArchitect ? "#ff4d4d" : isAdmin ? "var(--gold)" : isOfficer ? "var(--accent)" : "var(--text-muted)", 
                    letterSpacing: 1,
                    textShadow: isArchitect ? "0 0 8px rgba(255,77,77,0.4)" : "none"
                  }}>
                    {isArchitect ? "👁️‍🗨️ Architect" : isAdmin ? "★ Admin" : isOfficer ? "🛡 Officer" : "👤 Member"}
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", fontSize: 11, border: "1px solid rgba(255,255,255,0.05)" }} onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", marginBottom: 16, background: "linear-gradient(135deg, rgba(240,192,64,0.2), rgba(240,192,64,0.05))", color: "var(--gold)", border: "1px solid rgba(240,192,64,0.3)" }}
            onClick={() => setShowTreasury(true)}
          >
            <Icon name="star" size={14} /> Buy Me A Beer
          </button>

          <div style={{ marginTop: 12, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", letterSpacing: 1, textTransform: "uppercase" }}>
              Oblivion Guild Portal v1.0
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
          if (isMember) return item.id === "members";
          // Only show top 5 relevant items on mobile nav to avoid clutter
          const mobileWhitelisted = ["dashboard", "members", "events", "leaderboard", "party"];
          if (!mobileWhitelisted.includes(item.id)) return false;
          
          if (isAdmin) return true;
          if (isOfficer) return item.id !== "users" && item.id !== "auditlog";
          return false;
        }).map(item => {
          let label = item.label;
          if (isMember && item.id === "members") label = "Profile";
          if (label === "Dashboard") label = "Home"; // Shorten for mobile
          if (label === "Leaderboard") label = "Rank";

          return (
            <button key={item.id} className={`mobile-nav-item ${page === item.id ? "active" : ""}`} 
              onClick={() => { setPage(item.id); setProfileMember(null); window.scrollTo(0, 0); }}>
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
        <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
        {page === "dashboard" && <Dashboard />}

        {page === "members" && (
          isMember ? (
            members.find(m => m.memberId?.trim().toLowerCase() === (myMemberId || "").trim().toLowerCase()) ? (
              <MemberProfilePage
                member={members.find(m => m.memberId?.trim().toLowerCase() === (myMemberId || "").trim().toLowerCase())}
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
          )
        )}

        {page === "events" && (
          <EventsPage />
        )}

        {page === "absences" && (
          <AbsencesPage />
        )}

        {page === "leaderboard" && !profileMember && (
          <LeaderboardPage onViewProfile={setProfileMember} />
        )}

        {page === "leaderboard" && profileMember && (
          <MemberProfilePage member={profileMember} onBack={() => setProfileMember(null)} />
        )}

        {page === "party" && (
          <PartyBuilder />
        )}

        {page === "import" && (
          <ImportPage />
        )}

        {page === "report" && (
          <WeeklyReportPage />
        )}

        {page === "auction" && (
          <AuctionBuilder />
        )}

        {page === "users" && isArchitect && (
          <UserManagementPage />
        )}

        {page === "auditlog" && isAdmin && (
          <AuditLogPage />
        )}

        {page === "requests" && isOfficer && (
          <RequestsPage />
        )}
      </main>

      {showTreasury && <TreasuryModal onClose={() => setShowTreasury(false)} />}
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
