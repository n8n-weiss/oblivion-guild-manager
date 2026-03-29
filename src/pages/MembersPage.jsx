import React, { useState, useMemo } from 'react';
import { useGuild } from '../context/GuildContext';
import { JOB_CLASSES } from '../utils/constants';
import Icon from '../components/ui/icons';
import Modal from '../components/ui/Modal';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { writeAuditLog } from "./AuditLogPage";

function MembersPage({ onViewProfile }) {
  const { members, setMembers, showToast, isAdmin, isOfficer, isMember, isArchitect, currentUser } = useGuild();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("active");
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
    setForm({ memberId: `OBL${nextNum}`, ign: "", class: "", role: "DPS", guildRank: "Member", joinDate: new Date().toISOString().split("T")[0] });
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
    setMembers(prev => prev.map(m => m.memberId === id ? { ...m, status: isRestoring ? "active" : "left" } : m));
    showToast(isRestoring ? "Member restored" : "Member archived", "success");
    const m = members.find(x => x.memberId === id);
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, isRestoring ? "member_restore" : "member_archive", `${isRestoring ? "Restored" : "Archived"} member ${m?.ign} (${id})`);
  };

  const deleteMemberRecord = (id) => {
    const m = members.find(x => x.memberId === id);
    if (!window.confirm(`PERMANENTLY DELETE ${m?.ign}? This cannot be undone and will remove them from the roster totally.`)) return;
    
    setMembers(prev => prev.filter(x => x.memberId !== id));
    showToast(`Member ${m?.ign} deleted permanently`, "success");
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
  const getRankInfo = (score) => {
    if (score >= 200) return { rank: "LEGEND", color: "#ff4d4d" };
    if (score >= 150) return { rank: "ELITE", color: "#ffcc00" };
    if (score >= 100) return { rank: "VETERAN", color: "#33cc33" };
    if (score >= 50) return { rank: "SOLDIER", color: "#4db8ff" };
    return { rank: "NOVICE", color: "#999999" };
  };

  const saveMember = () => {
    if (!form.ign.trim() || !form.class.trim()) { showToast("Fill all fields", "error"); return; }
    if (editMember) {
      setMembers(prev => prev.map(m => m.memberId === editMember ? { ...form } : m));
      showToast("Member updated", "success");
      writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "member_edit", `Edited member ${form.ign} (${form.memberId}) — Class: ${form.class}, Role: ${form.role}`);
    } else {
      if (members.find(m => m.memberId === form.memberId)) { showToast("ID already exists", "error"); return; }
      setMembers(prev => [...prev, { ...form }]);
      showToast("Member added", "success");
      writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "member_add", `Added new member ${form.ign} (${form.memberId}) — ${form.class}, ${form.role}`);
    }
    setShowModal(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">👿 Members</h1>
        <p className="page-subtitle">Manage all guild members — {members.length} registered</p>
      </div>

      <div className="card">
        <div className="section-header">
          <div className="flex gap-2 items-center">
            <div className="search-bar">
              <span className="search-icon"><Icon name="search" size={14} /></span>
              <input className="form-input" placeholder="Search IGN, ID, class…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ width: "auto" }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option>All</option><option>DPS</option><option>Support</option>
            </select>
            <div className="flex gap-1 p-1 bg-deepest rounded-lg border border-border">
              <button className={`btn btn-sm ${statusFilter === "active" ? "btn-primary" : "btn-ghost"}`} onClick={() => setStatusFilter("active")} style={{ fontSize: 10 }}>Active</button>
              <button className={`btn btn-sm ${statusFilter === "left" ? "btn-danger" : "btn-ghost"}`} onClick={() => setStatusFilter("left")} style={{ fontSize: 10 }}>Left</button>
            </div>
          </div>
          {isOfficer && (
            <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={14} /> Add Member</button>
          )}
        </div>

        {/* Member Table */}
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">⚔</div><div className="empty-state-text">No members found</div></div>
        ) : (
          <div className="table-wrap">
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
                              style={{ fontFamily: "Cinzel, serif", fontWeight: 700, fontSize: 14, color: "var(--text-primary)", cursor: "pointer", lineHeight: 1.2 }}
                              onClick={() => onViewProfile && onViewProfile(m)}
                              title="View profile"
                            >
                              {m.ign}
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
        )}
      </div>

      {showModal && (
        <Modal title={editMember ? "Edit Member" : "Add Member"} onClose={() => setShowModal(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveMember}><Icon name="save" size={14} /> Save</button></>}
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
