import React, { useMemo, useState } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';

function MemberProfilePage({ member, onBack, isOwnProfile }) {
  const { members, events, attendance, performance, absences, eoRatings, isMember, myMemberId, setAbsences, showToast, currentUser } = useGuild();
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({
    eventType: "Guild League",
    eventDate: new Date().toISOString().split("T")[0],
    reason: "",
    onlineStatus: "No"
  });

  if (!member) return null;

  // Security: Members can only see their own profile
  if (isMember && member.memberId !== myMemberId) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
        <h2 className="page-title">Access Denied</h2>
        <p className="text-muted">You are only permitted to view your own performance profile.</p>
        <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Return to My Profile</button>
      </div>
    );
  }

  const memberIdx = members.findIndex(m => m.memberId === member.memberId);
  const memberEvents = events.map(ev => {
    const att = attendance.find(a => a.memberId === member.memberId && a.eventId === ev.eventId);
    const perf = performance.find(p => p.memberId === member.memberId && p.eventId === ev.eventId);
    const eoRating = eoRatings.find(r => r.memberId === member.memberId && r.eventId === ev.eventId);
    const score = ev.eventType === "Guild League" && att?.status === "present"
      ? (perf?.ctfPoints || 0) + (perf?.performancePoints || 0) : 0;
    return { ...ev, att, perf, eoRating, score };
  }).sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));

  const glEvents = memberEvents.filter(e => e.eventType === "Guild League");
  const eoEvents = memberEvents.filter(e => e.eventType === "Emperium Overrun");
  const totalGLScore = glEvents.reduce((sum, e) => sum + e.score, 0);
  const presentCount = memberEvents.filter(e => e.att?.status === "present").length;
  const attPct = memberEvents.length > 0 ? Math.round((presentCount / memberEvents.length) * 100) : 0;
  const avgGL = glEvents.filter(e => e.att?.status === "present").length > 0
    ? Math.round((totalGLScore / glEvents.filter(e => e.att?.status === "present").length) * 10) / 10 : 0;
  const eoRatingsList = eoRatings.filter(r => r.memberId === member.memberId);
  const avgEoRating = eoRatingsList.length > 0
    ? Math.round((eoRatingsList.reduce((s, r) => s + r.rating, 0) / eoRatingsList.length) * 10) / 10 : 0;
  const memberAbsences = absences.filter(a => a.memberId === member.memberId);

  const attStatus = attPct >= 80 ? { label: "Reliable", badge: "badge-active" }
    : attPct >= 60 ? { label: "Average", badge: "badge-casual" }
      : { label: "At Risk", badge: "badge-atrisk" };

  let scoreClass = "At Risk";
  if (totalGLScore > 80) scoreClass = "Core";
  else if (totalGLScore >= 60) scoreClass = "Active";
  else if (totalGLScore >= 40) scoreClass = "Casual";
  const scoreClassBadge = { Core: "badge-core", Active: "badge-active", Casual: "badge-casual", "At Risk": "badge-atrisk" };

  const chartData = useMemo(() => {
    return [...memberEvents].reverse().map(ev => ({
      date: ev.eventDate.split('-').slice(1).join('/'), // Concise date
      fullDate: ev.eventDate,
      score: ev.eventType === "Guild League" ? ev.score : null,
      rating: ev.eventType === "Emperium Overrun" ? ev.eoRating?.rating : null,
      present: ev.att?.status === "present",
      type: ev.eventType
    }));
  }, [memberEvents]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="card shadow-xl" style={{ border: "1px solid var(--border)", padding: "10px", background: "rgba(10, 15, 25, 0.95)", backdropFilter: "blur(8px)" }}>
          <p className="text-xs text-muted mb-1">{data.fullDate}</p>
          <p className="font-cinzel text-sm mb-1" style={{ color: data.type === "Guild League" ? "var(--accent)" : "var(--gold)" }}>
            {data.type}
          </p>
          {data.score !== null && (
            <p className="text-sm font-bold" style={{ color: "var(--green)" }}>
              Score: {data.score}
            </p>
          )}
          {data.rating !== null && (
            <p className="text-sm font-bold" style={{ color: "var(--gold)" }}>
              Rating: ★{data.rating}
            </p>
          )}
          <p className="text-xs mt-1" style={{ color: data.present ? "var(--green)" : "var(--red)" }}>
            {data.present ? "✅ Present" : "❌ Absent"}
          </p>
        </div>
      );
    }
    return null;
  };

  const submitAbsence = () => {
    if (!absenceForm.reason.trim()) { showToast("Please provide a reason", "error"); return; }
    const id = `ABS${Date.now()}`;
    const newAbsence = { ...absenceForm, memberId: member.memberId, id };
    setAbsences(prev => [...prev, newAbsence]);
    showToast("Absence filed successfully!", "success");
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "absence_submit", `Member filed own absence: ${member.ign} — ${absenceForm.eventType} ${absenceForm.eventDate}`);
    setShowAbsenceForm(false);
    setAbsenceForm(f => ({ ...f, reason: "" }));
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          {onBack && !isOwnProfile && (
            <button className="btn btn-ghost" onClick={onBack}><Icon name="x" size={14} /> Back</button>
          )}
          <div>
            <h1 className="page-title">👤 {isOwnProfile ? "My Profile" : "Member Profile"}</h1>
            <p className="page-subtitle">{isOwnProfile ? "Your full history and stats" : `Full history and stats for ${member.ign}`}</p>
          </div>
        </div>
        {isOwnProfile && (
          <button className="btn btn-primary" onClick={() => setShowAbsenceForm(true)}>
            <Icon name="absence" size={14} /> File Absence
          </button>
        )}
      </div>

      {/* Absence Filing Form Modal-like */}
      {showAbsenceForm && (
        <div className="card shadow-2xl" style={{ border: "2px solid var(--accent)", background: "rgba(99,130,230,0.05)", marginBottom: 20 }}>
          <div className="card-title">🚨 File Absence</div>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>Please let the officers know why you'll be absent.</p>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Event Type</label>
              <select className="form-select" value={absenceForm.eventType}
                onChange={e => setAbsenceForm(f => ({ ...f, eventType: e.target.value }))}>
                <option>Guild League</option>
                <option>Emperium Overrun</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Event Date <span style={{ fontSize: 10, opacity: 0.6 }}>(DD-MM-YYYY)</span></label>
              <input type="date" className="form-input" value={absenceForm.eventDate}
                onChange={e => setAbsenceForm(f => ({ ...f, eventDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Will you be online?</label>
              <select className="form-select" value={absenceForm.onlineStatus}
                onChange={e => setAbsenceForm(f => ({ ...f, onlineStatus: e.target.value }))}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label className="form-label">Reason</label>
              <textarea className="form-input" rows={2} placeholder="Reason for absence..."
                value={absenceForm.reason} onChange={e => setAbsenceForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <button className="btn btn-ghost" onClick={() => setShowAbsenceForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitAbsence}>Submit Absence</button>
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex items-center gap-4" style={{ flexWrap: "wrap" }}>
          <MemberAvatar ign={member.ign} index={memberIdx} size={72} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "Cinzel,serif", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{member.ign}</div>
            <div className="flex gap-2" style={{ flexWrap: "wrap", marginBottom: 6 }}>
              <span className="text-secondary" style={{ fontSize: 14 }}>{member.class}</span>
              <span className={`badge ${member.role === "DPS" ? "badge-dps" : "badge-support"}`}>
                {member.role === "DPS" ? <Icon name="sword" size={10} /> : <Icon name="shield" size={10} />} {member.role}
              </span>
              <span className={`badge ${attStatus.badge}`}>🎯 {attStatus.label}</span>
              <span className={`badge ${scoreClassBadge[scoreClass]}`}>⚔ {scoreClass}</span>
            </div>
            <div className="text-xs text-muted">{member.memberId}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ "--stat-accent": "var(--gold)" }}>
          <div className="stat-icon">⚔</div>
          <div className="stat-label">GL Score</div>
          <div className="stat-value" style={{ color: "var(--gold)" }}>{totalGLScore}</div>
          <div className="stat-change">all time total</div>
        </div>
        <div className="stat-card" style={{ "--stat-accent": attPct >= 75 ? "var(--green)" : attPct >= 50 ? "var(--gold)" : "var(--red)" }}>
          <div className="stat-icon">📋</div>
          <div className="stat-label">Attendance</div>
          <div className="stat-value" style={{ color: attPct >= 75 ? "var(--green)" : attPct >= 50 ? "var(--gold)" : "var(--red)" }}>{attPct}%</div>
          <div className="stat-change">{presentCount}/{memberEvents.length} events</div>
        </div>
        <div className="stat-card" style={{ "--stat-accent": "var(--accent)" }}>
          <div className="stat-icon">📊</div>
          <div className="stat-label">Avg / GL</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{avgGL}</div>
          <div className="stat-change">per event attended</div>
        </div>
        <div className="stat-card" style={{ "--stat-accent": "var(--gold)" }}>
          <div className="stat-icon">⭐</div>
          <div className="stat-label">EO Rating</div>
          <div className="stat-value" style={{ color: "var(--gold)" }}>{avgEoRating > 0 ? `★${avgEoRating}` : "—"}</div>
          <div className="stat-change">avg stars · {eoRatingsList.length} rated</div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-title">📈 Performance History</div>
        <div style={{ height: 250, width: "100%", marginTop: 20 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="score" name="GL Score" barSize={20} radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.present ? "var(--accent)" : "rgba(224,80,80,0.3)"} />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="rating"
                name="EO Rating"
                stroke="var(--gold)"
                strokeWidth={3}
                dot={{ r: 4, fill: "var(--gold)", strokeWidth: 2, stroke: "#111" }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-2 justify-center">
          <div className="flex items-center gap-1 text-xs text-muted">
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)" }} />
            Present (GL)
          </div>
          <div className="flex items-center gap-1 text-xs text-muted">
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(224,80,80,0.3)" }} />
            Absent
          </div>
          <div className="flex items-center gap-1 text-xs text-muted">
            <div style={{ width: 10, height: 2, background: "var(--gold)" }} />
            EO Stars
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Event History */}
        <div className="card" style={{ gridColumn: "1/-1" }}>
          <div className="card-title">📅 Event History</div>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Date</th><th>Type</th><th>Status</th><th>CTF Breakdown</th><th>Perf Pts</th><th>Score / Rating</th>
              </tr></thead>
              <tbody>
                {memberEvents.length === 0 && (
                  <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-text">No events yet</div></div></td></tr>
                )}
                {memberEvents.map(ev => (
                  <tr key={ev.eventId}>
                    <td><span style={{ fontFamily: "Cinzel,serif", fontSize: 13 }}>{ev.eventDate}</span></td>
                    <td>
                      <span className={`badge ${ev.eventType === "Guild League" ? "badge-gl" : "badge-eo"}`} style={{ fontSize: 10 }}>
                        {ev.eventType === "Guild League" ? "GL" : "EO"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 13, color: ev.att?.status === "present" ? "var(--green)" : "var(--red)" }}>
                        {ev.att?.status === "present" ? "✅ Present" : "❌ Absent"}
                      </span>
                    </td>
                    <td className="text-secondary">
                      {ev.eventType === "Guild League" && ev.att?.status === "present" ? (
                        <div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ev.perf?.ctf1 ?? ev.perf?.ctfPoints ?? 0} + {ev.perf?.ctf2 ?? 0} + {ev.perf?.ctf3 ?? 0}</div>
                          <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: 13 }}>= {(ev.perf?.ctf1 ?? ev.perf?.ctfPoints ?? 0) + (ev.perf?.ctf2 ?? 0) + (ev.perf?.ctf3 ?? 0)}</div>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="text-secondary">
                      {ev.eventType === "Guild League" && ev.att?.status === "present" ? (ev.perf?.performancePoints ?? "—") : "—"}
                    </td>
                    <td>
                      {ev.eventType === "Guild League" && ev.att?.status === "present" ? (
                        <span style={{ fontFamily: "Cinzel,serif", fontWeight: 700, color: "var(--green)", fontSize: 14 }}>{ev.score}</span>
                      ) : ev.eventType === "Emperium Overrun" && ev.att?.status === "present" ? (
                        <span style={{ color: "var(--gold)" }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <span key={s} style={{ fontSize: 14, color: s <= (ev.eoRating?.rating || 0) ? "var(--gold)" : "rgba(99,130,230,0.2)" }}>★</span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Absence Records */}
      <div className="card">
        <div className="card-title">⚠️ Absence Records ({memberAbsences.length})</div>
        {memberAbsences.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-text">No absences on record</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {memberAbsences.slice().reverse().map((a, i) => (
              <div key={a.id || i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                background: "rgba(224,80,80,0.05)", borderRadius: 10,
                border: "1px solid rgba(224,80,80,0.2)"
              }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--red)", marginBottom: 2 }}>
                    {a.eventDate} · {a.eventType}
                  </div>
                  <div className="text-xs text-secondary" style={{ fontStyle: "italic" }}>"{a.reason}"</div>
                </div>
                <span style={{ fontSize: 12, color: a.onlineStatus === "Yes" ? "var(--green)" : "var(--text-muted)" }}>
                  Online: {a.onlineStatus}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberProfilePage;
