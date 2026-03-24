import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';

function UserManagementPage() {
  const { currentUser, showToast } = useGuild();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: "", password: "", displayName: "", role: "officer" });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
    if (!form.email.trim() || !form.password.trim() || !form.displayName.trim()) {
      showToast("Fill all fields", "error"); return;
    }
    setCreating(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const newUser = { uid: cred.user.uid, email: form.email, displayName: form.displayName, role: form.role, createdAt: new Date().toISOString() };
      // Save role to Firestore
      await setDoc(doc(db, "userroles", cred.user.uid), { role: form.role, displayName: form.displayName, email: form.email });
      const newUsers = [...users, newUser];
      await saveUsers(newUsers);
      setForm({ email: "", password: "", displayName: "", role: "officer" });
      setShowForm(false);
      showToast(`Account created for ${form.displayName}`, "success");
      // Sign back in as admin (creating user signs in as new user)
      await signInWithEmailAndPassword(auth, currentUser.email, "");
    } catch (err) {
      showToast(err.message || "Error creating account", "error");
    } finally {
      setCreating(false);
    }
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
                  <option value="officer">🛡️ Officer</option>
                  <option value="admin">⭐ Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="officer@oblivion.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" placeholder="Set initial password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
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
              <th>Name</th><th>Email</th><th>Role</th><th>Created</th>
            </tr></thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={4}><div className="empty-state"><div className="empty-state-text">No accounts yet</div></div></td></tr>
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
                  <td><span className={`badge ${u.role === "admin" ? "badge-core" : "badge-support"}`}>{u.role === "admin" ? "⭐ Admin" : "🛡️ Officer"}</span></td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default UserManagementPage;
