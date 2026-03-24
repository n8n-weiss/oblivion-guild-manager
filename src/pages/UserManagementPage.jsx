import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';

function UserManagementPage() {
  const { currentUser, showToast, members, isAdmin, resetDatabase } = useGuild();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: "", password: "", displayName: "", role: "member", memberId: "" });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUid, setEditingUid] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const snap = await getDoc(doc(db, "guildusers", "list"));
        if (snap.exists()) setUsers(snap.data().users || []);
      } catch (err) { console.error(err); }
    };
    loadUsers();
  }, []);

  const saveUsers = async (newUsers) => {
    await setDoc(doc(db, "guildusers", "list"), { users: newUsers });
    setUsers(newUsers);
  };

  const createUser = async () => {
    if (!form.email.trim() || (!editingUid && !form.password.trim()) || !form.displayName.trim()) {
      showToast("Fill all fields", "error"); return;
    }
    setCreating(true);
    try {
      let uid = editingUid;
      if (!editingUid) {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        uid = cred.user.uid;
      }
      
      const userDoc = { role: form.role, displayName: form.displayName, email: form.email, memberId: form.memberId || null };
      await setDoc(doc(db, "userroles", uid), userDoc);
      
      const newUser = { uid, ...userDoc, createdAt: new Date().toISOString() };
      const newUsers = editingUid ? users.map(u => u.uid === uid ? { ...u, ...userDoc } : u) : [...users, newUser];
      
      await saveUsers(newUsers);
      setForm({ email: "", password: "", displayName: "", role: "member", memberId: "" });
      setShowForm(false);
      setEditingUid(null);
      showToast(editingUid ? "User updated" : `Account created for ${form.displayName}`, "success");
      
      if (!editingUid) {
        // Sign back in as admin (creating user signs in as new user)
        await signInWithEmailAndPassword(auth, currentUser.email, "");
      }
    } catch (err) {
      showToast(err.message || "Error saving account", "error");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u) => {
    setForm({ email: u.email, password: "", displayName: u.displayName, role: u.role, memberId: u.memberId || "" });
    setEditingUid(u.uid);
    setShowForm(true);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">👥 User Management</h1>
        <p className="page-subtitle">Manage officer accounts — Admin only</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex items-center justify-between mb-3">
          <div className="card-title" style={{ marginBottom: 0 }}>Guild Accounts ({users.length})</div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}><Icon name="plus" size={12} /> Create Account</button>
        </div>

        {showForm && (
          <div style={{ background: "rgba(99,130,230,0.05)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input className="form-input" placeholder="Officer name" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="member">👤 Member</option>
                  <option value="officer">🛡️ Officer</option>
                  <option value="admin">⭐ Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="user@oblivion.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editingUid} />
              </div>
              {!editingUid && (
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" placeholder="Set initial password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              )}
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
            <div style={{ background: "rgba(240,192,64,0.06)", border: "1px solid rgba(240,192,64,0.2)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              ⚠️ After creating, share the email and password with the officer. They can change their password later.
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={createUser} disabled={creating}>
                {creating ? "Creating..." : <><Icon name="plus" size={12} /> Create Account</>}
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
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: u.role === "admin" ? "rgba(240,192,64,0.18)" : "rgba(99,130,230,0.18)", color: u.role === "admin" ? "var(--gold)" : "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Cinzel,serif", fontSize: 12, fontWeight: 700 }}>
                        {u.displayName?.slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700 }}>{u.displayName}</span>
                      {u.uid === currentUser?.uid && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(you)</span>}
                    </div>
                  </td>
                  <td className="text-secondary">{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === "admin" ? "badge-core" : u.role === "officer" ? "badge-active" : "badge-casual"}`}>
                      {u.role === "admin" ? "⭐ Admin" : u.role === "officer" ? "🛡️ Officer" : "👤 Member"}
                    </span>
                  </td>
                  <td>
                    {u.memberId ? (
                      <span className="text-secondary" style={{ fontSize: 13, fontWeight: 600 }}>
                        🔗 {members.find(m => m.memberId === u.memberId)?.ign || u.memberId}
                      </span>
                    ) : (
                      <span className="text-muted" style={{ fontSize: 11 }}>Not Linked</span>
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(u)} title="Edit Account">
                        <Icon name="edit" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", background: "rgba(239, 68, 68, 0.02)" }}>
          <div className="card-title" style={{ color: "#ef4444" }}>⚠️ System Tools</div>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Use these tools only if you need to wipe all guild data (roster, events, attendance) to start fresh.
          </p>
          
          {showResetConfirm ? (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 700, color: "#ef4444", marginBottom: 8, fontSize: 14 }}>ARE YOU ABSOLUTELY SURE?</div>
              <p style={{ fontSize: 12, marginBottom: 12 }}>This will permanently delete all members, events, attendance, and analytics records. This cannot be undone.</p>
              <div className="flex gap-2">
                <button className="btn btn-danger btn-sm" onClick={() => { resetDatabase(); setShowResetConfirm(false); }}>Yes, Delete Everything</button>
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
