import React, { useState, useEffect } from 'react';
import { useGuild } from '../context/GuildContext';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { writeAuditLog } from '../utils/audit';
import Icon from '../components/ui/icons';
import ConfettiEffect from '../components/effects/ConfettiEffect';
import StatePanel from '../components/common/StatePanel';

const normalizeDiscord = (value = "") => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function RequestsPage() {
  const { 
    requests, approveRequest, rejectRequest,
    joinRequests, approveJoinRequest, rejectJoinRequest,
    isOfficer, members, currentUser, fetchRequests, isFetchingRequests 
  } = useGuild();
  
  const [subTab, setSubTab] = useState("profile"); // profile, join, reactivation
  const [showConfetti, setShowConfetti] = useState(false);

  // Fetch requests from Firebase only when this page is actually opened.
  // This was previously triggered on every app load for all admins/officers.
  useEffect(() => {
    fetchRequests();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingRequests = requests.filter(r => r.status === "pending");
  const pendingJoin = joinRequests.filter(r => r.status === "pending" && (r.request_type || r.requestType) !== "reactivation");
  const pendingReactivation = joinRequests.filter(r => r.status === "pending" && (r.request_type || r.requestType) === "reactivation");

  const getDuplicateInfo = (app, allMembers) => {
    const matches = [];
    const id = (app.uid || "").toLowerCase();
    const ign = (app.ign || "").toLowerCase();
    const disc = normalizeDiscord(app.discord || "");

    allMembers.forEach(m => {
      if (id && (m.memberId || "").toLowerCase() === id) matches.push(`UID Match (${m.ign})`);
      if (ign && (m.ign || "").toLowerCase() === ign) matches.push(`IGN Match (${m.memberId})`);
      if (disc && normalizeDiscord(m.discord || "") === disc) matches.push(`Discord Match (${m.ign})`);
    });

    return [...new Set(matches)]; // Unique matches
  };


  const handleApprove = async (r) => {
    const success = await approveRequest(r.id);
    if (success) {
      await writeAuditLog(
        currentUser.email,
        currentUser.displayName || currentUser.email,
        "profile_request_approved",
        `Approved profile change for ${r.requesterIgn} (Member ID: ${r.memberId})`
      );
    }
  };

  const handleReject = async (r) => {
    const success = await rejectRequest(r.id);
    if (success) {
      await writeAuditLog(
        currentUser.email,
        currentUser.displayName || currentUser.email,
        "profile_request_rejected",
        `Rejected profile change for ${r.requesterIgn} (Member ID: ${r.memberId})`
      );
    }
  };

  const handleApproveJoin = async (r) => {
    const success = await approveJoinRequest(r.id);
    if (success) {
      setShowConfetti(true);
      await writeAuditLog(
        currentUser.email,
        currentUser.displayName || currentUser.email,
        (r.request_type || r.requestType) === "reactivation" ? "reactivation_request_approved" : "join_request_approved",
        `${(r.request_type || r.requestType) === "reactivation" ? "Approved reactivation" : "Approved membership"} for ${r.ign} (UID: ${r.uid})`
      );
    }
  };

  const handleRejectJoin = async (r) => {
    const success = await rejectJoinRequest(r.id);
    if (success) {
      await writeAuditLog(
        currentUser.email,
        currentUser.displayName || currentUser.email,
        (r.request_type || r.requestType) === "reactivation" ? "reactivation_request_rejected" : "join_request_rejected",
        `${(r.request_type || r.requestType) === "reactivation" ? "Rejected reactivation" : "Rejected membership"} for ${r.ign} (UID: ${r.uid})`
      );
    }
  };

  const tabItems = [
    { id: "profile", label: "Profile Updates", count: pendingRequests.length, emptyTitle: "All clear", emptyDesc: "No pending profile changes.", emptyIcon: "✨" },
    { id: "join", label: "Applications", count: pendingJoin.length, emptyTitle: "No pending applications", emptyDesc: "Guild is quiet right now.", emptyIcon: "🛡️" },
    { id: "reactivation", label: "Reactivation", count: pendingReactivation.length, emptyTitle: "No pending reactivation requests", emptyDesc: "No old accounts waiting for reactivation.", emptyIcon: "♻️" }
  ];

  const pendingRowsByTab = {
    profile: pendingRequests,
    join: pendingJoin,
    reactivation: pendingReactivation
  };
  const visiblePending = pendingRowsByTab[subTab] || [];

  if (!isOfficer) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🛡️</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 18, fontWeight: 600 }}>Access Restricted. Officers only.</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <ConfettiEffect active={showConfetti} onDone={() => setShowConfetti(false)} />
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 32, marginBottom: 8 }}>📝 Request Manager</h1>
          <div className="flex items-center gap-3">
            <p className="page-subtitle" style={{ marginBottom: 0 }}>Pending tasks requiring officer attention</p>
            <button 
              className={`btn btn-sm btn-ghost ${isFetchingRequests ? 'animate-spin' : ''}`} 
              onClick={fetchRequests}
              disabled={isFetchingRequests}
              title="Refresh Data"
            >
              <Icon name="refresh" size={14} />
            </button>
          </div>
        </div>
        
        {/* Modern Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-deepest)', padding: 4, borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          {tabItems.map(t => (
            <button
              key={t.id}
              onClick={() => { setSubTab(t.id); }}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', transition: 'all 0.3s',
                background: subTab === t.id ? 'var(--accent)' : 'transparent',
                color: subTab === t.id ? '#fff' : 'var(--text-muted)',
                boxShadow: subTab === t.id ? '0 4px 12px var(--accent-glow)' : 'none'
              }}
            >
              {t.label} {t.count > 0 && <span style={{ marginLeft: 6, background: '#fff', color: 'var(--accent)', padding: '1px 6px', borderRadius: 10, fontSize: 10 }}>{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 60 }}>
        {subTab === "profile" ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 24 }}>
            {visiblePending.length === 0 ? (
              <div style={{ gridColumn: '1/-1' }}>
                <StatePanel
                  icon="✨"
                  title="All clear"
                  description="No pending profile changes."
                />
              </div>
            ) : (
              visiblePending.map((r, idx) => {
                const mIndex = members.findIndex(m => m.memberId === r.memberId);
                const changes = [];
                if (r.oldData?.ign !== r.newData?.ign) changes.push({ label: 'IGN', old: r.oldData?.ign || "—", new: r.newData?.ign || "—" });
                if (r.oldData?.class !== r.newData?.class) changes.push({ label: 'Class', old: r.oldData?.class || "—", new: r.newData?.class || "—" });
                if (r.oldData?.role !== r.newData?.role) changes.push({ label: 'Role', old: r.oldData?.role || "—", new: r.newData?.role || "—" });

                return (
                  <div key={r.id} className="card animate-slide-up" style={{ animationDelay: `${idx * 0.1}s`, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: 20, background: 'rgba(99, 130, 230, 0.05)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
                      <MemberAvatar ign={r.requesterIgn} index={mIndex} size={48} />
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 18 }}>{r.requesterIgn}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{r.memberId}</div>
                      </div>
                    </div>
                    
                    <div style={{ padding: 20 }}>
                      <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1.5, marginBottom: 16 }}>Requested Changes</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {changes.map(c => (
                          <div key={c.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-deepest)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, width: 40 }}>{c.label}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'flex-end' }}>
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'line-through', opacity: 0.6 }}>{c.old}</span>
                              <Icon name="arrow" size={12} className="text-accent" />
                              <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700 }}>{c.new}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                        <button 
                          className="btn btn-ghost w-full" 
                          style={{ borderColor: 'rgba(224,80,80,0.3)', color: 'var(--red)', fontSize: 12 }}
                          onClick={() => handleReject(r)}
                        >
                          Reject
                        </button>
                        <button 
                          className="btn btn-primary w-full" 
                          style={{ fontSize: 12 }}
                          onClick={() => handleApprove(r)}
                        >
                          Approve Change
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: '8px 20px', background: 'var(--bg-deepest)', fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                      Requested {new Date(r.timestamp).toLocaleDateString()} at {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
            {visiblePending.length === 0 ? (
              <div style={{ gridColumn: '1/-1' }}>
                <StatePanel
                  icon={tabItems.find(t => t.id === subTab)?.emptyIcon || "🛡️"}
                  title={tabItems.find(t => t.id === subTab)?.emptyTitle || "No pending requests"}
                  description={tabItems.find(t => t.id === subTab)?.emptyDesc || "Nothing to process right now."}
                />
              </div>
            ) : (
              visiblePending.map((r, idx) => {
                const dups = getDuplicateInfo(r, members);
                const isDup = dups.length > 0;

                return (
                  <div key={r.id} className="card animate-slide-up" style={{ 
                    animationDelay: `${idx * 0.1}s`, padding: 0, overflow: 'hidden', 
                    border: isDup ? '1px solid rgba(224, 80, 80, 0.4)' : '1px solid rgba(130,90,230,0.2)',
                    boxShadow: isDup ? '0 0 20px rgba(224, 80, 80, 0.1)' : 'none'
                  }}>
                    <div style={{ padding: 20, background: isDup ? 'linear-gradient(135deg, rgba(224, 80, 80, 0.1), transparent)' : 'linear-gradient(135deg, rgba(130,90,230,0.1), transparent)', borderBottom: `1px solid ${isDup ? 'rgba(224,80,80,0.1)' : 'rgba(130,90,230,0.1)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 18 }}>{r.ign}</div>
                        <div style={{ fontSize: 12, color: isDup ? 'var(--red)' : 'var(--accent)', fontWeight: 700 }}>UID: {r.uid}</div>
                      </div>
                      <div style={{ background: isDup ? 'rgba(224, 80, 80, 0.2)' : 'rgba(130,90,230,0.2)', padding: '4px 8px', borderRadius: 6, fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>
                        {(r.request_type || r.requestType) === "reactivation" ? "REACTIVATION" : (isDup ? "DUPLICATE DATA" : "NEW APPLICANT")}
                      </div>
                    </div>
                    
                    <div style={{ padding: 20 }}>
                      {isDup && (
                        <div style={{ marginBottom: 20, padding: 12, background: 'rgba(224, 80, 80, 0.1)', borderRadius: 10, border: '1px solid rgba(224, 80, 80, 0.2)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {dups.map((d, di) => <span key={di} style={{ fontSize: 10, fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase' }}>⚠️ {d}</span>)}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                        <div style={{ background: 'var(--bg-deepest)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Job Class</div>
                          <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700 }}>{r.jobClass || r.class || "—"}</div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Combat Role</div>
                          <div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 700 }}>{r.role || "—"}</div>
                        </div>
                      </div>

                      <div style={{ background: 'var(--bg-deepest)', padding: 12, borderRadius: 10, border: '1px solid var(--border)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 24, height: 24, background: 'rgba(88,101,242,0.1)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="user" size={14} style={{ color: '#5865F2' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Discord Handle</div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{r.discord}</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 12 }}>
                        <button 
                          className="btn btn-ghost w-full" 
                          style={{ borderColor: 'rgba(224,80,80,0.3)', color: 'var(--red)', fontSize: 12 }}
                          onClick={() => handleRejectJoin(r)}
                        >
                          Reject
                        </button>
                        <button 
                          className="btn w-full" 
                          style={{ background: 'linear-gradient(135deg, #8b5cf6, var(--accent))', color: '#fff', fontSize: 12, fontWeight: 800, border: 'none', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}
                          onClick={() => handleApproveJoin(r)}
                        >
                          {(r.request_type || r.requestType) === "reactivation" ? "Approve Reactivation" : "Approve & Activate"}
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: '8px 20px', background: 'rgba(0,0,0,0.2)', fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                      Application received {new Date(r.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RequestsPage;
