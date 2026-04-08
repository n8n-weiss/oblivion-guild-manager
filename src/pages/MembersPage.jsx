import React, { useState, useMemo, useEffect } from 'react';
import { useGuild } from '../context/GuildContext';
import { JOB_CLASSES } from '../utils/constants';
import Icon from '../components/ui/icons';
import Modal from '../components/ui/Modal';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { writeAuditLog } from "../utils/audit";

function MembersPage({ onViewProfile }) {
  const { members, setMembers, showToast, isAdmin, isOfficer, isArchitect, currentUser, onlineUsers = [] } = useGuild();
  const MEMBER_DRAFT_KEY = "draft_member_modal_v1";
  const [search, setSearch] = useState(() => localStorage.getItem("members_search") || "");
  const [roleFilter, setRoleFilter] = useState(() => localStorage.getItem("members_roleFilter") || "All");
  const [statusFilter, setStatusFilter] = useState(() => localStorage.getItem("members_statusFilter") || "active");
  const [showModal, setShowModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [form, setForm] = useState({ memberId: "", ign: "", class: "", role: "DPS", guildRank: "Member", joinDate: new Date().toISOString().split("T")[0] });

  const RANK_ORDER = {
    "Guild Master": 0,
    "Vice Guild Master": 1,
    "Commander": 2,
    "Charisma Baby": 3,
    "System Architect (Creator)": 4,
    "Officer": 5,
    "Member": 6,
  };

  const getRankPriority = (rank) => RANK_ORDER[rank] ?? 7;

  const filtered = members
    .filter(m => {
      const status = m.status || "active";
      return (status === statusFilter) &&
        (roleFilter === "All" || m.role === roleFilter) &&
        (m.ign.toLowerCase().includes(search.toLowerCase()) ||
          m.memberId.toLowerCase().includes(search.toLowerCase()) ||
          m.class.toLowerCase().includes(search.toLowerCase()));
    })
    .sort((a, b) => {
      const rankDiff = getRankPriority(a.guildRank) - getRankPriority(b.guildRank);
      if (rankDiff !== 0) return rankDiff;
      return a.ign.localeCompare(b.ign); // alphabetical within same rank
    });

  const openAdd = () => {
    const nextNum = (members.length + 1).toString().padStart(3, "0");
    const fresh = { memberId: `OBL${nextNum}`, ign: "", class: "", role: "DPS", guildRank: "Member", joinDate: new Date().toISOString().split("T")[0] };
    let nextForm = fresh;
    try {
      const raw = localStorage.getItem(MEMBER_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.mode === "add" && parsed?.form && window.confirm("Restore unsaved new-member draft?")) {
          nextForm = parsed.form;
        }
      }
    } catch {
      localStorage.removeItem(MEMBER_DRAFT_KEY);
    }
    setForm(nextForm);
    setEditMember(null);
    setShowModal(true);
  };

  const openEdit = (m) => {
    setForm({ joinDate: new Date().toISOString().split("T")[0], ...m });
    setEditMember(m.memberId);
    setShowModal(true);
  };

  const toggleArchive = (id) => {
    const isRestoring = statusFilter === "left";
    const beforeMembers = members;
    const nextMembers = members.map(m => m.memberId === id ? { ...m, status: isRestoring ? "active" : "left" } : m);
    setMembers(nextMembers);
    showToast(isRestoring ? "Member restored" : "Member archived", "success");
    showToast(`Action applied to ${members.find(x => x.memberId === id)?.ign || id}`, "info", {
      label: "Undo",
      onClick: () => {
        setMembers(beforeMembers);
        showToast("Undo successful", "success");
      }
    });
    const m = members.find(x => x.memberId === id);
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, isRestoring ? "member_restore" : "member_archive", `${isRestoring ? "Restored" : "Archived"} member ${m?.ign} (${id})`);
  };

  const deleteMemberRecord = (id) => {
    const m = members.find(x => x.memberId === id);
    if (!window.confirm(`PERMANENTLY DELETE ${m?.ign}? This cannot be undone and will remove them from the roster totally.`)) return;
    
    const beforeMembers = members;
    setMembers(prev => prev.filter(x => x.memberId !== id));
    showToast(`Member ${m?.ign} deleted permanently`, "success");
    showToast("Member removed from list", "warning", {
      label: "Undo",
      onClick: () => {
        setMembers(beforeMembers);
        showToast("Delete undone", "success");
      }
    });
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "member_delete_permanent", `PERMANENTLY DELETED member ${m?.ign} (${id})`);
  };

  const classThemes = useMemo(() => {
    const themes = {};
    JOB_CLASSES.forEach(branch => {
      branch.jobs.forEach(job => {
        themes[job.name] = { color: job.color, icon: job.emoji };
      });
    });
    // Fallbacks for any legacy data
    themes["Professor"] = { color: "var(--color-priest)", icon: "📖" };
    themes["Whitesmith"] = { color: "var(--color-blacksmith)", icon: "🔨" };
    themes["Creator"] = { color: "var(--color-blacksmith)", icon: "🧪" };
    themes["Minstrel"] = { color: "var(--color-priest)", icon: "🎵" };
    themes["Diva"] = { color: "var(--color-priest)", icon: "🎤" };
    return themes;
  }, []);

  useEffect(() => { localStorage.setItem("members_search", search); }, [search]);
  useEffect(() => { localStorage.setItem("members_roleFilter", roleFilter); }, [roleFilter]);
  useEffect(() => { localStorage.setItem("members_statusFilter", statusFilter); }, [statusFilter]);
  useEffect(() => {
    if (!showModal) return;
    localStorage.setItem(MEMBER_DRAFT_KEY, JSON.stringify({ mode: editMember ? "edit" : "add", form, ts: Date.now() }));
  }, [showModal, editMember, form]);
  const { attendance = [], performance = [], events = [], eoRatings = [] } = useGuild();
  const getMemberBadges = (mId) => {
    const list = [];
    const id = (mId || "").toLowerCase();
    const mEvents = events
      .map(e => {
        const att = attendance.find(a => (a.memberId || "").toLowerCase() === id && a.eventId === e.eventId);
        const perf = performance.find(p => (p.memberId || "").toLowerCase() === id && p.eventId === e.eventId);
        return { ...e, att, perf };
      })
      .filter(e => e.att)
      .sort((a,b) => new Date(b.eventDate) - new Date(a.eventDate));

    if (mEvents.slice(0, 4).length === 4 && mEvents.slice(0, 4).every(e => e.att?.status === "present")) list.push("🛡️");
    if (mEvents.some(e => e.eventType === "Guild League" && ((e.perf?.ctfPoints || 0) + (e.perf?.performancePoints || 0)) >= 30)) list.push("⚔️");
    const mRatings = eoRatings.filter(r => (r.memberId || "").toLowerCase() === id);
    if (mRatings.some(r => r.rating === 5)) list.push("🌟");
    return list;
  };


  const saveMember = () => {
    if (!form.ign.trim() || !form.class.trim()) { showToast("Fill all fields", "error"); return; }
    if (editMember) {
      const existing = members.find(m => m.memberId === editMember);
      setMembers(prev => prev.map(m => m.memberId === editMember ? { ...form } : m));
      showToast("Member updated", "success");
      // Log rank change separately if it changed
      if (existing?.guildRank !== form.guildRank) {
        writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "rank_change", `Rank changed for ${form.ign} (${form.memberId}): ${existing?.guildRank || "Member"} → ${form.guildRank}`);
      }
      writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "member_edit", `Edited member ${form.ign} (${form.memberId}) — Class: ${form.class}, Role: ${form.role}, Rank: ${form.guildRank}`);
    } else {
      if (members.find(m => m.memberId === form.memberId)) { showToast("ID already exists", "error"); return; }
      setMembers(prev => [...prev, { ...form }]);
      showToast("Member added", "success");
      writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "member_add", `Added new member ${form.ign} (${form.memberId}) — ${form.class}, ${form.role}`);
    }
    setShowModal(false);
    localStorage.removeItem(MEMBER_DRAFT_KEY);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">👿 Members</h1>
        <p className="page-subtitle">Manage all guild members — {members.length} registered</p>
      </div>

      <div className="card">
        {/* Quick View Summary (Mobile Only) */}
        <div className="show-on-mobile quick-summary-bar">
          <div className="summary-item">
            <span className="summary-label">TOTAL</span>
            <span className="summary-value" style={{ color: 'var(--accent)' }}>{members.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">ACTIVE</span>
            <span className="summary-value" style={{ color: 'var(--green)' }}>{members.filter(m => (m.status || "active") === "active").length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">DPS</span>
            <span className="summary-value" style={{ color: 'var(--accent2)' }}>{members.filter(m => m.role === "DPS" && (m.status || "active") === "active").length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">SUPPORTS</span>
            <span className="summary-value" style={{ color: 'var(--gold)' }}>{members.filter(m => m.role === "Support" && (m.status || "active") === "active").length}</span>
          </div>
        </div>

        <div className="section-header">
          <div className="flex gap-2 items-center">
            <div className="search-bar">
              <span className="search-icon"><Icon name="search" size={14} /></span>
              <input className="form-input" placeholder="Search IGN, ID, class…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <select className="form-select" style={{ width: "auto" }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option>All</option><option>DPS</option><option>Support</option>
              </select>
              <div className="flex gap-1 p-1 bg-deepest rounded-lg border border-border">
                <button className={`btn btn-sm ${statusFilter === "active" ? "btn-primary" : "btn-ghost"}`} onClick={() => setStatusFilter("active")} style={{ fontSize: 10 }}>Active</button>
                <button className={`btn btn-sm ${statusFilter === "left" ? "btn-danger" : "btn-ghost"}`} onClick={() => setStatusFilter("left")} style={{ fontSize: 10 }}>Left</button>
              </div>
            </div>
          </div>
          {isOfficer && (
            <button className="btn btn-primary" onClick={openAdd} style={{ width: "100%", maxWidth: "none" }}><Icon name="plus" size={14} /> Add Member</button>
          )}
        </div>

        {/* Member Table */}
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">⚔</div><div className="empty-state-text">No members found</div></div>
        ) : (
          <>
            <div className="table-wrap hide-on-mobile">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>#</th>
                  <th>Member</th>
                  <th>Class</th>
                  <th>Role</th>
                  <th>Guild Rank</th>
                  <th>Joined</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => {
                  const theme = classThemes[m.class] || { color: "var(--color-others)", icon: "👤" };
                  const idx = members.indexOf(m);
                  const isOnline = onlineUsers.some(ou => (ou.memberId && ou.memberId === m.memberId) || (ou.displayName && ou.displayName.toLowerCase() === m.ign.toLowerCase()));
                  return (
                    <tr key={m.memberId} className="animate-fade-in" style={{ borderLeft: `3px solid ${theme.color}55` }}>
                      {/* Row number */}
                      <td style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 700, paddingRight: 0 }}>
                        {i + 1}
                      </td>

                      {/* Member identity */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <MemberAvatar ign={m.ign} index={idx} size={36} memberClass={m.class} />
                            <div style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderRadius: "50%", background: theme.color, border: "2px solid var(--bg-deepest)", boxShadow: `0 0 4px ${theme.color}` }} />
                          </div>
                          <div>
                            <div
                              style={{ fontFamily: "Cinzel, serif", fontWeight: 700, fontSize: 14, color: "var(--text-primary)", cursor: "pointer", lineHeight: 1.2, display: "flex", alignItems: "center", gap: 6 }}
                              onClick={() => onViewProfile && onViewProfile(m)}
                              title="View profile"
                            >
                              {m.ign}
                              {isOnline && <span title="Online" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 8px var(--green)", display: "inline-block", flexShrink: 0 }}></span>}

                              <div style={{ display: "flex", gap: 2 }}>
                                {getMemberBadges(m.memberId).map((b, bi) => <span key={bi} style={{ fontSize: 12 }}>{b}</span>)}
                              </div>
                            </div>

                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{m.memberId}</div>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontSize: 12, fontWeight: 700, padding: "3px 10px",
                          borderRadius: 20, background: `${theme.color}18`,
                          color: theme.color, border: `1px solid ${theme.color}44`,
                          whiteSpace: "nowrap"
                        }}>
                          {theme.icon} {m.class || "—"}
                        </span>
                      </td>

                      {/* Role */}
                      <td>
                        <span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 11 }}>
                          {m.role === "DPS" ? "⚔" : "🛡"} {m.role}
                        </span>
                      </td>

                      {/* Guild rank */}
                      <td style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
                        {m.guildRank || "Member"}
                      </td>

                      {/* Join date */}
                      <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {m.joinDate || "—"}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="flex gap-1 justify-end" style={{ flexWrap: "nowrap" }}>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => onViewProfile && onViewProfile(m)}>View</button>
                          {isOfficer && (
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(m)} title="Edit"><Icon name="edit" size={13} /></button>
                          )}
                          {isAdmin && (
                            <button
                              className={`btn btn-sm ${statusFilter === "active" ? "btn-archive" : "btn-restore"}`}
                              style={{ fontSize: 10, padding: "4px 8px" }}
                              onClick={() => toggleArchive(m.memberId)}
                              title={statusFilter === "active" ? "Archive" : "Restore"}
                            >
                              {statusFilter === "active" ? "Archive" : "Restore"}
                            </button>
                          )}
                          {isArchitect && (
                            <button className="btn btn-ghost btn-sm btn-icon text-red" onClick={() => deleteMemberRecord(m.memberId)} title="Permanent Delete">
                              <Icon name="trash" size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="show-on-mobile">
            {filtered.map((m) => {
              const theme = classThemes[m.class] || { color: "var(--color-others)", icon: "👤" };
              const idx = members.indexOf(m);
              const isOnline = onlineUsers.some(ou => (ou.memberId && ou.memberId === m.memberId) || (ou.displayName && ou.displayName.toLowerCase() === m.ign.toLowerCase()));
              return (
                <div key={m.memberId} className="glass-card-mobile animate-fade-in" style={{ borderLeft: `4px solid ${theme.color}` }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div style={{ position: "relative" }}>
                        <MemberAvatar ign={m.ign} index={idx} size={44} memberClass={m.class} />
                        <div style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: "50%", background: theme.color, border: "2px solid var(--bg-deepest)" }} />
                      </div>
                      <div>
                        <div style={{ fontFamily: "Cinzel, serif", fontWeight: 700, fontSize: 16, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }} onClick={() => onViewProfile && onViewProfile(m)}>
                          {m.ign}
                          {isOnline && <span title="Online" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 8px var(--green)", display: "inline-block", flexShrink: 0 }}></span>}
                          <div style={{ display: "flex", gap: 2 }}>
                            {getMemberBadges(m.memberId).map((b, bi) => <span key={bi} style={{ fontSize: 12 }}>{b}</span>)}
                          </div>
                        </div>

                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.memberId}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>{m.guildRank || "Member"}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Joined {m.joinDate || "—"}</div>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <span style={{ 
                      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 10px", 
                      borderRadius: 20, background: `${theme.color}18`, color: theme.color, border: `1px solid ${theme.color}33` 
                    }}>
                      {theme.icon} {m.class}
                    </span>
                    <span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 10 }}>
                      {m.role === "DPS" ? "⚔" : "🛡"} {m.role}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => onViewProfile && onViewProfile(m)}>View Profile</button>
                    {isOfficer && (
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(m)}><Icon name="edit" size={14} /></button>
                    )}
                    {isAdmin && (
                      <button className={`btn btn-sm ${statusFilter === "active" ? "btn-archive" : "btn-restore"}`} style={{ fontSize: 10 }} onClick={() => toggleArchive(m.memberId)}>
                        {statusFilter === "active" ? "Archive" : "Restore"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>

      {showModal && (
        <Modal title={editMember ? "Edit Member" : "Add Member"} onClose={() => { setShowModal(false); localStorage.removeItem(MEMBER_DRAFT_KEY); }}
          footer={<><button className="btn btn-ghost" onClick={() => { setShowModal(false); localStorage.removeItem(MEMBER_DRAFT_KEY); }}>Cancel</button><button className="btn btn-primary" onClick={saveMember}><Icon name="save" size={14} /> Save</button></>}
        >
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Member ID</label>
              <input className="form-input" value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))} disabled={!!editMember && !isAdmin} />
            </div>
            <div className="form-group">
              <label className="form-label">IGN</label>
              <input className="form-input" placeholder="In-game name" value={form.ign} onChange={e => setForm(f => ({ ...f, ign: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Class</label>
              <select className="form-select" value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))}>
                <option value="">-- Select Class --</option>
                {JOB_CLASSES.map(branch => (
                  <optgroup key={branch.branch} label={branch.branch}>
                    {branch.jobs.map(job => (
                      <option key={job.name} value={job.name}>{job.emoji} {job.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="DPS">DPS</option>
                <option value="Support">Support / Utility</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Join Date</label>
              <input type="date" className="form-input" value={form.joinDate} onChange={e => setForm(f => ({ ...f, joinDate: e.target.value }))} />
            </div>
            {isAdmin && (
              <div className="form-group">
                <label className="form-label">Guild Rank</label>
                <select className="form-select" value={form.guildRank || "Member"} onChange={e => setForm(f => ({ ...f, guildRank: e.target.value }))}>
                  <option value="Member">Member</option>
                  <option value="Officer">Officer</option>
                  <option value="Charisma Baby">Charisma Baby</option>
                  <option value="Commander">Commander</option>
                  <option value="Vice Guild Master">Vice Guild Master</option>
                  <option value="Guild Master">Guild Master</option>
                  {isArchitect && <option value="System Architect (Creator)">System Architect (Creator)</option>}
                </select>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default MembersPage;
