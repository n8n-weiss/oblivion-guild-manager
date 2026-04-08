import React, { useState } from 'react';
import { useGuild } from '../context/GuildContext';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { writeAuditLog } from '../utils/audit';
import Icon from '../components/ui/icons';
import ConfettiEffect from '../components/effects/ConfettiEffect';

function RequestsPage() {
  const { 
    requests, approveRequest, rejectRequest, deleteRequest, clearProcessedRequests,
    joinRequests, approveJoinRequest, rejectJoinRequest, deleteJoinRequest,
    isOfficer, isArchitect, members, currentUser 
  } = useGuild();
  
  const [subTab, setSubTab] = useState("profile"); // profile, join
  const [showConfetti, setShowConfetti] = useState(false);

  const pendingRequests = requests.filter(r => r.status === "pending");
  const pendingJoin = joinRequests.filter(r => r.status === "pending");
  
  const processedRequests = requests.filter(r => r.status !== "pending");
  const processedJoin = joinRequests.filter(r => r.status !== "pending");

  const getDuplicateInfo = (app, allMembers) => {
    const matches = [];
    const id = (app.uid || "").toLowerCase();
    const ign = (app.ign || "").toLowerCase();
    const disc = (app.discord || "").toLowerCase();

    allMembers.forEach(m => {
      if ((m.memberId || "").toLowerCase() === id) matches.push(`UID Match (${m.ign})`);
      if ((m.ign || "").toLowerCase() === ign) matches.push(`IGN Match (${m.memberId})`);
      if ((m.discord || "").toLowerCase() === disc) matches.push(`Discord Match (${m.ign})`);
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
        "join_request_approved",
        `Approved membership for ${r.ign} (UID: ${r.uid})`
      );
    }
  };

  const handleRejectJoin = async (r) => {
    const success = await rejectJoinRequest(r.id);
    if (success) {
      await writeAuditLog(
        currentUser.email,
        currentUser.displayName || currentUser.email,
        "join_request_rejected",
        `Rejected membership for ${r.ign} (UID: ${r.uid})`
      );
    }
  };

  const handleDelete = async (r, type = "profile") => {
    const success = type === "profile" ? await deleteRequest(r.id) : await deleteJoinRequest(r.id);
    if (success) {
      await writeAuditLog(
        currentUser.email,
        currentUser.displayName || currentUser.email,
        `${type}_request_deleted`,
        `Deleted processed request history for ${r.requesterIgn || r.ign}`
      );
    }
  };

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
          <p className="page-subtitle">Premium dashboard for member data & applications</p>
        </div>
        
        {/* Modern Tab Switcher */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', padding: 4, borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}>
          <button 
            onClick={() => setSubTab("profile")}
            style={{ 
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', transition: 'all 0.3s',
              background: subTab === "profile" ? 'var(--accent)' : 'transparent',
              color: subTab === "profile" ? '#fff' : 'var(--text-muted)',
              boxShadow: subTab === "profile" ? '0 4px 12px var(--accent-glow)' : 'none'
            }}
          >
            Profile Updates {pendingRequests.length > 0 && <span style={{ marginLeft: 6, background: '#fff', color: 'var(--accent)', padding: '1px 6px', borderRadius: 10, fontSize: 10 }}>{pendingRequests.length}</span>}
          </button>
          <button 
            onClick={() => setSubTab("join")}
            style={{ 
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', transition: 'all 0.3s',
              background: subTab === "join" ? 'var(--accent)' : 'transparent',
              color: subTab === "join" ? '#fff' : 'var(--text-muted)',
              boxShadow: subTab === "join" ? '0 4px 12px var(--accent-glow)' : 'none'
            }}
          >
            Applications {pendingJoin.length > 0 && <span style={{ marginLeft: 6, background: '#fff', color: 'var(--accent)', padding: '1px 6px', borderRadius: 10, fontSize: 10 }}>{pendingJoin.length}</span>}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 60 }}>
        {subTab === "profile" ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 24 }}>
            {pendingRequests.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px dashed var(--border)' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✨</div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>All clear! No pending profile changes.</div>
              </div>
            ) : (
              pendingRequests.map((r, idx) => {
                const mIndex = members.findIndex(m => m.memberId === r.memberId);
                const changes = [];
                if (r.oldData.ign !== r.newData.ign) changes.push({ label: 'IGN', old: r.oldData.ign, new: r.newData.ign });
                if (r.oldData.class !== r.newData.class) changes.push({ label: 'Class', old: r.oldData.class, new: r.newData.class });
                if (r.oldData.role !== r.newData.role) changes.push({ label: 'Role', old: r.oldData.role, new: r.newData.role });

                return (
                  <div key={r.id} className="card animate-slide-up" style={{ animationDelay: `${idx * 0.1}s`, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: 20, background: 'rgba(99, 130, 230, 0.05)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
                      <MemberAvatar ign={r.requesterIgn} index={mIndex} size={48} />
                      <div>
                        <div style={{ fontWeight: 800, color: '#fff', fontSize: 18 }}>{r.requesterIgn}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{r.memberId}</div>
                      </div>
                    </div>
                    
                    <div style={{ padding: 20 }}>
                      <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1.5, marginBottom: 16 }}>Requested Changes</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {changes.map(c => (
                          <div key={c.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, width: 40 }}>{c.label}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'flex-end' }}>
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'line-through', opacity: 0.6 }}>{c.old}</span>
                              <Icon name="arrow" size={12} className="text-accent" />
                              <span style={{ fontSize: 14, color: '#fff', fontWeight: 700, textShadow: '0 0 10px var(--accent-glow)' }}>{c.new}</span>
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
                    <div style={{ padding: '8px 20px', background: 'rgba(0,0,0,0.2)', fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                      Requested {new Date(r.timestamp).toLocaleDateString()} at {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
            {pendingJoin.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px dashed var(--border)' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🛡️</div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>No pending applications. Guild is quiet.</div>
              </div>
            ) : (
              pendingJoin.map((r, idx) => {
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
                        <div style={{ fontWeight: 800, color: '#fff', fontSize: 18 }}>{r.ign}</div>
                        <div style={{ fontSize: 12, color: isDup ? 'var(--red)' : 'var(--accent)', fontWeight: 700 }}>UID: {r.uid}</div>
                      </div>
                      <div style={{ background: isDup ? 'rgba(224, 80, 80, 0.2)' : 'rgba(130,90,230,0.2)', padding: '4px 8px', borderRadius: 6, fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>
                        {isDup ? "DUPLICATE DATA" : "NEW APPLICANT"}
                      </div>
                    </div>
                    
                    <div style={{ padding: 20 }}>
                      {isDup && (
                        <div style={{ marginBottom: 20, padding: 12, background: 'rgba(224, 80, 80, 0.1)', borderRadius: 10, border: '1px solid rgba(224, 80, 80, 0.2)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {dups.map((d, di) => <span key={di} style={{ fontSize: 10, fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase' }}>⚠️ {d}</span>)}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Job Class</div>
                          <div style={{ fontSize: 14, color: '#fff', fontWeight: 700 }}>{r.jobClass}</div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Combat Role</div>
                          <div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 700 }}>{r.role}</div>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 24, height: 24, background: 'rgba(88,101,242,0.15)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="user" size={14} style={{ color: '#5865F2' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Discord Handle</div>
                          <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{r.discord}</div>
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
                          Approve Join
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

      {/* History Section - Sleek Table */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>📜 Processing History</h2>
          {isArchitect && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, opacity: 0.6 }} onClick={clearProcessedRequests}>
              <Icon name="trash" size={12} /> Clear All
            </button>
          )}
        </div>
        
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '16px 20px' }}>Member/Applicant</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Date Processed</th>
                  {isArchitect && <th style={{ textAlign: "right", paddingRight: 20 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {[...processedRequests, ...processedJoin]
                  .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .slice(0, 10)
                  .map(r => {
                    const isJoin = r.uid !== undefined;
                    return (
                      <tr key={r.id}>
                        <td style={{ padding: '12px 20px', fontWeight: 700 }}>{r.requesterIgn || r.ign}</td>
                        <td>
                          <span style={{ 
                            fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase',
                            background: isJoin ? 'rgba(139,92,246,0.15)' : 'rgba(99,130,230,0.15)',
                            color: isJoin ? '#a78bfa' : 'var(--accent)',
                            border: isJoin ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(99,130,230,0.3)'
                          }}>
                            {isJoin ? "Join App" : "Profile"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.status === "approved" ? 'var(--green)' : 'var(--red)', boxShadow: `0 0 8px ${r.status === "approved" ? 'var(--green)' : 'var(--red)'}` }} />
                            <span style={{ fontWeight: 700, color: r.status === "approved" ? 'var(--green)' : 'var(--red)', textTransform: 'uppercase' }}>{r.status}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {isJoin ? `${r.jobClass} | ${r.role}` : `${r.newData.ign} | ${r.newData.class}`}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {new Date(r.timestamp).toLocaleDateString()}
                        </td>
                        {isArchitect && (
                          <td style={{ paddingRight: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn btn-ghost btn-icon" 
                                style={{ color: 'var(--red)', opacity: 0.5 }}
                                onClick={() => handleDelete(r, isJoin ? "join" : "profile")}
                              >
                                <Icon name="trash" size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                {[...processedRequests, ...processedJoin].length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      No processing history found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RequestsPage;
