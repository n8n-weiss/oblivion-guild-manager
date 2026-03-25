import React, { useMemo } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { computeScore, computeLeaderboard } from '../utils/scoring';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

function Dashboard() {
  const { members, events, attendance, performance, parties, currentUser, userRole, showToast } = useGuild();
  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);
  const lb = useMemo(() => computeLeaderboard(activeMembers, events, attendance, performance), [activeMembers, events, attendance, performance]);
  const totalPresences = attendance.filter(a => a.status === "present").length;
  const totalExpected = attendance.length;
  const attRate = totalExpected ? Math.round((totalPresences / totalExpected) * 100) : 0;
  const activeClassCount = lb.filter(m => m.classification === "Core" || m.classification === "Active").length;
  const top5 = lb.slice(0, 5);

  const avatarColors = ["#6382e6", "#e05c8a", "#40c97a", "#f0c040", "#a78bfa", "#38bdf8", "#fb923c", "#f472b6", "#34d399", "#fbbf24"];

  // Score distribution for bar chart
  const maxScore = Math.max(...lb.map(m => m.totalScore), 1);

  // Role distribution
  const dpsCount = activeMembers.filter(m => m.role === "DPS").length;
  const supCount = activeMembers.filter(m => m.role === "Support").length;
  const total = activeMembers.length || 1;

  // Recent events for trend
  const recentEvents = events.slice(-5);

  // Guild Composition Counts
  const composition = {
    Core: lb.filter(m => m.classification === "Core").length,
    Active: lb.filter(m => m.classification === "Active").length,
    Casual: lb.filter(m => m.classification === "Casual").length,
    "At Risk": lb.filter(m => m.classification === "At Risk").length
  };

  // Party Strength Calculation
  const partyPerformance = useMemo(() => {
    if (!parties || parties.length === 0) return [];
    const PARTY_NAMES_FALLBACK = ["Alpha Squad", "Bravo Force", "Charlie Wing", "Delta Strike", "Echo Vanguard", "Foxtrot Blade"];
    
    return parties.map((pMembers, idx) => {
      const totalStrength = pMembers.reduce((sum, pm) => {
        const lbEntry = lb.find(l => l.memberId === pm.memberId);
        return sum + (lbEntry ? lbEntry.totalScore : 0);
      }, 0);
      const avgStrength = pMembers.length > 0 ? Math.round(totalStrength / pMembers.length) : 0;
      return {
        name: PARTY_NAMES_FALLBACK[idx] || `Team ${idx + 1}`,
        total: totalStrength,
        avg: avgStrength,
        count: pMembers.length
      };
    }).sort((a, b) => b.total - a.total);
  }, [parties, lb]);

  const chartData = useMemo(() => {
    return events.slice(-10).map(ev => {
      const evAtt = attendance.filter(a => a.eventId === ev.eventId);
      const present = evAtt.filter(a => a.status === "present").length;
      const pct = evAtt.length ? Math.round((present / evAtt.length) * 100) : 0;
      return {
        date: ev.eventDate,
        attendance: pct,
        present: present,
        total: evAtt.length,
        type: ev.eventType === "Guild League" ? "⚔️" : "🏰"
      };
    });
  }, [events, attendance]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="card shadow-xl" style={{ border: "1px solid var(--border)", padding: "10px", background: "rgba(10, 15, 25, 0.95)", backdropFilter: "blur(8px)" }}>
          <p className="text-xs text-muted mb-1">{label}</p>
          <p className="font-cinzel text-sm" style={{ color: "var(--accent)" }}>
            Attendance: <span className="text-white">{payload[0].value}%</span>
          </p>
          <p className="text-xs text-muted">
            {payload[0].payload.present} / {payload[0].payload.total} Members
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="page-title">📊 Dashboard</h1>
        </div>
        <p className="page-subtitle">Guild overview & performance at a glance</p>
      </div>

      <div className="stats-grid animate-slide-up">
        <div className="stat-card" style={{ "--stat-accent": "var(--accent)" }}>
          <div className="stat-icon">⚔️</div>
          <div className="stat-label">Active Members</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{activeMembers.length}</div>
          <div className="stat-change">Registered guild members</div>
          <div className={`stat-trend ${members.length >= 10 ? "stat-trend-up" : "stat-trend-neutral"}`}>
            {members.length >= 10 ? "▲" : "●"} {members.length >= 10 ? "Full roster" : "Recruiting"}
          </div>
        </div>
        <div className="stat-card" style={{ "--stat-accent": "var(--green)" }}>
          <div className="stat-icon">🛡️</div>
          <div className="stat-label">Reliable Members</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>{lb.filter(m => m.attStatus?.label === "Reliable").length}</div>
          <div className="stat-change">80%+ attendance · {activeClassCount} high scorers</div>
          <div className={`stat-trend ${lb.filter(m => m.attStatus?.label === "Reliable").length / activeMembers.length >= 0.5 ? "stat-trend-up" : "stat-trend-down"}`}>
            {lb.filter(m => m.attStatus?.label === "Reliable").length / activeMembers.length >= 0.5 ? "▲" : "▼"} {activeMembers.length > 0 ? Math.round(lb.filter(m => m.attStatus?.label === "Reliable").length / activeMembers.length * 100) : 0}% of roster
          </div>
        </div>
        <div className="stat-card" style={{ "--stat-accent": attRate >= 75 ? "var(--green)" : attRate >= 50 ? "var(--gold)" : "var(--red)" }}>
          <div className="stat-icon">📋</div>
          <div className="stat-label">Attendance Rate</div>
          <div className="stat-value" style={{ color: attRate >= 75 ? "var(--green)" : attRate >= 50 ? "var(--gold)" : "var(--red)" }}>{attRate}%</div>
          <div className="stat-change">All events combined</div>
          <div className={`stat-trend ${attRate >= 75 ? "stat-trend-up" : attRate >= 50 ? "stat-trend-neutral" : "stat-trend-down"}`}>
            {attRate >= 75 ? "▲ Excellent" : attRate >= 50 ? "● Good" : "▼ Needs work"}
          </div>
        </div>
        <div className="stat-card" style={{ "--stat-accent": "var(--gold)" }}>
          <div className="stat-icon">🏆</div>
          <div className="stat-label">Total Events</div>
          <div className="stat-value" style={{ color: "var(--gold)" }}>{events.length}</div>
          <div className="stat-change">{events.filter(e => e.eventType === "Guild League").length} GL · {events.filter(e => e.eventType === "Emperium Overrun").length} EO</div>
          <div className="stat-trend stat-trend-neutral">
            ● This season
          </div>
        </div>
      </div>

      <div className="grid-2 mb-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
        {/* Top 5 Players */}
        <div className="card">
          <div className="card-title">🏆 Top Players</div>
          {top5.map((p, i) => (
            <div className="top-player" key={p.memberId}>
              <div className="player-avatar" style={{ background: `${avatarColors[i % avatarColors.length]}22`, color: avatarColors[i % avatarColors.length] }}>
                {p.ign[0]}
              </div>
              <div className="player-info">
                <div className="player-ign">
                  {i === 0 && <span className="text-gold">👑 </span>}
                  {p.ign}
                </div>
                <div className="player-class">{p.class}</div>
              </div>
              <div>
                <div className="player-score" style={{ color: avatarColors[i % avatarColors.length] }}>{p.totalScore}</div>
                <div className="text-xs text-muted text-right">{p.attendancePct}% att</div>
              </div>
            </div>
          ))}
        </div>

        {/* Guild Composition */}
        <div className="card">
          <div className="card-title">🛡️ Guild Composition</div>
          <p className="text-xs text-muted mb-4">Membership tier breakdown based on activity & score.</p>
          <div className="flex flex-col gap-4">
            {[
              { label: "Core", count: composition.Core, color: "var(--gold)", icon: "👑" },
              { label: "Active", count: composition.Active, color: "var(--green)", icon: "🔥" },
              { label: "Casual", count: composition.Casual, color: "var(--accent)", icon: "🎮" },
              { label: "At Risk", count: composition["At Risk"], color: "var(--red)", icon: "⚠️" }
            ].map((tier, i) => (
              <div key={tier.label} className="flex items-center gap-3">
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${tier.color}11`, border: `1px solid ${tier.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                  {tier.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex justify-between items-end mb-1">
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>{tier.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: tier.color }}>{tier.count} <span className="text-xs text-muted" style={{ fontWeight: 400 }}>members</span></span>
                  </div>
                  <div className="progress-bar-wrap" style={{ height: 4 }}>
                    <div className="progress-bar-fill" style={{ width: `${(tier.count / total) * 100}%`, background: tier.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Guild Health</span>
              <span style={{ color: "var(--green)", fontWeight: 700 }}>{Math.round(((composition.Core + composition.Active) / total) * 100)}% Stable</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
        <div className="card-title">📈 Guild Attendance Trend</div>
        <div style={{ height: 220, width: "100%", marginTop: 20 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="attendance"
                stroke="var(--accent)"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorAtt)"
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs text-muted mt-2">Attendance trend across last 10 guild events.</div>
      </div>

      <div className="grid-2 animate-slide-up" style={{ animationDelay: "0.3s" }}>
        {/* Role Distribution + Class Breakdown */}
        <div className="card">
          <div className="card-title">📖 Role Distribution</div>
          <div className="flex items-center gap-6" style={{ marginTop: 12 }}>
            <div style={{ position: "relative" }}>
              <svg width="120" height="120" viewBox="0 0 120 120" style={{ filter: "drop-shadow(0 0 10px rgba(99,130,230,0.2))" }}>
                <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
                <circle cx="60" cy="60" r="45" fill="none" stroke="var(--accent2)" strokeWidth="14"
                  strokeDasharray={`${(dpsCount / total) * 282.7} 282.7`} strokeDashoffset="0"
                  transform="rotate(-90 60 60)" strokeLinecap="round" />
                <circle cx="60" cy="60" r="45" fill="none" stroke="var(--accent)" strokeWidth="14"
                  strokeDasharray={`${(supCount / total) * 282.7} 282.7`} strokeDashoffset={`${-(dpsCount / total) * 282.7}`}
                  transform="rotate(-90 60 60)" strokeLinecap="round" />
                <text x="60" y="58" textAnchor="middle" fill="var(--text-primary)" style={{ fontFamily: "Cinzel,serif", fontSize: 16, fontWeight: 700 }}>{total}</text>
                <text x="60" y="72" textAnchor="middle" fill="var(--text-muted)" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Total</text>
              </svg>
            </div>
            <div className="flex flex-col gap-4" style={{ flex: 1 }}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent2)", boxShadow: "0 0 8px var(--accent2)" }} />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>DPS Units</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{dpsCount} <span className="text-xs text-muted">({Math.round(dpsCount / total * 100)}%)</span></span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Supports</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{supCount} <span className="text-xs text-muted">({Math.round(supCount / total * 100)}%)</span></span>
              </div>
            </div>
          </div>

          {/* Class Breakdown */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div className="card-title" style={{ marginBottom: 12 }}>🎭 Class Breakdown</div>
            {(() => {
              const ALL_CLASSES = [
                { name: "Lord Knight", role: "DPS" },
                { name: "Assassin Cross", role: "DPS" },
                { name: "Sniper", role: "DPS" },
                { name: "High Wizard", role: "DPS" },
                { name: "Stalker", role: "DPS" },
                { name: "Whitesmith", role: "DPS" },
                { name: "Champion", role: "DPS" },
                { name: "High Priest", role: "Support" },
                { name: "Paladin", role: "Support" },
                { name: "Professor", role: "Support" },
                { name: "Creator", role: "Support" },
                { name: "Minstrel", role: "Support" },
                { name: "Diva", role: "Support" },
              ];
              const classCounts = ALL_CLASSES.map(c => ({
                ...c,
                count: activeMembers.filter(m => m.class === c.name).length
              })).filter(c => c.count > 0);
              const maxCount = Math.max(...classCounts.map(c => c.count), 1);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {classCounts.length === 0 && (
                    <div className="text-xs text-muted">No class data yet.</div>
                  )}
                  {classCounts.map(c => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.role === "DPS" ? "var(--accent2)" : "var(--accent)", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 130, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                      <div style={{ flex: 1, height: 6, background: "rgba(99,130,230,0.08)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${(c.count / maxCount) * 100}%`,
                          background: c.role === "DPS" ? "var(--accent2)" : "var(--accent)",
                          borderRadius: 3,
                          transition: "width 0.5s ease",
                          boxShadow: c.role === "DPS" ? "0 0 6px rgba(224,92,138,0.4)" : "0 0 6px rgba(99,130,230,0.4)"
                        }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", minWidth: 16, textAlign: "right" }}>{c.count}</span>
                    </div>
                  ))}
                  {classCounts.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", gap: 12 }}>
                      <span style={{ fontSize: 11, color: "var(--accent2)" }}>● DPS classes</span>
                      <span style={{ fontSize: 11, color: "var(--accent)" }}>● Support classes</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Recent Events */}
        <div className="card">
          <div className="card-title">📅 Recent Events</div>
          <div style={{ marginTop: 8 }}>
            {events.slice(-5).reverse().map(ev => {
              const evAtt = attendance.filter(a => a.eventId === ev.eventId);
              const present = evAtt.filter(a => a.status === "present").length;
              const absent = evAtt.length - present;
              const pct = evAtt.length ? Math.round((present / evAtt.length) * 100) : 0;
              const isGL = ev.eventType === "Guild League";
              const barColor = pct >= 75 ? "var(--green)" : pct >= 50 ? "var(--gold)" : "var(--red)";
              const barGlow = pct >= 75 ? "rgba(64,201,122,0.5)" : pct >= 50 ? "rgba(240,192,64,0.5)" : "rgba(224,80,80,0.5)";

              // top scorer for this event
              const evPerf = performance.filter(p => p.eventId === ev.eventId);
              let topScorer = null;
              let topScore = -Infinity;
              evPerf.forEach(p => {
                const member = activeMembers.find(m => m.memberId === p.memberId);
                const att = evAtt.find(a => a.memberId === p.memberId);
                const s = computeScore({ event: ev, att, perf: p });
                if (s > topScore) { topScore = s; topScorer = member; }
              });

              return (
                <div key={ev.eventId} style={{ padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
                  {/* Header row */}
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: 38, height: 38, borderRadius: 8,
                        background: isGL ? "rgba(240,192,64,0.12)" : "rgba(99,130,230,0.12)",
                        border: `1px solid ${isGL ? "rgba(240,192,64,0.3)" : "rgba(99,130,230,0.3)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18, flexShrink: 0
                      }}>
                        {isGL ? "⚔️" : "🏰"}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{ev.eventDate}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ev.eventType}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Attendance count badge */}
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "Cinzel,serif", fontSize: 20, fontWeight: 700, color: barColor, lineHeight: 1 }}>{present}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1 }}>/ {evAtt.length}</div>
                      </div>
                      {/* Pct badge */}
                      <div style={{
                        padding: "4px 12px", borderRadius: 20,
                        background: pct >= 75 ? "rgba(64,201,122,0.15)" : pct >= 50 ? "rgba(240,192,64,0.15)" : "rgba(224,80,80,0.15)",
                        border: `1px solid ${barColor}44`,
                        color: barColor, fontSize: 14, fontWeight: 700, fontFamily: "Cinzel,serif"
                      }}>{pct}%</div>
                    </div>
                  </div>

                  {/* Progress bar — thicker with glow */}
                  <div style={{ height: 10, background: "rgba(99,130,230,0.08)", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{
                      height: "100%",
                      width: `${pct}%`,
                      borderRadius: 5,
                      background: barColor,
                      boxShadow: `0 0 10px ${barGlow}`,
                      transition: "width 0.6s ease"
                    }} />
                  </div>

                  {/* Bottom row — absent count + top scorer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 12, color: "var(--green)" }}>✓ {present} present</span>
                      <span style={{ fontSize: 12, color: "var(--red)" }}>✕ {absent} absent</span>
                    </div>
                    {topScorer && (
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Top:</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>⭐ {topScorer.ign}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>+{topScore}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {events.length === 0 && <div className="text-muted text-sm" style={{ padding: "16px 0" }}>No events yet.</div>}
          </div>
        </div>
      </div>
      <div className="grid-2 animate-slide-up" style={{ animationDelay: "0.4s", marginTop: 20 }}>
        {/* Party Performance Comparison */}
        <div className="card">
          <div className="card-title">🛡️ Party Strength Comparison</div>
          <div className="flex flex-col gap-4" style={{ marginTop: 12 }}>
            {partyPerformance.map((pp, i) => {
              const maxPartyScore = Math.max(...partyPerformance.map(p => p.total), 1);
              const barPct = (pp.total / maxPartyScore) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{pp.name}</span>
                      <span className="text-xs text-muted">({pp.count} members)</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{pp.total} <span style={{ fontWeight: 400, opacity: 0.6 }}>(avg {pp.avg})</span></span>
                  </div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill" style={{ width: `${barPct}%`, background: `linear-gradient(90deg, var(--accent), var(--accent2))` }} />
                  </div>
                </div>
              );
            })}
            {partyPerformance.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🛡️</div>
                <div className="empty-state-text">No parties built yet. Go to Party Builder to organize squads.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
