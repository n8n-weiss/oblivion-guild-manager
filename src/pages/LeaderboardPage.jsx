import React, { useState, useMemo } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { computeLeaderboard } from '../utils/scoring';

function LeaderboardPage({ onViewProfile }) {
  const { members, events, attendance, performance, eoRatings } = useGuild();
  const [filter, setFilter] = useState("All");
  const [lbMode, setLbMode] = useState("Combat"); // "Combat" | "Duty" | "Consistency" | "Support"
  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);
  
  const lb = useMemo(() => {
    const rawLb = computeLeaderboard(activeMembers, events, attendance, performance, eoRatings);
    
    // Sort based on mode
    let sorted = [...rawLb];
    if (lbMode === "Duty") {
      sorted.sort((a, b) => b.attendancePct - a.attendancePct || b.totalScore - a.totalScore);
    } else if (lbMode === "Consistency") {
      // Consistency score = Attendance Pct * 0.6 + (Score / MaxScore * 100) * 0.4
      const maxScore = Math.max(...rawLb.map(m => m.totalScore), 1);
      sorted.sort((a, b) => {
        const scoreA = (a.attendancePct * 0.6) + ((a.totalScore / maxScore) * 40);
        const scoreB = (b.attendancePct * 0.6) + ((b.totalScore / maxScore) * 40);
        return scoreB - scoreA;
      });
    } else if (lbMode === "Support") {
      sorted.sort((a, b) => b.supportIndex - a.supportIndex || b.totalScore - a.totalScore);
    } else {
      sorted.sort((a, b) => b.totalScore - a.totalScore);
    }
    
    return sorted.map((m, i) => ({ ...m, dynamicRank: i + 1 }));
  }, [activeMembers, events, attendance, performance, eoRatings, lbMode]);

  const filtered = filter === "All" ? lb : lb.filter(m => m.classification === filter);
  const maxVal = Math.max(...lb.map(m => 
    lbMode === "Duty" ? m.attendancePct : 
    lbMode === "Support" ? m.avgEoRating * 20 : 
    m.totalScore
  ), 1);

  // EO leaderboard
  const eoEvents = events.filter(e => e.eventType === "Emperium Overrun");
  const eoLb = useMemo(() => activeMembers.map(member => {
    const memberRatings = eoRatings.filter(r => r.memberId === member.memberId);
    const totalEoScore = memberRatings.reduce((sum, r) => sum + (r.rating || 0), 0);
    const eoPresent = eoEvents.filter(ev => attendance.find(a => a.memberId === member.memberId && a.eventId === ev.eventId && a.status === "present")).length;
    const avgRating = memberRatings.length > 0 ? Math.round((totalEoScore / memberRatings.length) * 10) / 10 : 0;
    return { ...member, totalEoScore, eoPresent, eoTotal: eoEvents.length, avgRating };
  }).sort((a, b) => b.totalEoScore - a.totalEoScore).map((m, i) => ({ ...m, eoRank: i + 1 }))
    , [activeMembers, eoRatings, eoEvents, attendance]);
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
            {[
              { id: "Combat", label: "Combat", icon: "⚔️" },
              { id: "Duty", label: "Duty", icon: "🛡️" },
              { id: "Consistency", label: "Stability", icon: "⚖️" },
              { id: "Support", label: "Support", icon: "✨" }
            ].map(cat => (
              <button 
                key={cat.id} 
                className={`btn btn-sm ${lbMode === cat.id ? "btn-primary" : "btn-ghost"}`} 
                onClick={() => setLbMode(cat.id)}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hall of Fame Highlights */}
      <div className="grid-4 gap-4 mb-6">
        {[
          { label: "Top Striker", member: lb.sort((a,b) => b.totalScore - a.totalScore)[0], icon: "🔥", color: "var(--red)" },
          { label: "Reliable Wall", member: lb.sort((a,b) => b.attendancePct - a.attendancePct)[0], icon: "🛡️", color: "var(--green)" },
          { label: "Elite Support", member: lb.sort((a,b) => b.avgEoRating - a.avgEoRating)[0], icon: "✨", color: "var(--accent)" },
          { label: "Consistency King", member: lb.sort((a, b) => {
              const maxS = Math.max(...lb.map(m => m.totalScore), 1);
              return ((b.attendancePct * 0.6) + ((b.totalScore / maxS) * 40)) - ((a.attendancePct * 0.6) + ((a.totalScore / maxS) * 40));
            })[0], icon: "⚖️", color: "var(--gold)" }
        ].map(hl => (
          <div key={hl.label} className="card p-3 flex flex-col items-center text-center" style={{ background: `${hl.color}08`, border: `1px solid ${hl.color}22` }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{hl.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1 }}>{hl.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: hl.color }}>{hl.member?.ign || "---"}</div>
          </div>
        ))}
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

      <div className="card">
        <div className="section-header">
          <div className="font-cinzel text-xs text-muted" style={{ letterSpacing: 2, textTransform: "uppercase" }}>
            {lbMode} Rankings
          </div>
          <div className="flex gap-2">
            {["All", "Core", "Active", "Casual", "At Risk"].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>#</th><th>Player</th><th>Role</th>
              <th>{lbMode === "Combat" ? "Total Score" : lbMode === "Duty" ? "Attendance" : lbMode === "Support" ? "SPI Score" : "Stability"}</th>
              <th>Intensity</th>
              <th>Metrics</th>
              <th>Classification</th>
            </tr></thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.memberId}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 40 }}>
                      {i < 3 && <span style={{ fontSize: 18 }}>{["🥇", "🥈", "🥉"][i]}</span>}
                      <span className="font-cinzel" style={{ fontSize: 13, fontWeight: 700, color: rankColors[i] || "var(--text-muted)" }}>
                        #{i + 1}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <MemberAvatar ign={m.ign} index={i} size={34} />
                      <div>
                        <div style={{ fontWeight: 700, cursor: "pointer", color: "var(--accent)" }}
                          onClick={() => onViewProfile && onViewProfile(m)}>{m.ign}</div>
                        <div className="text-xs text-muted">{m.class}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 10 }}>{m.role}</span></td>
                  <td>
                    <span className="font-cinzel" style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                      {lbMode === "Combat" ? m.totalScore : 
                       lbMode === "Duty" ? `${m.attendancePct}%` : 
                       lbMode === "Support" ? m.supportIndex : 
                       Math.round((m.attendancePct * 0.6) + ((m.totalScore / (Math.max(...lb.map(x => x.totalScore), 1))) * 40))}
                    </span>
                  </td>
                  <td style={{ minWidth: 140 }}>
                    <div className="score-bar-wrap">
                      <div className="score-bar-bg">
                        <div className="score-bar-fill" style={{ 
                          width: `${Math.max(2, (
                            (lbMode === "Combat" ? m.totalScore : 
                             lbMode === "Duty" ? m.attendancePct : 
                             lbMode === "Support" ? m.supportIndex : 
                             (m.attendancePct * 0.6) + ((m.totalScore / (Math.max(...lb.map(x => x.totalScore), 1))) * 40)) / maxVal) * 100)}%`, 
                          background: lbMode === "Combat" ? "var(--accent)" : lbMode === "Duty" ? "var(--green)" : lbMode === "Support" ? "var(--gold)" : "var(--accent2)" 
                        }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      <div>Score: {m.totalScore}</div>
                      <div>Att: {m.attendancePct}%</div>
                    </div>
                  </td>
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
      </div>

      {/* EO Leaderboard */}
      {lbMode === "eo" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
            <div className="font-cinzel text-xs text-muted" style={{ letterSpacing: 2, textTransform: "uppercase" }}>🏰 Emperium Overrun Rankings</div>
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
