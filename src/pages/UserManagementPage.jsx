import React, { useState, useEffect } from 'react';
import { useGuild } from '../context/GuildContext';
import { supabase } from '../supabase';
import Icon from '../components/ui/icons';
import ConfirmDangerModal from '../components/common/ConfirmDangerModal';

function UserManagementPage() {
  const { currentUser, showToast, members, isAdmin, isArchitect, resetDatabase } = useGuild();
  const RESET_TOKEN = "DELETE";
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: "", password: "", displayName: "", role: "member", memberId: "" });
  const [creating, setCreating] = useState(false);
  const [deletingUid, setDeletingUid] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUid, setEditingUid] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data, error } = await supabase.from('user_roles').select('*');
        if (error) throw error;
        setUsers(data || []);
      } catch (err) {
        console.error(err);
        showToast("Failed to load user list.", "error");
      }
    };
    loadUsers();
  }, [showToast]);

  const saveUserRole = async (u) => {
    try {
      const { error } = await supabase.from('user_roles').upsert({
        uid: u.uid,
        email: u.email,
        role: u.role,
        member_id: u.memberId,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      setUsers(prev => prev.map(item => item.uid === u.uid ? u : item));
    } catch (err) {
      showToast("Error saving role: " + err.message, "error");
    }
  };

  const createUser = async () => {
    if (!form.email.trim() || (!editingUid && !form.password.trim())) {
      showToast("Fill all fields", "error"); return;
    }
    
    setCreating(true);
    try {
      if (editingUid) {
        const updated = users.map(u => u.uid === editingUid ? { ...u, role: form.role, memberId: form.memberId } : u);
        const match = updated.find(u => u.uid === editingUid);
        await saveUserRole(match);
        showToast("User updated", "success");
      } else {
        // For new users, we advise using the Sign Up page for security
        showToast("Manual user creation is restricted. Please ask the member to Sign Up on the login page.", "info");
      }
      setEditingUid(null);
      setShowForm(false);
      setForm({ email: "", password: "", displayName: "", role: "member", memberId: "" });
    } catch {
      showToast("Operation failed", "error");
    } finally {
      setCreating(false);
    }
  };

  const deleteUser = async (uid) => {
    try {
      const { error } = await supabase.from('user_roles').delete().eq('uid', uid);
      if (error) throw error;
      
      setUsers(prev => prev.filter(u => u.uid !== uid));
      showToast("Account access revoked successfully", "success");
      setDeletingUid(null);
    } catch (err) {
      showToast("Error deleting account", "error");
      console.error(err);
    }
  };

  const openEdit = (u) => {
    setForm({ email: u.email, password: "", displayName: u.displayName, role: u.role, memberId: u.memberId || "" });
    setEditingUid(u.uid);
    setShowForm(true);
  };

  return (
    <div style={{ animation: "fade-in 0.5s ease-out" }}>
      <div className="page-header">
        <h1 className="page-title">👥 User Management</h1>
        <p className="page-subtitle">Manage officer accounts and system roles</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex items-center justify-between mb-3">
          <div className="card-title" style={{ marginBottom: 0 }}>Guild Accounts ({users.length})</div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
              <Icon name="plus" size={12} /> {editingUid ? "Edit Account" : "Assign Role"}
            </button>
          </div>
        </div>

        {showForm && (
          <div style={{ background: "rgba(99,130,230,0.05)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="member">👤 Member</option>
                  <option value="officer">🛡️ Officer</option>
                  <option value="admin">⭐ Admin</option>
                  <option value="architect">👁️‍🗨️ System Architect</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="user@oblivion.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editingUid} />
              </div>
              <div className="form-group">
                <label className="form-label">Linked Member Profile</label>
                <select className="form-select" value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))}>
                  <option value="">-- Not Linked --</option>
                  {members.filter(m => (m.status || "active") === "active").map(m => (
                    <option key={m.memberId} value={m.memberId}>{m.ign} ({m.memberId})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setEditingUid(null); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={createUser} disabled={creating}>
                {creating ? "Saving..." : <><Icon name="save" size={12} /> Save Permissions</>}
              </button>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Linked Member</th><th style={{ textAlign: "right" }}>Actions</th>
            </tr></thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-text">No accounts yet</div></div></td></tr>
              )}
              {users.map((u, i) => (
                <tr key={u.uid || i}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: u.role === "architect" ? "rgba(255,77,77,0.18)" : u.role === "admin" ? "rgba(240,192,64,0.18)" : "rgba(99,130,230,0.18)", color: u.role === "architect" ? "#ff4d4d" : u.role === "admin" ? "var(--gold)" : "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Cinzel,serif", fontSize: 12, fontWeight: 700, boxShadow: u.role === "architect" ? "0 0 10px rgba(255,77,77,0.3)" : "none" }}>
                        {(u.displayName || u.email || "??").slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700 }}>{u.displayName || u.email.split('@')[0]}</span>
                      {u.uid === currentUser?.id && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(you)</span>}
                    </div>
                  </td>
                  <td className="text-secondary">{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === "architect" ? "badge-dps" : u.role === "admin" ? "badge-core" : u.role === "officer" ? "badge-active" : "badge-casual"}`} style={u.role === "architect" ? { background: "rgba(255,77,77,0.15)", color: "#ff4d4d", border: "1px solid rgba(255,77,77,0.5)", boxShadow: "0 0 8px rgba(255,77,77,0.4)" } : {}}>
                      {u.role === "architect" ? "👁️‍🗨️ Architect" : u.role === "admin" ? "⭐ Admin" : u.role === "officer" ? "🛡️ Officer" : "👤 Member"}
                    </span>
                  </td>
                  <td>
                    {u.member_id ? (
                      <span className="text-secondary" style={{ fontSize: 13, fontWeight: 600 }}>
                        🔗 {members.find(m => m.memberId === u.member_id)?.ign || u.member_id}
                      </span>
                    ) : (
                      <span className="text-muted" style={{ fontSize: 11 }}>Not Linked</span>
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(u)} title="Edit Account">
                        <Icon name="edit" size={14} />
                      </button>
                      {u.uid !== currentUser?.id && isArchitect && (
                        <button className="btn btn-ghost btn-ghost-danger btn-sm btn-icon" onClick={() => setDeletingUid(u.uid)} title="Revoke Access">
                          <Icon name="trash" size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {deletingUid && (
        <div className="modal-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card animate-fade-in" style={{ maxWidth: 400, border: "1px solid rgba(239, 68, 68, 0.3)" }}>
            <div className="card-title" style={{ color: "var(--red)" }}>Revoke Account Access?</div>
            <p className="text-secondary" style={{ fontSize: 13, marginBottom: 20 }}>
              Are you sure you want to revoke access for <strong>{users.find(u => u.uid === deletingUid)?.displayName || users.find(u => u.uid === deletingUid)?.email}</strong>?<br/><br/>
              They will no longer be able to log in to the Guild Manager. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-ghost btn-sm" onClick={() => setDeletingUid(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => deleteUser(deletingUid)}>Revoke Access</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", background: "rgba(239, 68, 68, 0.02)" }}>
          <div className="card-title" style={{ color: "#ef4444" }}>⚠️ System Tools</div>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Danger Zone: Irreversible actions that affect the entire guild database.
          </p>
          
          {showResetConfirm ? (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 700, color: "#ef4444", marginBottom: 8, fontSize: 14 }}>ARE YOU ABSOLUTELY SURE?</div>
              <p style={{ fontSize: 12, marginBottom: 12 }}>This will permanently delete all records in Supabase. This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    resetDatabase();
                    setShowResetConfirm(false);
                  }}
                >
                  Yes, Delete Everything
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-danger btn-sm" onClick={() => setShowResetConfirm(true)}>
              <Icon name="trash" size={12} /> Reset Database
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default UserManagementPage;
