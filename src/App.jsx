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

// Pages
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

export default function App() {
  const {
    loading, authLoading, currentUser, isAdmin,
    page, setPage,
    toast, setToast, showToast,
    members, events, absences
  } = useGuild();

  const [profileMember, setProfileMember] = useState(null);

  const handleSignOut = async () => {
    await signOut(auth);
    setPage("dashboard");
    showToast("Signed out successfully", "success");
  };

  // Show auth loading
  if (authLoading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg-deepest)",flexDirection:"column",gap:16}}>
      <div style={{fontFamily:"Cinzel,serif",fontSize:28,color:"var(--accent)",textShadow:"0 0 20px rgba(99,130,230,0.5)"}}>OBLIVION</div>
      <div style={{color:"var(--text-muted)",fontSize:13,letterSpacing:3,textTransform:"uppercase"}}>Initializing...</div>
    </div>
  );

  // Show login if not authenticated
  if (!currentUser) return <LoginPage />;

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg-deepest)",flexDirection:"column",gap:16}}>
      <div style={{fontFamily:"Cinzel,serif",fontSize:28,color:"var(--accent)",textShadow:"0 0 20px rgba(99,130,230,0.5)"}}>OBLIVION</div>
      <div style={{color:"var(--text-muted)",fontSize:13,letterSpacing:3,textTransform:"uppercase"}}>Loading Guild Data...</div>
    </div>
  );

  return (
    <div className="app-root">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <img
            src={window.location.hostname === "localhost" ? "/oblivion-logo.png" : "/oblivion-guild-manager/oblivion-logo.png"}
            alt="Oblivion Guild"
            style={{width:"100%",maxWidth:160,height:"auto",display:"block",margin:"0 auto 8px",borderRadius:8}}
          />
          <div className="logo-sub" style={{textAlign:"center"}}>Guild Manager</div>
        </div>
        <div className="sidebar-nav">
          {NAV_ITEMS.filter(item => (item.id !== "users" && item.id !== "auditlog") || isAdmin).map(item => {
            const counts = { members: members.length, events: events.length, absences: absences.length };
            const count = counts[item.id];
            return (
              <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => { setPage(item.id); setProfileMember(null); }}
                style={{justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </div>
                {count !== undefined && (
                  <span style={{background:"rgba(99,130,230,0.15)",color:"var(--accent)",borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:700,minWidth:20,textAlign:"center"}}>
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="sidebar-footer">
          {currentUser && (
            <div style={{marginBottom:12,padding:"10px 10px",background:"rgba(99,130,230,0.08)",borderRadius:8,border:"1px solid var(--border)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{width:30,height:30,borderRadius:6,background:isAdmin?"rgba(240,192,64,0.18)":"rgba(99,130,230,0.18)",color:isAdmin?"var(--gold)":"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Cinzel,serif",fontSize:11,fontWeight:700,flexShrink:0}}>
                  {(currentUser.displayName || currentUser.email || "").slice(0,2).toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--text-primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {currentUser.displayName || currentUser.email}
                  </div>
                  <div style={{fontSize:10,color:isAdmin?"var(--gold)":"var(--accent)",letterSpacing:1}}>
                    {isAdmin ? "★ Admin" : "🛡 Officer"}
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{width:"100%",justifyContent:"center",fontSize:11}} onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          )}
          <div>⚔ Ragnarok Online</div>
          <div style={{marginTop:2}}>v1.0 · Guild System</div>
        </div>
      </nav>

      {/* Main Content Areas */}
      <main className="main-content">
        {page === "dashboard" && <Dashboard />}
        
        {page === "members" && !profileMember && (
          <MembersPage onViewProfile={setProfileMember} />
        )}
        
        {page === "members" && profileMember && (
          <MemberProfilePage member={profileMember} onBack={() => setProfileMember(null)} />
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
        
        {page === "users" && isAdmin && (
          <UserManagementPage />
        )}
        
        {page === "auditlog" && isAdmin && (
          <AuditLogPage />
        )}
      </main>

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
