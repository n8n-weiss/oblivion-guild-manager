import React, { useState, useMemo, useEffect } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { computeLeaderboard } from '../utils/scoring';

function LeaderboardPage({ onViewProfile }) {
  const { members, events, attendance, performance, eoRatings } = useGuild();
  const LEADERBOARD_PRESETS_KEY = "leaderboard_view_presets_v1";
  const LEADERBOARD_TABLE_UI_KEY = "leaderboard_table_ui_v1";
  const LEADERBOARD_RANK_SNAPSHOT_KEY = "leaderboard_rank_snapshots_v1";
  const [filter, setFilter] = useState(() => localStorage.getItem("leaderboard_filter") || "All");
  const [lbMode, setLbMode] = useState(() => localStorage.getItem("leaderboard_mode") || "Combat"); // "Combat" | "Duty" | "Consistency" | "Support" | "eo"
  const [viewPresets, setViewPresets] = useState(() => {
    try {
      const raw = localStorage.getItem(LEADERBOARD_PRESETS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
    } catch {
      return [];
    }
  });
  const [tableCompact, setTableCompact] = useState(() => {
    try {
      return localStorage.getItem(LEADERBOARD_TABLE_UI_KEY + "_compact") === "1";
    } catch {
      return false;
    }
  });
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const raw = localStorage.getItem(LEADERBOARD_TABLE_UI_KEY + "_cols");
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        metrics: parsed?.metrics !== false,
        classification: parsed?.classification !== false
      };
    } catch {
      return { metrics: true, classification: true };
    }
  });
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
    lbMode === "Support" ? m.supportIndex : 
    lbMode === "Consistency" ? ((m.attendancePct * 0.6) + ((m.totalScore / Math.max(...lb.map(x => x.totalScore), 1)) * 40)) :
    m.totalScore
  ), 1);

  // EO leaderboard
  const eoEvents = events.filter(e => e.eventType === "Emperium Overrun");
  const eoLb = useMemo(() => activeMembers.map(member => {
    const mId = (member.memberId || "").toLowerCase();
    const memberRatings = eoRatings.filter(r => (r.memberId || "").toLowerCase() === mId);
    const eoPresent = eoEvents.filter(ev => attendance.find(a => (a.memberId || "").toLowerCase() === mId && a.eventId === ev.eventId && a.status === "present")).length;
    const totalEoScore = memberRatings.reduce((sum, r) => sum + (r.rating || 0), 0);
    const avgRating = memberRatings.length > 0 ? Math.round((totalEoScore / memberRatings.length) * 10) / 10 : 0;
    return { ...member, totalEoScore, eoPresent, eoTotal: eoEvents.length, avgRating };
  }).sort((a, b) => b.totalEoScore - a.totalEoScore).map((m, i) => ({ ...m, eoRank: i + 1 }))
    , [activeMembers, eoRatings, eoEvents, attendance]);
  const maxEoScore = Math.max(...eoLb.map(m => m.totalEoScore), 1);

  const rankColors = ["var(--gold)", "#c0c0c0", "#cd7f32"];
  const podiumData = lbMode === "eo" ? eoLb.slice(0, 3) : lb.slice(0, 3);
  const currentModeRows = lbMode === "eo" ? eoLb : lb;
  const currentRankMap = useMemo(
    () => Object.fromEntries(currentModeRows.map((m, idx) => [String(m.memberId || "").toLowerCase(), idx + 1])),
    [currentModeRows]
  );
  const previousRankMap = useMemo(() => {
    try {
      const raw = localStorage.getItem(LEADERBOARD_RANK_SNAPSHOT_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed?.[lbMode] || {};
    } catch {
      return {};
    }
  }, [lbMode]);
  useEffect(() => {
    if (JSON.stringify(previousRankMap) === JSON.stringify(currentRankMap)) return;
    let snapshots = {};
    try {
      const raw = localStorage.getItem(LEADERBOARD_RANK_SNAPSHOT_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      snapshots = parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      snapshots = {};
    }
    const next = { ...snapshots, [lbMode]: currentRankMap };
    localStorage.setItem(LEADERBOARD_RANK_SNAPSHOT_KEY, JSON.stringify(next));
  }, [lbMode, currentRankMap, previousRankMap]);
  const movementFor = (memberId, currentRank) => {
    const key = String(memberId || "").toLowerCase();
    const prevRank = previousRankMap?.[key];
    if (!prevRank || !currentRank) return { label: "NEW", color: "var(--text-muted)" };
    const delta = prevRank - currentRank;
    if (delta > 0) return { label: `↑${delta}`, color: "var(--green)" };
    if (delta < 0) return { label: `↓${Math.abs(delta)}`, color: "var(--red)" };
    return { label: "—", color: "var(--text-muted)" };
  };
  const overviewCards = useMemo(() => {
    if (lbMode === "eo") {
      return [
        { label: "EO Top", value: eoLb[0]?.ign || "—", tone: "var(--gold)" },
        { label: "Best Avg Rating", value: [...eoLb].sort((a, b) => b.avgRating - a.avgRating)[0]?.ign || "—", tone: "var(--accent)" },
        { label: "Most EO Attendance", value: [...eoLb].sort((a, b) => b.eoPresent - a.eoPresent)[0]?.ign || "—", tone: "var(--green)" }
      ];
    }
    return [
      { label: "Top DPS", value: [...lb].filter(m => (m.role || "").toLowerCase() === "dps").sort((a, b) => b.totalScore - a.totalScore)[0]?.ign || "—", tone: "var(--red)" },
      { label: "Top Support", value: [...lb].filter(m => (m.role || "").toLowerCase().includes("support")).sort((a, b) => b.supportIndex - a.supportIndex)[0]?.ign || "—", tone: "var(--gold)" },
      { label: "Best Attendance", value: [...lb].sort((a, b) => b.attendancePct - a.attendancePct)[0]?.ign || "—", tone: "var(--green)" }
    ];
  }, [lbMode, lb, eoLb]);
  const topMovers = useMemo(() => {
    const movementRows = currentModeRows
      .map((m, idx) => {
        const memberId = String(m.memberId || "").toLowerCase();
        const prevRank = Number(previousRankMap?.[memberId] || 0);
        const currentRank = lbMode === "eo" ? Number(m.eoRank || idx + 1) : idx + 1;
        if (!prevRank || !currentRank) return null;
        const delta = prevRank - currentRank;
        if (delta === 0) return null;
        return { member: m, delta, currentRank };
      })
      .filter(Boolean);
    const climbers = [...movementRows]
      .filter(r => r.delta > 0)
      .sort((a, b) => b.delta - a.delta || a.currentRank - b.currentRank)
      .slice(0, 3);
    const droppers = [...movementRows]
      .filter(r => r.delta < 0)
      .sort((a, b) => a.delta - b.delta || a.currentRank - b.currentRank)
      .slice(0, 3);
    return { climbers, droppers };
  }, [currentModeRows, previousRankMap, lbMode]);
  useEffect(() => { localStorage.setItem("leaderboard_filter", filter); }, [filter]);
  useEffect(() => { localStorage.setItem("leaderboard_mode", lbMode); }, [lbMode]);
  useEffect(() => {
    localStorage.setItem(LEADERBOARD_PRESETS_KEY, JSON.stringify(viewPresets.slice(0, 8)));
  }, [viewPresets]);
  useEffect(() => {
    localStorage.setItem(LEADERBOARD_TABLE_UI_KEY + "_compact", tableCompact ? "1" : "0");
  }, [tableCompact]);
  useEffect(() => {
    localStorage.setItem(LEADERBOARD_TABLE_UI_KEY + "_cols", JSON.stringify(visibleCols));
  }, [visibleCols]);
  const saveCurrentPreset = () => {
    const name = window.prompt("Preset name?", `Leaderboard ${viewPresets.length + 1}`);
    if (!name || !name.trim()) return;
    const normalized = name.trim().slice(0, 32);
    const payload = { filter, lbMode };
    const existing = viewPresets.find(p => p.name.toLowerCase() === normalized.toLowerCase());
    if (existing) {
      setViewPresets(prev => prev.map(p => (p.id === existing.id ? { ...p, ...payload } : p)));
      return;
    }
    const next = { id: `lbp_${Date.now()}`, name: normalized, ...payload };
    setViewPresets(prev => [next, ...prev].slice(0, 8));
  };
  const applyPreset = (preset) => {
    setFilter(preset.filter || "All");
    setLbMode(preset.lbMode || "Combat");
  };
  const deletePreset = (id) => {
    setViewPresets(prev => prev.filter(p => p.id !== id));
  };
  const updatePreset = (id) => {
    setViewPresets(prev => prev.map(p => (
      p.id === id
        ? { ...p, filter, lbMode }
        : p
    )));
  };
  const pinPresetToTop = (id) => {
    setViewPresets(prev => {
      const found = prev.find(p => p.id === id);
      if (!found) return prev;
      return [found, ...prev.filter(p => p.id !== id)];
    });
  };
  const toggleCol = (key) => {
    setVisibleCols(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const getPodiumValue = (m) => {
    if (!m) return "";
    if (lbMode === "Combat") return m.totalScore;
    if (lbMode === "Duty") return `${m.attendancePct}%`;
    if (lbMode === "Consistency") {
        const ms = Math.max(...lb.map(x => x.totalScore), 1);
        return Math.round((m.attendancePct * 0.6) + ((m.totalScore / ms) * 40));
    }
    if (lbMode === "Support") return `${m.supportIndex} SPI`;
    if (lbMode === "eo") return `${m.totalEoScore} ★`;
    return m.totalScore;
  };
  
  const getPodiumSubtitle = (m) => {
     if (!m) return "";
     if (lbMode === "eo") return `${m.avgRating} Avg`;
     return `${m.attendancePct}% att`;
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">🏆 Leaderboard</h1>
            <p className="page-subtitle">Rankings based on scoring formula — auto-computed</p>
          </div>
          <div className="show-on-mobile">
            <div className="flex gap-2 quick-summary-bar" style={{ margin: "16px 0 0", padding: "4px 0", overflowX: "auto", flexWrap: "nowrap" }}>
              {[
                { id: "Combat", label: "Combat", icon: "⚔️" },
                { id: "Duty", label: "Duty", icon: "🛡️" },
                { id: "Consistency", label: "Stability", icon: "⚖️" },
                { id: "Support", label: "Support", icon: "✨" },
                { id: "eo", label: "EO Ratings", icon: "🏰" }
              ].map(cat => (
                <button 
                  key={cat.id} 
                  className={`btn btn-sm ${lbMode === cat.id ? "btn-primary" : "btn-ghost"}`} 
                  style={{ flex: "0 0 auto" }}
                  onClick={() => setLbMode(cat.id)}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hide-on-mobile">
            <div className="flex gap-2">
              {[
                { id: "Combat", label: "Combat", icon: "⚔️" },
                { id: "Duty", label: "Duty", icon: "🛡️" },
                { id: "Consistency", label: "Stability", icon: "⚖️" },
                { id: "Support", label: "Support", icon: "✨" },
                { id: "eo", label: "EO Ratings", icon: "🏰" }
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
      </div>
      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={saveCurrentPreset} title="Save current leaderboard mode and filter">
          <Icon name="save" size={12} /> Save View
        </button>
        {viewPresets.map(p => (
          <div key={p.id} className="badge badge-casual" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px" }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: "2px 6px", fontSize: 11 }}
              onClick={() => applyPreset(p)}
              title={`Apply ${p.name}`}
            >
              {p.name}
            </button>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              style={{ padding: 0, width: 18, height: 18 }}
              onClick={() => pinPresetToTop(p.id)}
              title={`Pin ${p.name} to top`}
            >
              <span style={{ fontSize: 11, lineHeight: 1 }}>📌</span>
            </button>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              style={{ padding: 0, width: 18, height: 18 }}
              onClick={() => updatePreset(p.id)}
              title={`Update ${p.name} from current view`}
            >
              <Icon name="save" size={11} />
            </button>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              style={{ padding: 0, width: 18, height: 18 }}
              onClick={() => deletePreset(p.id)}
              title={`Delete ${p.name}`}
            >
              <Icon name="x" size={11} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap", alignItems: "center" }}>
        <button className={`btn btn-sm ${tableCompact ? "btn-primary" : "btn-ghost"}`} onClick={() => setTableCompact(v => !v)}>
          <Icon name="grid" size={12} /> {tableCompact ? "Compact Rows: On" : "Compact Rows: Off"}
        </button>
        <button className={`btn btn-sm ${visibleCols.metrics ? "btn-primary" : "btn-ghost"}`} onClick={() => toggleCol("metrics")}>Metrics</button>
        <button className={`btn btn-sm ${visibleCols.classification ? "btn-primary" : "btn-ghost"}`} onClick={() => toggleCol("classification")}>Classification</button>
        <div className="badge badge-casual" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "4px 10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 0.4 }}>MOVEMENT</span>
          <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>↑ Up</span>
          <span style={{ fontSize: 11, color: "var(--red)", fontWeight: 700 }}>↓ Down</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>— Same</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>NEW First seen</span>
        </div>
      </div>
      <div className="sticky-actions" style={{ marginBottom: 16 }}>
        <div className="quick-summary-bar" style={{ padding: "8px 10px", borderRadius: 12 }}>
          <div className="summary-item" style={{ minWidth: 120 }}>
            <span className="summary-label">MODE</span>
            <span className="summary-value">{lbMode === "eo" ? "EO Ratings" : lbMode}</span>
          </div>
          {overviewCards.map(card => (
            <div key={card.label} className="summary-item" style={{ minWidth: 170, borderColor: card.tone }}>
              <span className="summary-label">{card.label}</span>
              <span className="summary-value" style={{ color: card.tone }}>{card.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <div className="font-cinzel text-xs text-muted" style={{ letterSpacing: 2, textTransform: "uppercase" }}>
            Top Movers ({lbMode === "eo" ? "EO Ratings" : lbMode})
          </div>
          <div className="text-xs text-muted">Compared to previous snapshot in this mode</div>
        </div>
        <div className="grid-2" style={{ gap: 14 }}>
          <div style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(64,201,122,0.25)", background: "rgba(64,201,122,0.08)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--green)", textTransform: "uppercase", marginBottom: 8 }}>📈 Biggest Climbers</div>
            {topMovers.climbers.length ? topMovers.climbers.map(row => (
              <div key={row.member.memberId} className="flex items-center justify-between" style={{ marginBottom: 6, gap: 10 }}>
                <div className="flex items-center" style={{ gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px", fontSize: 12 }} onClick={() => onViewProfile && onViewProfile(row.member)}>
                    {row.member.ign}
                  </button>
                  <span className="badge badge-casual" style={{ fontSize: 10, padding: "2px 6px" }}>{`#${row.currentRank}`}</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 700 }}>{`↑${row.delta}`}</span>
              </div>
            )) : <div className="text-xs text-muted">No upward movement yet.</div>}
          </div>
          <div style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(224,80,80,0.25)", background: "rgba(224,80,80,0.08)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--red)", textTransform: "uppercase", marginBottom: 8 }}>📉 Biggest Droppers</div>
            {topMovers.droppers.length ? topMovers.droppers.map(row => (
              <div key={row.member.memberId} className="flex items-center justify-between" style={{ marginBottom: 6, gap: 10 }}>
                <div className="flex items-center" style={{ gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px", fontSize: 12 }} onClick={() => onViewProfile && onViewProfile(row.member)}>
                    {row.member.ign}
                  </button>
                  <span className="badge badge-casual" style={{ fontSize: 10, padding: "2px 6px" }}>{`#${row.currentRank}`}</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--red)", fontWeight: 700 }}>{`↓${Math.abs(row.delta)}`}</span>
              </div>
            )) : <div className="text-xs text-muted">No downward movement yet.</div>}
          </div>
        </div>
      </div>

      {/* Top 3 podium - DYNAMIC for all modes */}
      <div className="flex gap-4 items-end justify-center animate-slide-up" style={{ maxWidth: 700, margin: "0 auto 32px" }}>
        {[podiumData[1], podiumData[0], podiumData[2]].map((m, idx) => {
          if (!m) return <div key={idx} style={{ flex: 1 }} />;
          // We mapped [1, 0, 2] which corresponds to 2nd, 1st, 3rd places visually.
          const realRankMap = [2, 1, 3];
          const realRank = realRankMap[idx];
          const rankIdx = realRank - 1; // 0 for 1st, 1 for 2nd, 2 for 3rd
          
          const podiumH = [160, 120, 95]; // 1st, 2nd, 3rd height
          const medals = ["🥇", "🥈", "🥉"];
          const labels = ["#1", "#2", "#3"];
          
          return (
            <div key={m.memberId} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 28 }} className="animate-float">{medals[rankIdx]}</div>
              <MemberAvatar ign={m.ign} index={rankIdx} size={46} />
              <div style={{ fontWeight: 700, fontSize: 15, textAlign: "center", color: "var(--text-primary)", cursor: "pointer" }} onClick={() => onViewProfile && onViewProfile(m)}>{m.ign}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>{m.class}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontFamily: "Cinzel,serif", fontSize: 22, fontWeight: 700, color: rankColors[rankIdx], textShadow: `0 0 12px ${rankColors[rankIdx]}66` }}>
                  {getPodiumValue(m)}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{getPodiumSubtitle(m)}</div>
              </div>
              <div style={{
                width: "100%", height: podiumH[rankIdx],
                background: `${rankColors[rankIdx]}22`,
                borderRadius: "10px 10px 0 0",
                border: `2px solid ${rankColors[rankIdx]}`,
                borderBottom: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `inset 0 0 30px ${rankColors[rankIdx]}22, 0 0 20px ${rankColors[rankIdx]}33`,
                position: "relative",
                overflow: "hidden",
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
              }}>
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  height: "60%",
                  background: `linear-gradient(to top, ${rankColors[rankIdx]}44, transparent)`,
                }} />
                <span style={{
                  fontFamily: "Cinzel,serif",
                  fontSize: 48, fontWeight: 900,
                  color: rankColors[rankIdx],
                  opacity: 0.6,
                  zIndex: 1,
                  textShadow: `0 0 20px ${rankColors[rankIdx]}`,
                }}>{labels[rankIdx]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hall of Fame Highlights - Hide on EO Mode */}
      {lbMode !== "eo" && <div className="grid-4 gap-4 mb-6">
        {[
          { label: "Top Striker", member: lb.sort((a,b) => b.totalScore - a.totalScore)[0], icon: "🔥", color: "var(--red)" },
          { label: "Reliable Wall", member: lb.sort((a,b) => b.attendancePct - a.attendancePct)[0], icon: "🛡️", color: "var(--green)" },
          { label: "Elite Support", member: lb.sort((a,b) => b.avgEoRating - a.avgEoRating)[0], icon: "✨", color: "var(--accent)" },
          { label: "Consistency King", member: lb.sort((a, b) => {
              const maxS = Math.max(...lb.map(m => m.totalScore), 1);
              return ((b.attendancePct * 0.6) + ((b.totalScore / maxS) * 40)) - ((a.attendancePct * 0.6) + ((a.totalScore / maxS) * 40));
            })[0], icon: "⚖️", color: "var(--gold)" }
        ].map(hl => (
          <div key={hl.label} className="card p-3 flex flex-col items-center text-center hover:scale-105 transition-transform" style={{ background: `${hl.color}08`, border: `1px solid ${hl.color}22`, cursor: "pointer" }} onClick={() => hl.member && onViewProfile && onViewProfile(hl.member)}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{hl.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1 }}>{hl.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: hl.color, marginTop: 4 }}>{hl.member?.ign || "---"}</div>
          </div>
        ))}
      </div>}

      {/* Main Leaderboard Table */}
      {lbMode !== "eo" ? (
        <div className="card animate-fade-in" style={{ marginBottom: 16 }}>
          <div className="show-on-mobile quick-summary-bar">
            <div className="summary-item">
              <span className="summary-label">RANK #1</span>
              <span className="summary-value" style={{ color: 'var(--gold)' }}>{lb[0]?.ign || "—"}</span>
            </div>
            <div className="summary-item" style={{ borderColor: "var(--accent)" }}>
              <span className="summary-label">MODE</span>
              <span className="summary-value" style={{ fontSize: 14 }}>{lbMode.toUpperCase()}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">UNIT COUNT</span>
              <span className="summary-value" style={{ color: 'var(--accent2)' }}>{filtered.length}</span>
            </div>
          </div>

          <div className="section-header">
            <div className="font-cinzel text-xs text-muted" style={{ letterSpacing: 2, textTransform: "uppercase" }}>
              {lbMode} Rankings
            </div>
            <div className="flex gap-1 quick-summary-bar" style={{ padding: 0, margin: 0, border: "none" }}>
              {["All", "Core", "Active", "Casual", "At Risk"].map(f => (
                <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)} style={{ fontSize: 10, padding: "4px 8px" }}>{f}</button>
              ))}
            </div>
          </div>
          <div className={`table-wrap table-sticky-head ${tableCompact ? "table-compact" : ""} hide-on-mobile`}>
            <table>
              <thead><tr>
                <th>#</th><th>Player</th><th>Role</th>
                <th>{lbMode === "Combat" ? "Total Score" : lbMode === "Duty" ? "Attendance" : lbMode === "Support" ? "SPI Score" : "Stability"}</th>
                <th>Intensity</th>
                {visibleCols.metrics && <th>Metrics</th>}
                {visibleCols.classification && <th>Classification</th>}
              </tr></thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr key={m.memberId} className="table-row-hover">
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
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="font-cinzel" style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                          {lbMode === "Combat" ? m.totalScore : 
                          lbMode === "Duty" ? `${m.attendancePct}%` : 
                          lbMode === "Support" ? m.supportIndex : 
                          Math.round((m.attendancePct * 0.6) + ((m.totalScore / (Math.max(...lb.map(x => x.totalScore), 1))) * 40))}
                        </span>
                        <span className="badge badge-casual" style={{ fontSize: 10, color: movementFor(m.memberId, i + 1).color }}>
                          {movementFor(m.memberId, i + 1).label}
                        </span>
                      </div>
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <div className="score-bar-wrap">
                        <div className="score-bar-bg">
                          <div className="score-bar-fill score-bar-glow" style={{ 
                            width: `${Math.max(2, (
                              (lbMode === "Combat" ? m.totalScore : 
                               lbMode === "Duty" ? m.attendancePct : 
                               lbMode === "Support" ? m.supportIndex : 
                               (m.attendancePct * 0.6) + ((m.totalScore / (Math.max(...lb.map(x => x.totalScore), 1))) * 40)) / maxVal) * 100)}%`, 
                            background: lbMode === "Combat" ? "var(--accent)" : lbMode === "Duty" ? "var(--green)" : lbMode === "Support" ? "var(--gold)" : "var(--accent2)",
                            color: lbMode === "Combat" ? "var(--accent-glow)" : lbMode === "Duty" ? "rgba(64, 201, 122, 0.4)" : lbMode === "Support" ? "rgba(240, 192, 64, 0.4)" : "rgba(224, 92, 138, 0.4)"
                          }} />
                        </div>
                      </div>
                    </td>
                    {visibleCols.metrics && <td>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        <div>Score: {m.totalScore}</div>
                        <div>Att: {m.attendancePct}%</div>
                      </div>
                    </td>}
                    {visibleCols.classification && <td>
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
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="show-on-mobile">
            {filtered.map((m, i) => {
              const val = lbMode === "Combat" ? m.totalScore : 
                          lbMode === "Duty" ? `${m.attendancePct}%` : 
                          lbMode === "Support" ? m.supportIndex : 
                          Math.round((m.attendancePct * 0.6) + ((m.totalScore / (Math.max(...lb.map(x => x.totalScore), 1))) * 40));
              const rankLabel = i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`;
              return (
                <div key={m.memberId} className="glass-card-mobile animate-fade-in" style={{ borderLeft: `3px solid ${rankColors[i] || "var(--border)"}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div style={{ fontFamily: "Cinzel, serif", fontWeight: 900, fontSize: 16, color: rankColors[i] || "var(--text-muted)", minWidth: 24 }}>
                        {rankLabel}
                      </div>
                      <MemberAvatar ign={m.ign} index={i} size={40} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }} onClick={() => onViewProfile && onViewProfile(m)}>{m.ign}</div>
                        <div className="text-xs text-muted leading-tight">{m.class}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="font-cinzel" style={{ fontSize: 18, fontWeight: 700, color: rankColors[i] || "var(--text-primary)" }}>{val}</div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>{lbMode} SCORE</div>
                      <div style={{ marginTop: 2, fontSize: 10, color: movementFor(m.memberId, i + 1).color }}>{movementFor(m.memberId, i + 1).label}</div>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-3">
                     <span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 9 }}>{m.role}</span>
                     <span className={`badge ${m.classification === "Core" ? "badge-core" : m.classification === "Active" ? "badge-active" : m.classification === "Casual" ? "badge-casual" : "badge-atrisk"}`} style={{ fontSize: 9 }}>{m.classification}</span>
                     <span className={`badge ${m.attStatus?.badge || "badge-casual"}`} style={{ fontSize: 9 }}>🎯 {m.attStatus?.label}</span>
                  </div>

                  <div className="score-bar-wrap mb-1" style={{ height: 4 }}>
                     <div className="score-bar-bg" style={{ height: 4 }}>
                       <div className="score-bar-fill score-bar-glow" style={{ 
                          height: 4,
                          width: `${Math.max(2, (
                            (lbMode === "Combat" ? m.totalScore : 
                             lbMode === "Duty" ? m.attendancePct : 
                             lbMode === "Support" ? m.supportIndex : 
                             (m.attendancePct * 0.6) + ((m.totalScore / (Math.max(...lb.map(x => x.totalScore), 1))) * 40)) / maxVal) * 100)}%`,
                          background: i < 3 ? rankColors[i] : "var(--accent)",
                          color: i < 3 ? rankColors[i] : "var(--accent-glow)"
                       }} />
                     </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* EO Leaderboard */
        <div className="card animate-fade-in" style={{ marginBottom: 16 }}>
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
            <div className="table-wrap hide-on-mobile">
              <table>
                <thead><tr>
                  <th>#</th><th>Player</th><th>Role</th><th>Total EO Score</th><th>Score Bar</th><th>EO Attended</th><th>Avg Rating</th>
                </tr></thead>
                <tbody>
                  {eoLb.map((m) => (
                    <tr key={m.memberId} className="table-row-hover">
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 40 }}>
                          {m.eoRank <= 3 && <span style={{ fontSize: 18 }}>{["🥇", "🥈", "🥉"][m.eoRank - 1]}</span>}
                          <span className="font-cinzel" style={{ fontSize: 13, fontWeight: 700, color: m.eoRank <= 3 ? rankColors[m.eoRank - 1] : "var(--text-muted)" }}>#{m.eoRank}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <MemberAvatar ign={m.ign} index={m.eoRank - 1} size={34} />
                          <div>
                            <div style={{ fontWeight: 700, cursor: "pointer", color: "var(--gold)" }} onClick={() => onViewProfile && onViewProfile(m)}>{m.ign}</div>
                            <div className="text-xs text-muted">{m.class}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 10 }}>{m.role}</span></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="font-cinzel" style={{ fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>
                            {m.totalEoScore} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>pts</span>
                          </span>
                          <span className="badge badge-casual" style={{ fontSize: 10, color: movementFor(m.memberId, m.eoRank).color }}>
                            {movementFor(m.memberId, m.eoRank).label}
                          </span>
                        </div>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <div className="score-bar-wrap">
                          <div className="score-bar-bg">
                            <div className="score-bar-fill score-bar-glow" style={{ width: `${Math.max(2, (m.totalEoScore / maxEoScore) * 100)}%`, background: "var(--gold)", color: "rgba(240, 192, 64, 0.4)" }} />
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
          
          {/* EO Mobile List */}
          {!eoLb.every(m => m.totalEoScore === 0) && (
             <div className="show-on-mobile">
               {eoLb.map((m) => (
                 <div key={m.memberId} className="glass-card-mobile animate-fade-in" style={{ borderLeft: `3px solid ${m.eoRank <= 3 ? rankColors[m.eoRank - 1] : "var(--border)"}` }}>
                   <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-3">
                       <div style={{ fontFamily: "Cinzel, serif", fontWeight: 900, fontSize: 16, color: m.eoRank <= 3 ? rankColors[m.eoRank - 1] : "var(--text-muted)", minWidth: 24 }}>
                         {m.eoRank <= 3 ? ["🥇", "🥈", "🥉"][m.eoRank - 1] : `#${m.eoRank}`}
                       </div>
                       <MemberAvatar ign={m.ign} index={m.eoRank - 1} size={40} />
                       <div>
                         <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }} onClick={() => onViewProfile && onViewProfile(m)}>{m.ign}</div>
                         <div className="text-xs text-muted leading-tight">{m.class}</div>
                       </div>
                     </div>
                     <div style={{ textAlign: "right" }}>
                       <div className="font-cinzel" style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>{m.totalEoScore}</div>
                       <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>EO SCORE</div>
                     </div>
                   </div>
                   <div className="flex gap-2 mb-3 items-center">
                      <span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 9 }}>{m.role}</span>
                      <div style={{ display: "flex", gap: 1, alignItems: "center" }}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <span key={s} style={{ fontSize: 10, color: s <= Math.round(m.avgRating) ? "var(--gold)" : "rgba(99,130,230,0.2)" }}>★</span>
                        ))}
                      </div>
                      <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700, marginLeft: "auto" }}>{m.eoPresent}/{m.eoTotal} Attended</span>
                   </div>
                   <div className="score-bar-wrap mb-1" style={{ height: 4 }}>
                      <div className="score-bar-bg" style={{ height: 4 }}>
                        <div className="score-bar-fill score-bar-glow" style={{ 
                           height: 4,
                           width: `${Math.max(2, (m.totalEoScore / maxEoScore) * 100)}%`,
                           background: "var(--gold)",
                           color: "rgba(240, 192, 64, 0.4)"
                        }} />
                      </div>
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      )}

      {/* Persistent Classification Legend */}
      <div className="card mt-4" style={{ marginBottom: 24 }}>
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
      </div>
    </div>
  );
}

export default LeaderboardPage;
