import React, { useState, useMemo } from 'react';
import { useGuild } from '../context/GuildContext';
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
  const [form, setForm] = useState({ memberId: "", ign: "", class: "", role: "DPS", guildRank: "Member" });

  const filtered = members.filter(m => {
    const status = m.status || "active";
    return (status === statusFilter) &&
      (roleFilter === "All" || m.role === roleFilter) &&
      (m.ign.toLowerCase().includes(search.toLowerCase()) ||
        m.memberId.toLowerCase().includes(search.toLowerCase()) ||
        m.class.toLowerCase().includes(search.toLowerCase()));
  });

  const openAdd = () => {
    const nextNum = (members.length + 1).toString().padStart(3, "0");
    setForm({ memberId: `OBL${nextNum}`, ign: "", class: "", role: "DPS", guildRank: "Member" });
    setEditMember(null);
    setShowModal(true);
  };

  const openEdit = (m) => {
    setForm({ ...m });
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

  const classThemes = {
    "Lord Knight": { color: "var(--color-knight)", icon: "⚔️" },
    "Paladin": { color: "var(--color-knight)", icon: "🛡️" },
    "High Priest": { color: "var(--color-priest)", icon: "✨" },
    "Professor": { color: "var(--color-priest)", icon: "📖" },
    "High Wizard": { color: "var(--color-wizard)", icon: "🔮" },
    "Sniper": { color: "var(--color-sniper)", icon: "🏹" },
    "Assassin Cross": { color: "var(--color-assassin)", icon: "🔪" },
    "Stalker": { color: "var(--color-assassin)", icon: "🎭" },
    "Whitesmith": { color: "var(--color-blacksmith)", icon: "🔨" },
    "Creator": { color: "var(--color-blacksmith)", icon: "🧪" },
    "Champion": { color: "var(--color-knight)", icon: "👊" },
    "Minstrel": { color: "var(--color-priest)", icon: "🎵" },
    "Diva": { color: "var(--color-priest)", icon: "🎤" },
  };
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

        {/* Member Card Grid */}
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">⚔</div><div className="empty-state-text">No members found</div></div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, padding: 4 }}>
            {filtered.map(m => {
              const theme = classThemes[m.class] || { color: "var(--color-others)", icon: "👤" };
              const idx = members.indexOf(m);
              // Compute GL score for rank
              return (
                <div key={m.memberId}
                  className="animate-fade-in"
                  style={{
                    background: "var(--bg-card2)",
                    border: `1px solid ${theme.color}33`,
                    borderRadius: 14,
                    padding: "20px 16px",
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 0.22s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 12px 32px ${theme.color}22`; e.currentTarget.style.borderColor = `${theme.color}88`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.borderColor = `${theme.color}33`; }}
                >
                  {/* BG glow */}
                  <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, borderRadius: "0 14px 0 0", background: `radial-gradient(circle at top right, ${theme.color}, transparent 70%)`, opacity: 0.12, pointerEvents: "none" }} />

                  {/* Class icon top-right */}
                  <div style={{ position: "absolute", top: 12, right: 14, fontSize: 22, opacity: 0.5 }}>{theme.icon}</div>

                  {/* Avatar + IGN */}
                  <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                    <div style={{ position: "relative" }}>
                      <MemberAvatar ign={m.ign} index={idx} size={48} memberClass={m.class} hexagon />
                      {/* Online dot decoration */}
                      <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: theme.color, border: "2px solid var(--bg-card2)", boxShadow: `0 0 6px ${theme.color}` }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ fontFamily: "Cinzel, serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)", cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        onClick={() => onViewProfile && onViewProfile(m)}
                        title={m.ign}
                      >{m.ign}</div>
                      <div style={{ fontSize: 11, color: theme.color, fontWeight: 600, marginTop: 2 }}>{theme.icon} {m.class}</div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: `linear-gradient(90deg, ${theme.color}44, transparent)`, marginBottom: 12 }} />

                  {/* Badges row */}
                  <div className="flex gap-2" style={{ flexWrap: "wrap", marginBottom: 14 }}>
                    <span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 10 }}>
                      {m.role === "DPS" ? "⚔" : "🛡"} {m.role}
                    </span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700, background: `${theme.color}22`, color: theme.color, border: `1px solid ${theme.color}44` }}>
                      {m.memberId}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 justify-end">
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => onViewProfile && onViewProfile(m)}>View</button>
                    {isOfficer && (
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(m)} title="Edit"><Icon name="edit" size={13} /></button>
                    )}
                    {isAdmin && (
                      <button className={`btn btn-sm ${statusFilter === "active" ? "btn-archive" : "btn-restore"}`}
                        style={{ fontSize: 10, padding: "4px 8px" }}
                        onClick={() => toggleArchive(m.memberId)}
                        title={statusFilter === "active" ? "Archive" : "Restore"}>
                        {statusFilter === "active" ? "Archive" : "Restore"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
              <input className="form-input" value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))} disabled={!!editMember} />
            </div>
            <div className="form-group">
              <label className="form-label">IGN</label>
              <input className="form-input" placeholder="In-game name" value={form.ign} onChange={e => setForm(f => ({ ...f, ign: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Class</label>
              <input className="form-input" placeholder="e.g. Lord Knight" value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="DPS">DPS</option>
                <option value="Support">Support / Utility</option>
              </select>
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
                  {isAdmin && <option value="System Architect">System Architect (Creator)</option>}
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
