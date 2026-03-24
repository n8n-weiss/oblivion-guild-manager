import React, { useState, useMemo } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { computeLeaderboard } from '../utils/scoring';

function LeaderboardPage({ onViewProfile }) {
  const { members, events, attendance, performance, eoRatings } = useGuild();
  const [filter, setFilter] = useState("All");
  const [lbMode, setLbMode] = useState("gl"); // "gl" | "eo"
  const lb = useMemo(() => computeLeaderboard(members, events, attendance, performance), [members, events, attendance, performance]);
  const filtered = filter === "All" ? lb : lb.filter(m => m.classification === filter);
  const maxScore = Math.max(...lb.map(m => m.totalScore), 1);

  // EO leaderboard
  const eoEvents = events.filter(e => e.eventType === "Emperium Overrun");
  const eoLb = useMemo(() => members.map(member => {
    const memberRatings = eoRatings.filter(r => r.memberId === member.memberId);
    const totalEoScore = memberRatings.reduce((sum, r) => sum + (r.rating || 0), 0);
    const eoPresent = eoEvents.filter(ev => attendance.find(a => a.memberId === member.memberId && a.eventId === ev.eventId && a.status === "present")).length;
    const avgRating = memberRatings.length > 0 ? Math.round((totalEoScore / memberRatings.length) * 10) / 10 : 0;
    return { ...member, totalEoScore, eoPresent, eoTotal: eoEvents.length, avgRating };
  }).sort((a, b) => b.totalEoScore - a.totalEoScore).map((m, i) => ({ ...m, eoRank: i + 1 }))
    , [members, eoRatings, eoEvents, attendance]);
  const maxEoScore = Math.max(...eoLb.map(m => m.totalEoScore), 1);

  const rankColors = ["var(--gold)", "#c0c0c0", "#cd7f32"];
  const classColors = { Core: "badge-core", Active: "badge-active", Casual: "badge-casual", "At Risk": "badge-atrisk" };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">🏆 Leaderboard</h1>
            <p className="page-subtitle">Rankings based on scoring formula — auto-computed</p>
          </div>
          <div className="flex gap-2">
            <button className={`btn ${lbMode === "gl" ? "btn-primary" : "btn-ghost"}`} onClick={() => setLbMode("gl")}>⚔ Guild League</button>
            <button className={`btn ${lbMode === "eo" ? "btn-primary" : "btn-ghost"}`} onClick={() => setLbMode("eo")}>🐰 Emperium Overrun</button>
          </div>
        </div>
      </div>

      {/* Top 3 podium - GL only */}
      {lbMode === "gl" && <div className="flex gap-4 mb-4 items-end" style={{ maxWidth: 700, marginBottom: 24 }}>
        {[lb[1], lb[0], lb[2]].map((m, i) => {
          if (!m) return <div key={i} style={{ flex: 1 }} />;
          const podiumH = [120, 160, 95];
          const medals = ["🥈", "🥇", "🥉"];
          const labels = ["#2", "#1", "#3"];
          return (
            <div key={m.memberId} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 28 }}>{medals[i]}</div>
              <MemberAvatar ign={m.ign} index={m.rank - 1} size={46} />
              <div style={{ fontWeight: 700, fontSize: 15, textAlign: "center", color: "var(--text-primary)" }}>{m.ign}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>{m.class}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontFamily: "Cinzel,serif", fontSize: 22, fontWeight: 700, color: rankColors[m.rank - 1], textShadow: `0 0 12px ${rankColors[m.rank - 1]}66` }}>{m.totalScore}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.attendancePct}% att</div>
              </div>
              <div style={{
                width: "100%", height: podiumH[i],
                background: `${rankColors[m.rank - 1]}22`,
                borderRadius: "10px 10px 0 0",
                border: `2px solid ${rankColors[m.rank - 1]}`,
                borderBottom: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `inset 0 0 30px ${rankColors[m.rank - 1]}22, 0 0 20px ${rankColors[m.rank - 1]}33`,
                position: "relative",
                overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  height: "60%",
                  background: `linear-gradient(to top, ${rankColors[m.rank - 1]}44, transparent)`,
                }} />
                <span style={{
                  fontFamily: "Cinzel,serif",
                  fontSize: 48, fontWeight: 900,
                  color: rankColors[m.rank - 1],
                  opacity: 0.6,
                  zIndex: 1,
                  textShadow: `0 0 20px ${rankColors[m.rank - 1]}`,
                }}>{labels[i]}</span>
              </div>
            </div>
          );
        })}
      </div>}

      {lbMode === "gl" && <div className="card">
        <div className="section-header">
          <div className="font-cinzel text-xs text-muted" style={{ letterSpacing: 2, textTransform: "uppercase" }}>Full Rankings</div>
          <div className="flex gap-2">
            {["All", "Core", "Active", "Casual", "At Risk"].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>#</th><th>Player</th><th>Role</th><th>Total Score</th><th>Score Bar</th><th>Attendance</th><th>Avg/Event</th><th>Status</th>
            </tr></thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.memberId}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 40 }}>
                      {m.rank <= 3 && <span style={{ fontSize: 18 }}>{["🥇", "🥈", "🥉"][m.rank - 1]}</span>}
                      <span className="font-cinzel" style={{ fontSize: 13, fontWeight: 700, color: rankColors[m.rank - 1] || "var(--text-muted)" }}>
                        #{m.rank}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <MemberAvatar ign={m.ign} index={m.rank - 1} size={34} />
                      <div>
                        <div style={{ fontWeight: 700, cursor: "pointer", color: "var(--accent)" }}
                          onClick={() => onViewProfile && onViewProfile(m)}>{m.ign}</div>
                        <div className="text-xs text-muted">{m.class}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 10 }}>{m.role}</span></td>
                  <td><span className="font-cinzel" style={{ fontSize: 15, fontWeight: 700, color: m.totalScore > 80 ? "var(--gold)" : m.totalScore > 60 ? "var(--green)" : "var(--text-primary)" }}>{m.totalScore}</span></td>
                  <td style={{ minWidth: 140 }}>
                    <div className="score-bar-wrap">
                      <div className="score-bar-bg">
                        <div className="score-bar-fill" style={{ width: `${Math.max(2, (m.totalScore / maxScore) * 100)}%`, background: m.totalScore > 80 ? "var(--gold)" : m.totalScore > 60 ? "var(--green)" : "var(--accent)" }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: m.attendancePct >= 75 ? "var(--green)" : m.attendancePct >= 50 ? "var(--gold)" : "var(--red)", fontWeight: 700 }}>{m.attendancePct}%</span>
                  </td>
                  <td>
                    <span style={{ color: m.absentCount > 3 ? "var(--red)" : m.absentCount > 1 ? "var(--gold)" : "var(--green)", fontWeight: 700 }}>{m.absentCount}</span>
                    {m.consecutiveAbsent >= 2 && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--red)" }}>({m.consecutiveAbsent} streak)</span>}
                  </td>
                  <td className="text-secondary">{m.avgScore}</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span className={`badge ${m.attStatus?.badge || "badge-casual"}`} style={{ fontSize: 10 }}>
                        🎯 {m.attStatus?.label || "Average"}
                      </span>
                      <span className={`badge ${m.classification === "Core" ? "badge-core" :
                          m.classification === "Active" ? "badge-active" :
                            m.classification === "Casual" ? "badge-casual" : "badge-atrisk"
                        }`} style={{ fontSize: 10 }}>
                        ⚔ {m.classification}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}

      {/* EO Leaderboard */}
      {lbMode === "eo" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
            <div className="font-cinzel text-xs text-muted" style={{ letterSpacing: 2, textTransform: "uppercase" }}>🐰 Emperium Overrun Rankings</div>
            <div className="text-xs text-muted">{eoEvents.length} EO events · Star ratings by officers</div>
          </div>
          {eoLb.every(m => m.totalEoScore === 0) ? (
            <div className="empty-state">
              <div className="empty-state-icon">★</div>
              <div className="empty-state-text">No EO ratings yet — go to Events tab and rate members on EO events</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>#</th><th>Player</th><th>Role</th><th>Total EO Score</th><th>Score Bar</th><th>EO Attended</th><th>Avg Rating</th>
                </tr></thead>
                <tbody>
                  {eoLb.map((m) => (
                    <tr key={m.memberId}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 40 }}>
                          {m.eoRank <= 3 && <span style={{ fontSize: 18 }}>{["🥇", "🥈", "🥉"][m.eoRank - 1]}</span>}
                          <span className="font-cinzel" style={{ fontSize: 13, fontWeight: 700, color: m.eoRank <= 3 ? ["var(--gold)", "#c0c0c0", "#cd7f32"][m.eoRank - 1] : "var(--text-muted)" }}>#{m.eoRank}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <MemberAvatar ign={m.ign} index={m.eoRank - 1} size={34} />
                          <div>
                            <div style={{ fontWeight: 700 }}>{m.ign}</div>
                            <div className="text-xs text-muted">{m.class}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 10 }}>{m.role}</span></td>
                      <td>
                        <span className="font-cinzel" style={{ fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>
                          {m.totalEoScore} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>pts</span>
                        </span>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <div className="score-bar-wrap">
                          <div className="score-bar-bg">
                            <div className="score-bar-fill" style={{ width: `${Math.max(2, (m.totalEoScore / maxEoScore) * 100)}%`, background: "var(--gold)" }} />
                          </div>
                        </div>
                      </td>
                      <td><span style={{ color: "var(--green)", fontWeight: 700 }}>{m.eoPresent}/{m.eoTotal}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <span key={s} style={{ fontSize: 14, color: s <= Math.round(m.avgRating) ? "var(--gold)" : "rgba(99,130,230,0.2)" }}>★</span>
                          ))}
                          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>{m.avgRating}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* GL leaderboard - only show when in GL mode */}
      {lbMode === "gl" && <div className="card mt-2" style={{ marginTop: 16 }}>
        <div className="card-title">Classification Legend</div>

        {/* Score Classification */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: 10 }}>⚔ Score Classification</div>
          <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
            {[["Core", "badge-core", "Score > 80"], ["Active", "badge-active", "Score 60–80"], ["Casual", "badge-casual", "Score 40–60"], ["At Risk", "badge-atrisk", "Score < 40"]].map(([k, c, d]) => (
              <div key={k} className="flex items-center gap-2">
                <span className={`badge ${c}`}>{k}</span>
                <span className="text-xs text-muted">{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--border)", marginBottom: 14 }} />

        {/* Attendance Classification */}
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: 10 }}>🎯 Attendance Classification</div>
          <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
            {[
              ["✅ Reliable", "badge-active", "80%+ attendance", "Dependable guild member"],
              ["⚠️ Average", "badge-casual", "60–79% attendance", "Monitor closely"],
              ["🚨 At Risk", "badge-atrisk", "Below 60%", "Needs follow-up"],
            ].map(([k, c, d, desc]) => (
              <div key={k} className="flex items-center gap-2">
                <span className={`badge ${c}`}>{k}</span>
                <div>
                  <div className="text-xs text-muted">{d}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.7 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>}
    </div>
  );
}

export default LeaderboardPage;
