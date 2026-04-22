import React, { useState, useMemo, useEffect } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { computeLeaderboard, computeScore } from '../utils/scoring';

function LeaderboardPage({ onViewProfile }) {
  const ALERT_RULES = {
    attendanceRiskPct: 65,
    fastClimberDelta: 1,
    needsReviewDropDelta: 2,
    noShowStreak: 2
  };
  const { members, events, attendance, performance, eoRatings, isOfficer, showToast, isMobile, sendDiscordEmbed, discordConfig } = useGuild();
  const [postingDigest, setPostingDigest] = useState(false);
  const LEADERBOARD_PRESETS_KEY = "leaderboard_view_presets_v1";
  const LEADERBOARD_TABLE_UI_KEY = "leaderboard_table_ui_v1";
  const LEADERBOARD_RANK_SNAPSHOT_KEY = "leaderboard_rank_snapshots_v1";
  const [filter, setFilter] = useState(() => localStorage.getItem("leaderboard_filter") || "All");
  const [lbMode, setLbMode] = useState(() => localStorage.getItem("leaderboard_mode") || "Combat"); // "Combat" | "Duty" | "Consistency" | "Support" | "eo"
  const [periodScope, setPeriodScope] = useState(() => localStorage.getItem("leaderboard_scope_v1") || "all"); // all | 30d | last8
  const [queueMode, setQueueMode] = useState(() => localStorage.getItem("leaderboard_queue_v1") || "all"); // all | risk | movers | support

  const [tableCompact, setTableCompact] = useState(() => {
    try {
      return localStorage.getItem(LEADERBOARD_TABLE_UI_KEY + "_compact") === "1";
    } catch {
      return false;
    }
  });
  const [showDetailCols, setShowDetailCols] = useState(() => {
    try {
      return localStorage.getItem(LEADERBOARD_TABLE_UI_KEY + "_details") === "1";
    } catch {
      return false;
    }
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAlertRules, setShowAlertRules] = useState(false);
  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);
  const scopedData = useMemo(() => {
    if (periodScope === "all") {
      return { scopedEvents: events, scopedAttendance: attendance, scopedPerformance: performance, scopedEoRatings: eoRatings };
    }
    const sorted = [...events].sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));
    let scopedEvents = sorted;
    if (periodScope === "30d") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      scopedEvents = sorted.filter(e => new Date(e.eventDate) >= cutoff);
    } else if (periodScope === "last8") {
      scopedEvents = sorted.slice(0, 8);
    }
    const scopedIds = new Set(scopedEvents.map(e => e.eventId));
    const scopedAttendance = attendance.filter(a => scopedIds.has(a.eventId));
    const scopedPerformance = performance.filter(p => scopedIds.has(p.eventId));
    const scopedEoRatings = eoRatings.filter(r => !r.eventId || scopedIds.has(r.eventId));
    return { scopedEvents, scopedAttendance, scopedPerformance, scopedEoRatings };
  }, [periodScope, events, attendance, performance, eoRatings]);
  
  const lb = useMemo(() => {
    const rawLb = computeLeaderboard(
      activeMembers,
      scopedData.scopedEvents,
      scopedData.scopedAttendance,
      scopedData.scopedPerformance,
      scopedData.scopedEoRatings
    );
    
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
  }, [activeMembers, scopedData, lbMode]);

  const maxVal = Math.max(...lb.map(m => 
    lbMode === "Duty" ? m.attendancePct : 
    lbMode === "Support" ? m.supportIndex : 
    lbMode === "Consistency" ? ((m.attendancePct * 0.6) + ((m.totalScore / Math.max(...lb.map(x => x.totalScore), 1)) * 40)) :
    m.totalScore
  ), 1);

  // EO leaderboard
  const eoEvents = scopedData.scopedEvents.filter(e => e.eventType === "Emperium Overrun");
  const eoLb = useMemo(() => activeMembers.map(member => {
    const mId = (member.memberId || "").toLowerCase();
    const memberRatings = scopedData.scopedEoRatings.filter(r => (r.memberId || "").toLowerCase() === mId);
    const eoPresent = eoEvents.filter(ev => {
      const a = scopedData.scopedAttendance.find(att => (att.memberId || "").toLowerCase() === mId && att.eventId === ev.eventId);
      return (a?.status || "present") === "present";
    }).length;
    const totalEoScore = memberRatings.reduce((sum, r) => sum + (r.rating || 0), 0);
    const avgRating = memberRatings.length > 0 ? Math.round((totalEoScore / memberRatings.length) * 10) / 10 : 0;
    return { ...member, totalEoScore, eoPresent, eoTotal: eoEvents.length, avgRating };
  }).sort((a, b) => b.totalEoScore - a.totalEoScore).map((m, i) => ({ ...m, eoRank: i + 1 }))
    , [activeMembers, scopedData, eoEvents]);
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
  const alertChipsFor = (member, currentRank) => {
    const chips = [];
    if ((member.consecutiveAbsent || 0) >= ALERT_RULES.noShowStreak) chips.push({ label: "2x No Show", tone: "badge-atrisk" });
    if ((member.attendancePct || 0) < ALERT_RULES.attendanceRiskPct) chips.push({ label: "Attendance Risk", tone: "badge-atrisk" });
    const mv = movementFor(member.memberId, currentRank).label;
    if (mv.startsWith("↑")) {
      const n = Number(mv.replace("↑", ""));
      if (n >= ALERT_RULES.fastClimberDelta) chips.push({ label: "Fast Climber", tone: "badge-active" });
    } else if (mv.startsWith("↓")) {
      const n = Number(mv.replace("↓", ""));
      if (n >= ALERT_RULES.needsReviewDropDelta) chips.push({ label: "Needs Review", tone: "badge-casual" });
    }
    return chips.slice(0, 2);
  };
  const queueFiltered = useMemo(() => {
    if (queueMode === "all") return lb;
    if (queueMode === "risk") return lb.filter(m => m.attendancePct < 60 || m.classification === "At Risk");
    if (queueMode === "movers") return lb.filter((m, idx) => {
      const key = String(m.memberId || "").toLowerCase();
      const prevRank = Number(previousRankMap?.[key] || 0);
      const currentRank = idx + 1;
      return prevRank > 0 && prevRank !== currentRank;
    });
    if (queueMode === "support") return lb.filter(m => (m.role || "").toLowerCase().includes("support"));
    return lb;
  }, [lb, queueMode, previousRankMap]);
  const filtered = filter === "All" ? queueFiltered : queueFiltered.filter(m => m.classification === filter);
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

  const actionSnapshot = useMemo(() => {
    if (lbMode === "eo") {
      const risky = [...eoLb].sort((a, b) => (a.eoPresent / Math.max(1, a.eoTotal)) - (b.eoPresent / Math.max(1, b.eoTotal))).slice(0, 5);
      const reliable = [...eoLb].sort((a, b) => b.avgRating - a.avgRating || b.eoPresent - a.eoPresent).slice(0, 5);
      return { risky, reliable };
    }
    const risky = [...lb].sort((a, b) => a.attendancePct - b.attendancePct || a.totalScore - b.totalScore).slice(0, 5);
    const reliable = [...lb].sort((a, b) => b.attendancePct - a.attendancePct || b.totalScore - a.totalScore).slice(0, 5);
    return { risky, reliable };
  }, [lbMode, lb, eoLb]);


  useEffect(() => { localStorage.setItem("leaderboard_filter", filter); }, [filter]);
  useEffect(() => { localStorage.setItem("leaderboard_mode", lbMode); }, [lbMode]);
  useEffect(() => { localStorage.setItem("leaderboard_scope_v1", periodScope); }, [periodScope]);
  useEffect(() => { localStorage.setItem("leaderboard_queue_v1", queueMode); }, [queueMode]);
  useEffect(() => {
    localStorage.setItem(LEADERBOARD_TABLE_UI_KEY + "_compact", tableCompact ? "1" : "0");
  }, [tableCompact]);
  useEffect(() => {
    localStorage.setItem(LEADERBOARD_TABLE_UI_KEY + "_details", showDetailCols ? "1" : "0");
  }, [showDetailCols]);

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

  const postWeeklyDigest = async () => {
    setPostingDigest(true);
    try {
      const sortedEvents = [...events].sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));
      if (sortedEvents.length === 0) {
        showToast("No events available for digest.", "error");
        setPostingDigest(false);
        return;
      }
      
      const latestGlobalEvent = sortedEvents[0];
      const latestDate = new Date(latestGlobalEvent.eventDate);
      
      const day = latestDate.getDay();
      const diff = latestDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(latestDate);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weeklyEvents = events.filter(e => {
        const d = new Date(e.eventDate);
        return d >= monday && d <= sunday;
      });
      const previousGlobalEvents = events.filter(e => new Date(e.eventDate) < monday);

      const weeklyIds = new Set(weeklyEvents.map(e => e.eventId));
      const weeklyAtt = attendance.filter(a => weeklyIds.has(a.eventId));
      const weeklyPerf = performance.filter(p => weeklyIds.has(p.eventId));
      const weeklyEo = eoRatings.filter(r => !r.eventId || weeklyIds.has(r.eventId));

      const rawLb = computeLeaderboard(
        activeMembers,
        weeklyEvents,
        weeklyAtt,
        weeklyPerf,
        weeklyEo
      );

      const topCombat = [...rawLb].sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);
      const topSupport = [...rawLb].filter(m => {
        const role = (m.role || "").toLowerCase();
        return role.includes("support") || role.includes("utility");
      }).sort((a, b) => b.supportIndex - a.supportIndex).slice(0, 10);
      const topAttendance = [...rawLb].sort((a, b) => b.attendancePct - a.attendancePct || b.totalScore - a.totalScore).slice(0, 10);

      const glWeeklyEvents = weeklyEvents.filter(e => e.eventType === "Guild League");
      const previousGLEvents = previousGlobalEvents.filter(e => e.eventType === "Guild League");
      
      let movers = [];
      if (glWeeklyEvents.length > 0 && previousGLEvents.length > 0) {
        const latestWeekGL = [...glWeeklyEvents].sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate))[0];
        const topCombatIds = new Set(topCombat.map(c => (c.memberId || "").toLowerCase()));
        const topSupportIds = new Set(topSupport.map(s => (s.memberId || "").toLowerCase()));

        movers = activeMembers.map(m => {
          const mId = (m.memberId || "").toLowerCase();
          
          let histScoreAgg = 0;
          let histCount = 0;
          previousGLEvents.forEach(ev => {
             const att = attendance.find(a => a.eventId === ev.eventId && (a.memberId || "").toLowerCase() === mId);
             const perf = performance.find(p => p.eventId === ev.eventId && (p.memberId || "").toLowerCase() === mId);
             if (att?.status === "present") {
                histScoreAgg += computeScore({ event: ev, att, perf });
                histCount++;
             }
          });
          const histAvg = histCount > 0 ? histScoreAgg / histCount : 0;
          
          const latestAtt = weeklyAtt.find(a => a.eventId === latestWeekGL.eventId && (a.memberId || "").toLowerCase() === mId);
          const latestPerf = weeklyPerf.find(p => p.eventId === latestWeekGL.eventId && (p.memberId || "").toLowerCase() === mId);
          const latestScore = latestAtt?.status === "present" ? computeScore({ event: latestWeekGL, att: latestAtt, perf: latestPerf }) : 0;
          
          const delta = latestScore - histAvg;
          return { ...m, delta: Math.round(delta), latestScore, histAvg };
        }).filter(m => {
           const idUrl = String(m.memberId || "").toLowerCase();
           return m.delta >= 5 && m.latestScore > 0 && !topCombatIds.has(idUrl) && !topSupportIds.has(idUrl) && m.histAvg < 75;
        }).sort((a, b) => b.delta - a.delta).slice(0, 10);
      }

      const formatRow = (list, valFn) => {
        if (list.length === 0) return "_No data available_";
        return list.map((m, i) => `**Rank ${i + 1}** — ${m.ign}\n╰ ${valFn(m)}`).join("\n\n");
      };

      const pingOverride = discordConfig?.oblivionRoleId ? `<@&${discordConfig.oblivionRoleId}>` : "@everyone";
      const monStr = monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const sunStr = sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      await sendDiscordEmbed(
        `🏆  __**OBLIVION WEEKLY GUILD HONORS**__  🏆`,
        `Celebrating the extraordinary dedication and progress of our Vanguards!\n\u200B`,
        0xF0C040,
        [
          { name: "⚔️  TOP 10 COMBAT (Overall)", value: formatRow(topCombat, m => `**${m.totalScore} pts** (${m.totalKills || 0} kills | ${m.totalPP || 0} pp)`), inline: false },
          { name: "\u200B", value: "\u200B", inline: false },
          { name: "✨  TOP 10 SUPPORT / UTILITY", value: formatRow(topSupport, m => `**${m.supportIndex} SPI** (${m.totalAssists || 0} ast | ${m.totalPP || 0} pp)`), inline: false },
          { name: "\u200B", value: "\u200B", inline: false },
          { name: "🛡️  TOP 10 ATTENDANCE", value: formatRow(topAttendance, m => `**${m.attendancePct}%** Attendance Rate`), inline: false },
          { name: "\u200B", value: "\u200B", inline: false },
          { name: "🚀  MOST IMPROVED MEMBERS", value: movers.length > 0 ? formatRow(movers, m => `**+${m.delta} pts** above personal average`) : "_No significant rank movement detected._", inline: false },
          { name: "\u200B", value: "\u200B", inline: false },
          { name: "📅  DETAILS", value: `**Weekly Range:** ${monStr} – ${sunStr}\n**Events Evaluated:** ${weeklyEvents.length}`, inline: false }
        ],
        "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png",
        "leaderboard",
        "weekly_digest",
        { scope: "Weekly" },
        null,
        pingOverride
      );
      showToast("Unified Discord Digest Posted successfully!", "success");
    } catch (err) {
      console.error("Digest Error:", err);
      showToast("Failed to post discord digest", "error");
    } finally {
      setPostingDigest(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title" style={{ marginBottom: 0 }}>🏆 Leaderboard</h1>
              {isOfficer && (
                <button
                  className="btn btn-sm"
                  style={{ background: "rgba(99,130,230,0.15)", color: "var(--accent)", border: "1px solid rgba(99,130,230,0.3)" }}
                  onClick={postWeeklyDigest}
                  disabled={postingDigest}
                >
                  <Icon name="brand-discord" size={14} /> {postingDigest ? "Posting..." : "Post Digest"}
                </button>
              )}
            </div>
            <p className="page-subtitle" style={{ marginTop: 4 }}>Rankings based on scoring formula — auto-computed</p>
          </div>
          <div className="hybrid-mobile-show">
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
            <div className="flex gap-2 quick-summary-bar" style={{ margin: "8px 0 0", padding: "4px 0", overflowX: "auto", flexWrap: "nowrap" }}>
              {[
                { id: "all", label: "All-time" },
                { id: "30d", label: "Last 30d" },
                { id: "last8", label: "Last 8 events" }
              ].map(s => (
                <button
                  key={s.id}
                  className={`btn btn-sm ${periodScope === s.id ? "btn-primary" : "btn-ghost"}`}
                  style={{ flex: "0 0 auto" }}
                  onClick={() => setPeriodScope(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hybrid-mobile-hide">
            <div className="flex gap-2" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
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
              {[
                { id: "all", label: "All-time" },
                { id: "30d", label: "Last 30d" },
                { id: "last8", label: "Last 8 events" }
              ].map(s => (
                <button
                  key={s.id}
                  className={`btn btn-sm ${periodScope === s.id ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setPeriodScope(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap", alignItems: "center" }}>
        <button className={`btn btn-sm ${tableCompact ? "btn-primary" : "btn-ghost"}`} onClick={() => setTableCompact(v => !v)}>
          <Icon name="grid" size={12} /> {tableCompact ? "Compact Rows: On" : "Compact Rows: Off"}
        </button>
        <button className={`btn btn-sm ${showDetailCols ? "btn-primary" : "btn-ghost"}`} onClick={() => setShowDetailCols(v => !v)}>
          <Icon name="list" size={12} /> {showDetailCols ? "Detail Columns: On" : "Detail Columns: Off"}
        </button>
        <button className={`btn btn-sm ${showAdvanced ? "btn-primary" : "btn-ghost"}`} onClick={() => setShowAdvanced(v => !v)}>
          <Icon name="search" size={12} /> {showAdvanced ? "Advanced Insights: On" : "Advanced Insights: Off"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAlertRules(v => !v)}>
          <Icon name="info" size={12} /> How Scoring is Calculated
        </button>
        <div className="badge badge-casual" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "4px 10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 0.4 }}>MOVEMENT</span>
          <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>↑ Up</span>
          <span style={{ fontSize: 11, color: "var(--red)", fontWeight: 700 }}>↓ Down</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>— Same</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>NEW First seen</span>
        </div>
      </div>
      {showAlertRules && (
        <div className="card" style={{ marginBottom: 12, border: "1px solid rgba(99,130,230,0.35)", background: "rgba(99,130,230,0.08)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>How Scoring is Calculated</div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowAlertRules(false)} title="Close rules">
              <Icon name="x" size={12} />
            </button>
          </div>
          <div className="text-xs text-muted" style={{ display: "grid", gap: 6 }}>
            <div>• <strong>Combat Score</strong>: Sum of CTF points + Performance points + Kills + Assists per Guild League event.</div>
            <div>• <strong>Support Index (SPI)</strong>: Calculated using <span style={{color:"var(--accent)"}}>(Attendance % × 0.5) + (Total Assists × 5) + (Avg EO Rating × 10)</span>.</div>
            <div>• <strong>Stability / Consistency</strong>: <span style={{color:"var(--gold)"}}>(Attendance % × 0.6) + (Relative Score % × 0.4)</span>. Reward for always being there and performing well.</div>
            <div>• <strong>Duty</strong>: Ranked purely on % of events attended.</div>
            <div>• <strong>Movement Tracking</strong>: Compares current rank with a saved local snapshot to detect drops or climbs.</div>
          </div>
        </div>
      )}
      <div className="sticky-actions">
        <div className="summary-bar-container">
          {/* Mode indicator — accented card */}
          <div className="summary-item" style={{
            borderColor: "var(--accent)",
            background: "rgba(99,130,230,0.08)",
            border: "1px solid rgba(99,130,230,0.25)",
            minWidth: 90,
            flex: "0 0 auto"
          }}>
            <span className="summary-label">⚡ MODE</span>
            <span className="summary-value" style={{ color: "var(--accent)", fontSize: 12 }}>
              {lbMode === "eo" ? "EO" : lbMode}
            </span>
          </div>

          {/* Dynamic overview cards with icons */}
          {overviewCards.map(card => {
            const iconMap = {
              "Top DPS": "⚔️",
              "Top Support": "✨",
              "Best Attendance": "🛡️",
              "EO Top": "🏰",
              "Best Avg Rating": "⭐",
              "Most EO Attendance": "✅",
            };
            const icon = iconMap[card.label] || "🏆";
            return (
              <div key={card.label} className="summary-item" style={{ borderColor: card.tone, minWidth: 110 }}>
                <span className="summary-label">{icon} {card.label}</span>
                <span className="summary-value" style={{ color: card.tone, fontSize: 12 }} title={card.value}>{card.value}</span>
              </div>
            );
          })}

          {/* Period */}
          <div className="summary-item" style={{ flex: "0 0 auto", minWidth: 90 }}>
            <span className="summary-label">🕐 PERIOD</span>
            <span className="summary-value" style={{ fontSize: 11 }}>
              {periodScope === "all" ? "All-time" : periodScope === "30d" ? "30 days" : "Last 8"}
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap", alignItems: "center" }}>
        <span className="text-xs text-muted" style={{ letterSpacing: 1 }}>Action Queue:</span>
        {[
          { id: "all", label: "All" },
          { id: "risk", label: "Needs Follow-up" },
          { id: "movers", label: "Top Movers" },
          { id: "support", label: "Support Priority" }
        ].map(q => (
          <button key={q.id} className={`btn btn-sm ${queueMode === q.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setQueueMode(q.id)}>
            {q.label}
          </button>
        ))}
      </div>

      <div className="grid-2 gap-4 mb-4">
        <div className="card">
          <div className="card-title">🚨 At-Risk Members</div>
          <div className="text-xs text-muted" style={{ marginBottom: 10 }}>Needs officer follow-up soon</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {actionSnapshot.risky.map((m, idx) => (
              <div key={m.memberId} className="flex items-center justify-between" style={{ gap: 10 }}>
                <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px", fontSize: 12 }} onClick={() => onViewProfile && onViewProfile(m)}>
                  {idx + 1}. {m.ign}
                </button>
                <span className="badge badge-atrisk" style={{ fontSize: 10 }}>
                  {lbMode === "eo" ? `${m.eoPresent}/${m.eoTotal} EO` : `${m.attendancePct}% att`}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title">✅ Top Reliable</div>
          <div className="text-xs text-muted" style={{ marginBottom: 10 }}>Most consistent contributors</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {actionSnapshot.reliable.map((m, idx) => (
              <div key={m.memberId} className="flex items-center justify-between" style={{ gap: 10 }}>
                <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px", fontSize: 12 }} onClick={() => onViewProfile && onViewProfile(m)}>
                  {idx + 1}. {m.ign}
                </button>
                <span className="badge badge-active" style={{ fontSize: 10 }}>
                  {lbMode === "eo" ? `${m.avgRating}★ avg` : `${m.attendancePct}% att`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAdvanced && <>
      {/* Top 3 podium - DYNAMIC for all modes */}
      <div className="podium-container">
        {[podiumData[1], podiumData[0], podiumData[2]].map((m, idx) => {
          if (!m) return <div key={idx} className="podium-rank-placeholder" />;
          const realRankMap = [2, 1, 3];
          const realRank = realRankMap[idx];
          const rankIdx = realRank - 1;
          
          const podiumH = [160, 120, 95];
          const medals = ["🥇", "🥈", "🥉"];
          const labels = ["#1", "#2", "#3"];
          
          return (
            <div key={m.memberId} className={`podium-rank rank-${realRank}`}>
              <div className="podium-medal animate-float">{medals[rankIdx]}</div>
              <MemberAvatar ign={m.ign} index={rankIdx} size={realRank === 1 ? (isMobile ? 60 : 70) : (isMobile ? 46 : 54)} />
              <div className="podium-name" onClick={() => onViewProfile && onViewProfile(m)}>{m.ign}</div>
              <div className="podium-subtitle">{m.class}</div>
              <div className="podium-stats">
                <div className="podium-value" style={{ color: rankColors[rankIdx], textShadow: `0 0 12px ${rankColors[rankIdx]}66` }}>
                  {getPodiumValue(m)}
                </div>
                <div className="podium-subval">{getPodiumSubtitle(m)}</div>
              </div>
              <div className="podium-pillar" style={{
                height: isMobile ? (podiumH[rankIdx] * 0.7) : podiumH[rankIdx],
                background: `${rankColors[rankIdx]}22`,
                borderColor: rankColors[rankIdx],
                boxShadow: `inset 0 0 30px ${rankColors[rankIdx]}22, 0 0 20px ${rankColors[rankIdx]}33`,
              }}>
                <div className="podium-pillar-overlay" style={{ background: `linear-gradient(to top, ${rankColors[rankIdx]}44, transparent)` }} />
                <span className="podium-label" style={{ color: rankColors[rankIdx], textShadow: `0 0 20px ${rankColors[rankIdx]}` }}>{labels[rankIdx]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hall of Fame Highlights - Hide on EO Mode */}
      {lbMode !== "eo" && <div className="grid-4 gap-4 mb-6">
        {[
          { label: "Top Striker", member: lb.sort((a,b) => b.totalKills - a.totalKills || b.totalScore - a.totalScore)[0], icon: "🔥", color: "var(--red)" },
          { label: "Reliable Wall", member: lb.sort((a,b) => b.attendancePct - a.attendancePct)[0], icon: "🛡️", color: "var(--green)" },
          { label: "Elite Support", member: lb.filter(m => (m.role || "").toLowerCase().includes("support")).sort((a,b) => b.totalAssists - a.totalAssists || b.avgEoRating - a.avgEoRating)[0], icon: "✨", color: "var(--accent)" },
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
      </>}

      {/* Main Leaderboard Table */}
      {lbMode !== "eo" ? (
        <div className="card animate-fade-in" style={{ marginBottom: 16 }}>
          <div className="hybrid-mobile-show quick-summary-bar">
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
          <div className={`table-wrap table-sticky-head ${tableCompact ? "table-compact" : ""} hybrid-mobile-hide`}>
            <table>
              <thead><tr>
                <th>#</th><th>Player</th><th>Role</th>
                <th>K/A</th>
                <th>{lbMode === "Combat" ? "Total Score" : lbMode === "Duty" ? "Attendance" : lbMode === "Support" ? "SPI Score" : "Stability"}</th>
                <th>Movement</th>
                <th>Attendance</th>
                <th>Alerts</th>
                {showDetailCols && <th>Intensity</th>}
                {showDetailCols && <th>Metrics</th>}
                {showDetailCols && <th>Classification</th>}
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
                      <div className="text-xs text-muted" style={{ fontWeight: 700 }}>
                        <span style={{color: "var(--red)"}}>{m.totalKills || 0}</span> <span style={{color: "var(--border)", margin: "0 2px"}}>/</span> <span style={{color: "var(--gold)"}}>{m.totalAssists || 0}</span>
                      </div>
                    </td>
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
                    <td>
                      <span className={`badge ${m.attStatus?.badge || "badge-casual"}`} style={{ fontSize: 10 }}>
                        {m.attendancePct}% ({m.attStatus?.label || "Average"})
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1" style={{ flexWrap: "wrap" }}>
                        {alertChipsFor(m, i + 1).length ? alertChipsFor(m, i + 1).map(ch => (
                          <span key={ch.label} className={`badge ${ch.tone}`} style={{ fontSize: 9 }}>{ch.label}</span>
                        )) : <span className="text-xs text-muted">—</span>}
                      </div>
                    </td>
                    {showDetailCols && <td style={{ minWidth: 140 }}>
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
                    </td>}
                    {showDetailCols && <td>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        <div>Score: {m.totalScore}</div>
                        <div>Att: {m.attendancePct}%</div>
                      </div>
                    </td>}
                    {showDetailCols && <td>
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
          <div className="hybrid-mobile-show">
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
                     {alertChipsFor(m, i + 1).map(ch => (
                       <span key={ch.label} className={`badge ${ch.tone}`} style={{ fontSize: 9 }}>{ch.label}</span>
                     ))}
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
            <div className="table-wrap hybrid-mobile-hide">
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
             <div className="hybrid-mobile-show">
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
      {showAdvanced && <div className="card mt-4" style={{ marginBottom: 24 }}>
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
      </div>}
    </div>
  );
}

export default LeaderboardPage;
