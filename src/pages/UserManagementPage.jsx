import React, { useState, useEffect } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { db, auth, firebaseConfig } from '../firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { useGuild } from '../context/GuildContext';
import { writeAuditLog } from '../utils/audit';
import Icon from '../components/ui/icons';

function UserManagementPage() {
  const { currentUser, showToast, members, isAdmin, isArchitect, resetDatabase } = useGuild();
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
        const snap = await getDoc(doc(db, "guildusers", "list"));
        if (snap.exists()) setUsers(snap.data().users || []);
      } catch (err) { console.error(err); }
    };
    loadUsers();
  }, []);

  const syncSelfRegisteredUsers = async () => {
    try {
      showToast("Syncing users from database...", "info");
      const snap = await getDoc(doc(db, "guildusers", "list"));
      let currentUsers = snap.exists() ? (snap.data().users || []) : [];
      
      const { getDocs, collection } = await import('firebase/firestore');
      const urSnap = await getDocs(collection(db, "userroles"));
      
      let added = 0;
      urSnap.forEach(rDoc => {
        const uid = rDoc.id;
        const data = rDoc.data();
        if (!currentUsers.find(u => u.uid === uid)) {
          currentUsers.push({
            uid,
            role: data.role || "member",
            email: data.email || `${uid}@oblivion.com`,
            displayName: data.displayName || "Unknown Member",
            createdAt: data.createdAt || new Date().toISOString(),
            memberId: data.memberId || ""
          });
          added++;
        }
      });
      
      if (added > 0) {
        await saveUsers(currentUsers);
        showToast(`Synced ${added} self-registered accounts!`, "success");
      } else {
        showToast("No new accounts to sync.", "success");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to sync users - check console", "error");
    }
  };

  const saveUsers = async (newUsers) => {
    await setDoc(doc(db, "guildusers", "list"), { users: newUsers });
    setUsers(newUsers);
  };

  const createUser = async () => {
    if (!form.email.trim() || (!editingUid && !form.password.trim()) || !form.displayName.trim()) {
      showToast("Fill all fields", "error"); return;
    }
    // VALIDATE PASSWORD LENGTH
    if (!editingUid && form.password.trim().length < 6) {
      showToast("Password must be at least 6 characters", "error"); return;
    }
    
    setCreating(true);
    let secondaryApp;
    try {
      let uid = editingUid;
      if (!editingUid) {
        // Use a secondary app instance to create the user without signing out the main admin session
        const appName = `secondary-${Date.now()}`;
        secondaryApp = initializeApp(firebaseConfig, appName);
        const secondaryAuth = getAuth(secondaryApp);
        const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email.trim(), form.password.trim());
        uid = cred.user.uid;
      }
      
      const userDoc = { role: form.role, displayName: form.displayName, email: form.email.trim(), memberId: form.memberId || null };
      await setDoc(doc(db, "userroles", uid), userDoc);
      
      const newUser = { uid, ...userDoc, createdAt: new Date().toISOString() };
      const newUsers = editingUid ? users.map(u => u.uid === uid ? { ...u, ...userDoc } : u) : [...users, newUser];
      
      await saveUsers(newUsers);
      
      // Log the action
      await writeAuditLog(
        currentUser.email, 
        currentUser.displayName || currentUser.email, 
        editingUid ? "user_edit" : "user_create", 
        `${editingUid ? "Updated" : "Created"} account for ${form.displayName} (${form.role})`
      );
      
      setForm({ email: "", password: "", displayName: "", role: "member", memberId: "" });
      setShowForm(false);
      setEditingUid(null);
      showToast(editingUid ? "User updated" : `Account created for ${form.displayName}`, "success");
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        showToast("Email already exists! Try syncing existing accounts.", "error");
      } else if (err.code === 'auth/invalid-email') {
        showToast("Invalid email format.", "error");
      } else {
        showToast(err.message || "Error saving account", "error");
      }
    } finally {
      setCreating(false);
      if (secondaryApp) await deleteApp(secondaryApp);
    }
  };

  const deleteUser = async (uid) => {
    try {
      // 1. Remove from userroles
      await deleteDoc(doc(db, "userroles", uid));
      
      // 2. Remove from the registry list
      const userToDelete = users.find(u => u.uid === uid);
      const newUsers = users.filter(u => u.uid !== uid);
      await saveUsers(newUsers);
      
      // Log the action
      await writeAuditLog(
        currentUser.email, 
        currentUser.displayName || currentUser.email, 
        "user_delete", 
        `Revoked access for ${userToDelete?.displayName || uid}`
      );
      
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
    <div>
      <div className="page-header">
        <h1 className="page-title">👥 User Management</h1>
        <p className="page-subtitle">Manage officer accounts — System Architect only</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex items-center justify-between mb-3">
          <div className="card-title" style={{ marginBottom: 0 }}>Guild Accounts ({users.length})</div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={syncSelfRegisteredUsers}><Icon name="refresh" size={12} /> Sync Setup Accounts</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}><Icon name="plus" size={12} /> Create Account</button>
          </div>
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
                  <option value="architect">👁️‍🗨️ System Architect</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="user@oblivion.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editingUid} />
              </div>
              {!editingUid && (
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" placeholder="Min 6 chars" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
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
                {creating ? "Saving..." : <><Icon name="save" size={12} /> Save Account</>}
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
                        {u.displayName?.slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700 }}>{u.displayName}</span>
                      {u.uid === currentUser?.uid && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(you)</span>}
                    </div>
                  </td>
                  <td className="text-secondary">{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === "architect" ? "badge-dps" : u.role === "admin" ? "badge-core" : u.role === "officer" ? "badge-active" : "badge-casual"}`} style={u.role === "architect" ? { background: "rgba(255,77,77,0.15)", color: "#ff4d4d", border: "1px solid rgba(255,77,77,0.5)", boxShadow: "0 0 8px rgba(255,77,77,0.4)" } : {}}>
                      {u.role === "architect" ? "👁️‍🗨️ Architect" : u.role === "admin" ? "⭐ Admin" : u.role === "officer" ? "🛡️ Officer" : "👤 Member"}
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
                    <div className="flex justify-end gap-1">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(u)} title="Edit Account">
                        <Icon name="edit" size={14} />
                      </button>
                      {u.uid !== currentUser?.uid && isArchitect && (
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
              Are you sure you want to revoke access for <strong>{users.find(u => u.uid === deletingUid)?.displayName}</strong>?<br/><br/>
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
