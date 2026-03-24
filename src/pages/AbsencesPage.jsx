import React, { useState } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { writeAuditLog } from "./AuditLogPage";

function AbsencesPage() {
  const { members, absences, setAbsences, showToast, currentUser } = useGuild();
  const [form, setForm] = useState({
    memberId: members?.[0]?.memberId || "",
    eventType: "Guild League",
    eventDate: new Date().toISOString().split("T")[0],
    reason: "",
    onlineStatus: "No"
  });

  const submitAbsence = () => {
    if (!form.memberId || !form.reason.trim()) { showToast("Fill all fields", "error"); return; }
    const id = `ABS${Date.now()}`;
    setAbsences(prev => [...prev, { ...form, id }]);
    const member = members.find(m => m.memberId === form.memberId);
    showToast("Absence submitted successfully", "success");
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "absence_submit", `Submitted absence for ${member?.ign} — ${form.eventType} ${form.eventDate}: "${form.reason}"`);
    setForm(f => ({ ...f, reason: "" }));
  };

  const deleteAbsence = (id) => {
    const absence = absences.find(a => a.id === id);
    const member = members.find(m => m.memberId === absence?.memberId);
    setAbsences(prev => prev.filter(a => a.id !== id));
    showToast("Absence removed", "success");
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "absence_delete", `Removed absence for ${member?.ign} — ${absence?.eventType} ${absence?.eventDate}`);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🚨 Absence Submissions</h1>
        <p className="page-subtitle">Submit and manage member absences — auto-synced with attendance</p>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Submit Absence</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Member</label>
              <select className="form-select" value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))}>
                {members.map(m => <option key={m.memberId} value={m.memberId}>{m.ign} ({m.memberId})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Event Type</label>
              <select className="form-select" value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>
                <option>Guild League</option><option>Emperium Overrun</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Event Date</label>
              <input type="date" className="form-input" value={form.eventDate} onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Will be online?</label>
              <select className="form-select" value={form.onlineStatus} onChange={e => setForm(f => ({ ...f, onlineStatus: e.target.value }))}>
                <option value="Yes">Yes</option><option value="No">No</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label className="form-label">Reason</label>
              <input className="form-input" placeholder="Reason for absence…" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <div className="flex" style={{ justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-primary" onClick={submitAbsence}><Icon name="save" size={14} /> Submit Absence</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Recent Absences ({absences.length})</div>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {absences.slice().reverse().map((a, i) => {
              const member = members.find(m => m.memberId === a.memberId);
              return (
                <div key={a.id || i} style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{member?.ign || a.memberId}</span>
                      <span className="text-muted text-xs" style={{ marginLeft: 8 }}>{a.memberId}</span>
                    </div>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteAbsence(a.id || i)}><Icon name="trash" size={12} /></button>
                  </div>
                  <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                    <span className={`badge ${a.eventType === "Guild League" ? "badge-gl" : "badge-eo"}`} style={{ fontSize: 9 }}>{a.eventType === "Guild League" ? "GL" : "EO"}</span>
                    <span className="text-xs text-muted">{a.eventDate}</span>
                    <span className="text-xs" style={{ color: a.onlineStatus === "Yes" ? "var(--green)" : "var(--text-muted)" }}>Online: {a.onlineStatus}</span>
                  </div>
                  <div className="text-xs text-secondary mt-1" style={{ fontStyle: "italic" }}>"{a.reason}"</div>
                </div>
              );
            })}
            {absences.length === 0 && <div className="empty-state"><div className="empty-state-icon">✅</div><div className="empty-state-text">No absences on record</div></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AbsencesPage;
