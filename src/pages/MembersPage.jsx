import React, { useState } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import Modal from '../components/ui/Modal';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { writeAuditLog } from "./AuditLogPage";

function MembersPage({ onViewProfile }) {
  const { members, setMembers, showToast, isAdmin, isOfficer, isMember, currentUser } = useGuild();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("active");
  const [showModal, setShowModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [form, setForm] = useState({ memberId: "", ign: "", class: "", role: "DPS" });

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
    setForm({ memberId: `OBL${nextNum}`, ign: "", class: "", role: "DPS" });
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

        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Member ID</th><th>IGN</th><th>Class</th><th>Role</th><th style={{ textAlign: "right" }}>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.memberId}>
                  <td><span className="font-cinzel text-xs text-muted">{m.memberId}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <MemberAvatar ign={m.ign} index={members.indexOf(m)} size={34} />
                      <span style={{ fontWeight: 700, cursor: "pointer", color: "var(--accent)" }}
                        onClick={() => onViewProfile && onViewProfile(m)}>{m.ign}</span>
                    </div>
                  </td>
                  <td><span className="text-secondary">{m.class}</span></td>
                  <td>
                    <span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`}>
                      {m.role === "DPS" ? <Icon name="sword" size={10} /> : <Icon name="shield" size={10} />}
                      {m.role}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2 justify-end">
                      {isOfficer && (
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(m)} title="Edit"><Icon name="edit" size={14} /></button>
                      )}
                      {isAdmin && (
                        <button className={`btn btn-sm btn-icon ${statusFilter === "active" ? "btn-ghost" : "btn-primary"}`} 
                          onClick={() => toggleArchive(m.memberId)} 
                          title={statusFilter === "active" ? "Archive (Left Guild)" : "Restore Member"}>
                          <Icon name={statusFilter === "active" ? "absence" : "plus"} size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon">⚔</div><div className="empty-state-text">No members found</div></div></td></tr>}
            </tbody>
          </table>
        </div>
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
          </div>
        </Modal>
      )}
    </div>
  );
}

export default MembersPage;
