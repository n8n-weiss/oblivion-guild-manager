import React, { useState, useEffect } from 'react';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { useGuild } from '../context/GuildContext';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit, writeBatch } from 'firebase/firestore';
import { writeAuditLog } from '../utils/audit';


function AuditLogPage() {
  const { isArchitect, showToast } = useGuild();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("All");
  const [filterUser, setFilterUser] = useState("All");
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const q = query(collection(db, "auditlogs"), orderBy("timestamp", "desc"), limit(200));
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Load audit log error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, []);

  const clearLogs = async () => {
    if (!window.confirm("Are you sure you want to PERMANENTLY delete all audit logs? This cannot be undone.")) return;
    setIsClearing(true);
    try {
      const snap = await getDocs(collection(db, "auditlogs"));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setLogs([]);
      showToast("Audit logs cleared successfully", "success");
    } catch (err) {
      console.error("Clear logs error:", err);
      showToast("Failed to clear logs", "error");
    } finally {
      setIsClearing(false);
    }
  };

  const actionIcons = {
    "member_add": "➕",
    "member_edit": "✍️",
    "member_delete": "🗑️",
    "event_create": "📅",
    "event_delete": "🗑️",
    "attendance_toggle": "✅",
    "score_save": "⚔",
    "eo_rating": "⭐",
    "absence_submit": "⚠️",
    "absence_delete": "🗑️",
    "user_create": "👤",
    "user_edit": "🔧",
    "user_delete": "🚫",
  };

  const actionColors = {
    "member_add": "var(--green)",
    "member_edit": "var(--accent)",
    "member_delete": "var(--red)",
    "event_create": "var(--gold)",
    "event_delete": "var(--red)",
    "attendance_toggle": "var(--accent)",
    "score_save": "var(--gold)",
    "eo_rating": "var(--gold)",
    "absence_submit": "var(--accent2)",
    "absence_delete": "var(--red)",
    "user_create": "var(--green)",
    "user_edit": "var(--accent)",
    "user_delete": "var(--red)",
  };

  const allUsers = [...new Set(logs.map(l => l.userName))];
  const allActions = [...new Set(logs.map(l => l.action))];

  const filtered = logs.filter(l =>
    (filterAction === "All" || l.action === filterAction) &&
    (filterUser === "All" || l.userName === filterUser)
  );

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const actionLabel = (action) => action.replace(/_/g, " ").replace(/ \w/g, c => c.toUpperCase());

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Audit Log</h1>
          <p className="page-subtitle">Track all changes made by officers and admins</p>
        </div>
        {isArchitect && (
          <button className="btn btn-danger btn-sm" onClick={clearLogs} disabled={isClearing || logs.length === 0}>
            <Icon name="trash" size={12} /> {isClearing ? "Clearing..." : "Clear All Logs"}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex gap-3 items-center" style={{ flexWrap: "wrap" }}>
          <div className="form-group" style={{ marginBottom: 0, gap: 4 }}>
            <label className="form-label">Filter by Action</label>
            <select className="form-select" style={{ width: "auto" }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
              <option value="All">All Actions</option>
              {allActions.map(a => <option key={a} value={a}>{actionLabel(a)}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, gap: 4 }}>
            <label className="form-label">Filter by User</label>
            <select className="form-select" style={{ width: "auto" }} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="All">All Users</option>
              {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ paddingTop: 18 }} className="text-xs text-muted">{filtered.length} entries</div>
        </div>
      </div>

      {/* Log entries */}
      <div className="card">
        {loading && <div className="empty-state"><div className="empty-state-text">Loading logs...</div></div>}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">No audit logs yet — changes will appear here</div>
          </div>
        )}
        {!loading && filtered.map((log, i) => (
          <div key={log.id} style={{
            display: "flex", alignItems: "flex-start", gap: 14,
            padding: "14px 0",
            borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none"
          }}>
            {/* Icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: `${actionColors[log.action] || "var(--accent)"}18`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16
            }}>
              {actionIcons[log.action] || "📑"}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{log.userName}</span>
                <span className="badge badge-support" style={{ fontSize: 9 }}>{log.userEmail?.split("@")[0]}</span>
                <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 20, background: `${actionColors[log.action] || "var(--accent)"}18`, color: actionColors[log.action] || "var(--accent)", fontWeight: 700 }}>
                  {actionLabel(log.action)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{log.details}</div>
            </div>

            {/* Timestamp */}
            <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
              {formatTime(log.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AuditLogPage;
export { writeAuditLog };
