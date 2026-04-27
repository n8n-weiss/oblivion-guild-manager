import React, { useState, useEffect } from 'react';
import { useGuild } from '../context/GuildContext';
import { supabase } from '../supabase';
import Icon from '../components/ui/icons';
import ConfirmDangerModal from '../components/common/ConfirmDangerModal';

// ── Architect-Only: Supabase System Monitor ──────────────────────────────────
function SystemMonitor({ supabase }) {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [lastFetched, setLastFetched] = React.useState(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_db_stats');
      if (error) throw error;
      setStats(data);
      setLastFetched(new Date());
    } catch (err) {
      console.error("System Monitor fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open && !stats) fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchStats and stats intentionally excluded: open is the only meaningful trigger; stats guards against refetching
  }, [open]);

  const usedBytes = stats?.total_bytes || 0;
  const limitBytes = stats?.free_tier_limit_bytes || 524288000;
  const usedPct = Math.min(100, (usedBytes / limitBytes) * 100).toFixed(1);
  const barColor = usedPct > 80 ? "#ef4444" : usedPct > 60 ? "#f59e0b" : "#22c55e";

  return (
    <div className="card" style={{ marginBottom: 16, border: "1px solid rgba(99,130,230,0.25)", background: "rgba(99,130,230,0.03)" }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setOpen(v => !v)}
      >
        <div className="card-title" style={{ marginBottom: 0, color: "var(--accent)" }}>
          🖥️ System Monitor <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>(Architect Only)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {stats && (
            <span style={{ fontSize: 11, color: barColor, fontWeight: 700 }}>
              {usedPct}% used
            </span>
          )}
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{open ? "▲ Hide" : "▼ Show"}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          {/* Storage Bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: "var(--text-muted)" }}>Supabase Storage (Free Tier: 500MB)</span>
              <span style={{ fontWeight: 700, color: barColor }}>
                {stats ? `${stats.total_size_pretty} / 500 MB` : "—"}
              </span>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${usedPct}%`, borderRadius: 99,
                background: barColor,
                transition: "width 0.6s ease",
                boxShadow: `0 0 8px ${barColor}80`
              }} />
            </div>
          </div>

          {/* Table Breakdown */}
          {stats?.tables && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                Table Breakdown
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                {stats.tables.map(t => (
                  <div key={t.table_name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
                    <span style={{ fontSize: 13, fontFamily: "monospace", color: "var(--accent)" }}>{t.table_name}</span>
                    <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                      <span style={{ color: "var(--text-muted)" }}>{Number(t.row_count).toLocaleString()} rows</span>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 600, minWidth: 60, textAlign: "right" }}>{t.size_pretty}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {lastFetched ? `Last updated: ${lastFetched.toLocaleTimeString()}` : "Not yet fetched"}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={fetchStats} disabled={loading} style={{ fontSize: 11 }}>
              {loading ? "Fetching..." : "⟳ Refresh Stats"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────



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

  const sortUsers = (data) => {
    const roleOrder = { architect: 0, admin: 1, officer: 2, member: 3 };
    return [...data].sort((a, b) => {
      const orderA = roleOrder[a.role] ?? 99;
      const orderB = roleOrder[b.role] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.email || "").localeCompare(b.email || "");
    });
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");


  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.from('user_roles').select('*');
      if (error) throw error;
      console.log("DEBUG: Raw User Data from Supabase:");
      console.table(data); 
      setUsers(sortUsers(data || []));
    } catch (err) {
      console.error("DEBUG: Fetch Error:", err);
      showToast("Failed to load user list.", "error");
    }
  };



  useEffect(() => {
    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run once on mount; loadUsers is stable
  }, [showToast]);

  const getIGN = (u) => members.find(m => m.memberId === u.member_id)?.ign || null;

  const filteredUsers = users.filter(u => {
    const ign = getIGN(u) || "";
    const matchesSearch = 
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      ign.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.member_id || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });





  const saveUserRole = async (u) => {
    try {
      const { error } = await supabase.from('user_roles').upsert({
        uid: u.uid,
        email: u.email,
        role: u.role,
        member_id: u.member_id,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      
      // Sync Roster Rank
      if (u.member_id) {
        let rosterRank = "Member";
        if (u.role === "architect") rosterRank = "System Architect (Creator)";
        else if (u.role === "admin") rosterRank = "Guild Master";
        else if (u.role === "officer") rosterRank = "Officer";
        await supabase.from('roster').update({ guild_rank: rosterRank }).eq('member_id', u.member_id);
      }

      setUsers(prev => sortUsers(prev.map(item => item.uid === u.uid ? u : item)));

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
        // 1. Update Permissions (Role/Linked Member)
        const updated = users.map(u => u.uid === editingUid ? { ...u, role: form.role, member_id: form.memberId } : u);
        const match = updated.find(u => u.uid === editingUid);
        await saveUserRole(match);

        // 2. Update Password if provided (Using our new Secure Bridge)
        if (form.password.trim()) {
          const { error: rpcErr } = await supabase.rpc('admin_update_user_password', {
            target_user_id: editingUid,
            new_password: form.password.trim()
          });
          if (rpcErr) throw rpcErr;
          showToast("Permissions and Password updated!", "success");
        } else {
          showToast("Permissions updated", "success");
        }
      } else {

        // ── IMPORTANT: signUp() auto-logs in as the new user.
        // Save admin session first so we can restore it after.
        const { data: { session: adminSession } } = await supabase.auth.getSession();

        // 1. Create the Auth account (this switches session to new user)
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password.trim(),
          options: {
            data: {
              display_name: form.displayName || form.email.split('@')[0],
              member_id: form.memberId
            }
          }
        });

        if (authErr) throw authErr;
        const newUserId = authData.user.id;

        // 2. IMMEDIATELY restore admin session before any DB writes
        if (adminSession) {
          await supabase.auth.setSession({
            access_token: adminSession.access_token,
            refresh_token: adminSession.refresh_token
          });
        }

        // 3. Now insert role as admin (has permission)
        await supabase.from('user_roles').insert({
          uid: newUserId,
          email: form.email.trim(),
          role: form.role,
          member_id: form.memberId || null,
          updated_at: new Date().toISOString()
        });

        // 4. Sync Roster Rank
        if (form.memberId) {
          let rosterRank = "Member";
          if (form.role === "architect") rosterRank = "System Architect (Creator)";
          else if (form.role === "admin") rosterRank = "Guild Master";
          else if (form.role === "officer") rosterRank = "Officer";
          await supabase.from('roster').update({ guild_rank: rosterRank }).eq('member_id', form.memberId);
        }

        showToast("Staff account created! You are still logged in as yourself.", "success");
        loadUsers();
      }

      setEditingUid(null);
      setShowForm(false);
      setForm({ email: "", password: "", displayName: "", role: "member", memberId: "" });
    } catch (err) {
      console.error(err);
      showToast("Failed: " + (err.message || "Unknown error"), "error");
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
    setForm({ email: u.email, password: "", displayName: u.displayName, role: u.role, memberId: u.member_id || "" });
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
        {/* ── Header Row ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          
          {/* Left: Title + Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="card-title" style={{ marginBottom: 0, whiteSpace: "nowrap" }}>
              Guild Accounts ({users.length})
            </div>

            {/* Search Input with Icon */}
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: 9, pointerEvents: "none", display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
                <Icon name="search" size={13} />
              </span>
              <input
                className="form-input"
                placeholder="Search name, email, IGN..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 30, paddingRight: 10, height: 34, fontSize: 13, minWidth: 200 }}
              />
            </div>

            {/* Role Filter */}
            <select
              className="form-select"
              style={{ height: 34, fontSize: 13, minWidth: 130 }}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="architect">👁️‍🗨️ Architects</option>
              <option value="admin">⭐ Admins</option>
              <option value="officer">🛡️ Officers</option>
              <option value="member">👤 Members</option>
            </select>
          </div>

          {/* Right: Action Buttons */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-ghost btn-sm" onClick={loadUsers} title="Refresh list">
              <Icon name="refresh" size={12} /> Refresh
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => {
              if (showForm && editingUid) {
                setEditingUid(null);
                setForm({ email: "", password: "", displayName: "", role: "member", memberId: "" });
              } else {
                setShowForm(!showForm);
                setEditingUid(null);
                setForm({ email: "", password: "", displayName: "", role: "member", memberId: "" });
              }
            }}>
              <Icon name="plus" size={12} /> {editingUid ? "Switch to Add New" : (showForm ? "Hide Form" : "Assign Role")}
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
                <label className="form-label">
                  {editingUid ? "New Password (Leave blank to keep current)" : "Password"}
                </label>
                <input className="form-input" type="password" placeholder={editingUid ? "••••••••" : "Min. 6 chars"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
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
              <th>Name</th><th>Email</th><th>Role</th><th>Linked Member</th><th>UID Snippet</th><th style={{ textAlign: "right" }}>Actions</th>
            </tr></thead>

            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-text">No accounts yet</div></div></td></tr>
              )}
              {filteredUsers.map((u, i) => (

                <tr key={u.uid || i}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: u.role === "architect" ? "rgba(255,77,77,0.18)" : u.role === "admin" ? "rgba(240,192,64,0.18)" : "rgba(99,130,230,0.18)", color: u.role === "architect" ? "#ff4d4d" : u.role === "admin" ? "var(--gold)" : "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Cinzel,serif", fontSize: 12, fontWeight: 700, boxShadow: u.role === "architect" ? "0 0 10px rgba(255,77,77,0.3)" : "none" }}>
                        {(getIGN(u) || u.email || "??").slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700 }}>{getIGN(u) || u.email.split('@')[0]}</span>
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
                    <code style={{ fontSize: 10, opacity: 0.5 }}>{(u.uid || "").slice(0, 8)}...</code>
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

      {/* ── Architect-Only: System Monitor ── */}
      {isArchitect && <SystemMonitor supabase={supabase} />}

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
