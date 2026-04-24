import React, { useState, useMemo, useEffect } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { computeLeaderboard } from '../utils/scoring';
import { MemberAvatar } from '../components/common/MemberAvatar';

function ReportsPage({ onViewProfile }) {
  const { 
    members, events, attendance, performance, eoRatings, 
    isOfficer, showToast, sendDiscordEmbed, discordConfig,
    historicalEvents, historicalAttendance, historicalPerformance, isLoadingHistory, fetchHistoricalData
  } = useGuild();

  useEffect(() => {
    fetchHistoricalData();
  }, [fetchHistoricalData]);

  // Combine live data with historical data
  const allEvents = useMemo(() => [...events, ...historicalEvents], [events, historicalEvents]);
  const allAttendance = useMemo(() => [...attendance, ...historicalAttendance], [attendance, historicalAttendance]);
  const allPerformance = useMemo(() => [...performance, ...historicalPerformance], [performance, historicalPerformance]);

  const [reportType, setReportType] = useState('weekly'); // weekly, monthly, yearly
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [posting, setPosting] = useState(false);
  const [showFormula, setShowFormula] = useState(false);

  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);

  // Helper to get date range for reports
  const reportRange = useMemo(() => {
    const d = new Date(selectedDate);
    if (reportType === 'weekly') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { start: monday, end: sunday, label: `${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}` };
    } else if (reportType === 'monthly') {
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: first, end: last, label: d.toLocaleString('default', { month: 'long', year: 'numeric' }) };
    } else {
      const first = new Date(d.getFullYear(), 0, 1);
      const last = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start: first, end: last, label: d.getFullYear().toString() };
    }
  }, [selectedDate, reportType]);

  const reportData = useMemo(() => {
    const filteredEvents = allEvents.filter(e => {
      const ed = new Date(e.eventDate);
      return ed >= reportRange.start && ed <= reportRange.end;
    });

    if (filteredEvents.length === 0) return null;

    const eventIds = new Set(filteredEvents.map(e => e.eventId));
    const filteredAtt = allAttendance.filter(a => eventIds.has(a.eventId));
    const filteredPerf = allPerformance.filter(p => eventIds.has(p.eventId));
    const filteredEo = eoRatings.filter(r => !r.eventId || eventIds.has(r.eventId));

    const lb = computeLeaderboard(activeMembers, filteredEvents, filteredAtt, filteredPerf, filteredEo);

    const topDPS = [...lb].filter(m => (m.role || "").toUpperCase() === "DPS")
      .sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);
    
    const topSupport = [...lb].filter(m => {
      const r = (m.role || "").toUpperCase();
      return r.includes("SUPPORT") || r.includes("UTILITY");
    }).sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);

    const topAttendance = [...lb].sort((a, b) => b.attendancePct - a.attendancePct || b.totalScore - a.totalScore).slice(0, 10);

    return { lb, topDPS, topSupport, topAttendance, eventCount: filteredEvents.length };
  }, [activeMembers, allEvents, allAttendance, allPerformance, eoRatings, reportRange]);

  const postToDiscord = async () => {
    if (!reportData) return;
    setPosting(true);
    try {
      const formatRow = (list, valFn) => {
        if (list.length === 0) return "_No data available_";
        return list.map((m, i) => `**#${i + 1}** — ${m.ign}\n╰ ${valFn(m)}`).join("\n\n");
      };

      const pingOverride = discordConfig?.oblivionRoleId ? `<@&${discordConfig.oblivionRoleId}>` : "@everyone";
      const typeLabel = reportType.charAt(0).toUpperCase() + reportType.slice(1);
      
      const fields = [
        { name: "⚔️  TOP 10 DPS", value: formatRow(reportData.topDPS, m => `**${m.totalScore} pts** (${m.totalKills || 0} kills)`), inline: true },
        { name: "✨  TOP 10 SUPPORT", value: formatRow(reportData.topSupport, m => `**${m.totalScore} pts** (${m.totalAssists || 0} assists)`), inline: true },
        { name: "\u200B", value: "\u200B", inline: false },
        { name: "🛡️  TOP 10 ATTENDANCE", value: formatRow(reportData.topAttendance, m => `**${m.attendancePct}%** Rate (${m.totalScore} pts)`), inline: false },
        { name: "📅  DETAILS", value: `**Period:** ${reportRange.label}\n**Events:** ${reportData.eventCount}`, inline: false }
      ];

      await sendDiscordEmbed(
        `🏆  __**OBLIVION ${typeLabel.toUpperCase()} GUILD HONORS**__  🏆`,
        `Recognizing our top warriors for this period!\n\u200B`,
        reportType === 'weekly' ? 0xF0C040 : reportType === 'monthly' ? 0x6382E6 : 0xE05050,
        fields,
        "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png",
        "reports",
        `${reportType}_report`,
        { scope: typeLabel, range: reportRange.label },
        null,
        pingOverride
      );
      showToast(`${typeLabel} Report posted to Discord!`, "success");
    } catch (err) {
      console.error("Discord Error:", err);
      showToast("Failed to post report", "error");
    } finally {
      setPosting(false);
    }
  };

  const renderRankList = (list, title, icon, color) => (
    <div className="card" style={{ border: `1px solid ${color}33`, background: `linear-gradient(180deg, ${color}08 0%, var(--bg-card) 100%)` }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="card-title" style={{ color, marginBottom: 0 }}>{icon} {title}</h3>
        <span className="badge" style={{ background: `${color}20`, color, fontSize: 10 }}>TOP 10</span>
      </div>
      <div className="flex flex-col gap-2">
        {list.map((m, i) => (
          <div key={m.memberId} className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors" 
               onClick={() => onViewProfile && onViewProfile(m)} style={{ cursor: "pointer" }}>
            <div className="flex items-center gap-3">
              <div style={{ width: 24, textAlign: 'center', fontWeight: 800, color: i < 3 ? color : 'var(--text-muted)' }}>#{i + 1}</div>
              <MemberAvatar ign={m.ign} index={i} size={30} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{m.ign}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.class}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, color }}>{title === 'Attendance' ? `${m.attendancePct}%` : m.totalScore}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{title === 'DPS' ? `${m.totalKills} kills` : title === 'Support' ? `${m.totalAssists} assists` : `${m.totalScore} pts`}</div>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-center text-muted p-8 italic">No data found for this category.</div>}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Guild Reports</h1>
          <p className="page-subtitle">Generate and post performance milestones to Discord</p>
        </div>
      </div>

      {/* ── Archive Loading Indicator ── */}
      {isLoadingHistory && (
        <div className="card mb-6 flex items-center justify-center p-4 gap-3 animate-pulse" style={{ border: "1px solid rgba(99,130,230,0.2)", background: "rgba(99,130,230,0.05)" }}>
           <div className="animate-spin text-accent">
             <Icon name="refresh" size={16} />
           </div>
           <span className="text-sm font-medium text-accent">Fetching historical data from archive...</span>
        </div>
      )}

      {/* ── Period & Date Controls ── */}
      <div className="card mb-6" style={{
        background: "linear-gradient(135deg, rgba(99,130,230,0.06) 0%, rgba(10,15,25,0.8) 100%)",
        border: "1px solid rgba(99,130,230,0.2)",
        backdropFilter: "blur(12px)"
      }}>
        {/* Period Type Selector */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
            Report Period
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { id: "weekly", label: "Weekly", icon: "📅", desc: "Mon – Sun" },
              { id: "monthly", label: "Monthly", icon: "🗓️", desc: "Full Month" },
              { id: "yearly", label: "Yearly", icon: "🏆", desc: "Full Year" },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setReportType(t.id)}
                style={{
                  flex: "1 1 120px",
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: reportType === t.id
                    ? "1px solid var(--accent)"
                    : "1px solid rgba(255,255,255,0.08)",
                  background: reportType === t.id
                    ? "rgba(99,130,230,0.18)"
                    : "rgba(255,255,255,0.03)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  textAlign: "left",
                  boxShadow: reportType === t.id ? "0 0 16px rgba(99,130,230,0.2)" : "none"
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                <div style={{ fontFamily: "Cinzel,serif", fontWeight: 700, fontSize: 12, color: reportType === t.id ? "var(--accent)" : "var(--text-primary)" }}>{t.label}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Date Input + Active Range */}
        <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
          {/* Date Picker */}
          <div style={{ flex: "0 0 auto" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
              {reportType === "weekly" ? "Pick Any Day in the Week" : reportType === "monthly" ? "Select Month" : "Select Year"}
            </div>
            <div style={{ position: "relative", display: "inline-block" }}>
              <input
                type={reportType === "yearly" ? "number" : reportType === "monthly" ? "month" : "date"}
                value={reportType === "yearly" ? new Date(selectedDate).getFullYear() : selectedDate.slice(0, reportType === "monthly" ? 7 : 10)}
                onChange={(e) => {
                  let val = e.target.value;
                  if (reportType === "yearly") val = `${val}-01-01`;
                  else if (reportType === "monthly") val = `${val}-01`;
                  setSelectedDate(new Date(val).toISOString().split("T")[0]);
                }}
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(99,130,230,0.3)",
                  borderRadius: 10,
                  color: "var(--text-primary)",
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  outline: "none",
                  width: reportType === "yearly" ? 120 : 180,
                  colorScheme: "dark"
                }}
              />
            </div>
          </div>

          {/* Active Range Display */}
          <div style={{
            flex: 1,
            minWidth: 200,
            padding: "14px 18px",
            borderRadius: 12,
            background: "linear-gradient(135deg, rgba(99,130,230,0.1), rgba(0,0,0,0.3))",
            border: "1px solid rgba(99,130,230,0.25)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center"
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              📆 Active Report Range
            </div>
            <div style={{ fontFamily: "Cinzel,serif", fontWeight: 800, fontSize: 15, color: "var(--accent)", lineHeight: 1.3 }}>
              {reportRange.label}
            </div>
            {reportData && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
                {reportData.eventCount} event{reportData.eventCount !== 1 ? "s" : ""} found · {reportData.lb.length} active members
              </div>
            )}
            {!reportData && (
              <div style={{ fontSize: 10, color: "var(--red)", marginTop: 6 }}>
                No events recorded for this period
              </div>
            )}
          </div>

          {/* Discord Button */}
          {isOfficer && (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                className="btn btn-primary"
                onClick={postToDiscord}
                disabled={posting || !reportData}
                style={{
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 700,
                  gap: 8,
                  opacity: (!reportData || posting) ? 0.5 : 1,
                  boxShadow: reportData ? "0 0 20px rgba(99,130,230,0.3)" : "none",
                  transition: "all 0.2s ease"
                }}
              >
                <Icon name="brand-discord" size={16} />
                {posting ? "Posting..." : "Post to Discord"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Scoring Formula Guide ── */}
      <div className="card mb-6" style={{ border: "1px solid rgba(99,130,230,0.25)", background: "rgba(99,130,230,0.04)" }}>
        <button
          className="flex items-center justify-between w-full"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onClick={() => setShowFormula(v => !v)}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 16 }}>📐</span>
            <span style={{ fontFamily: "Cinzel,serif", fontSize: 13, fontWeight: 700, color: "var(--accent)", letterSpacing: 1 }}>
              SCORING FORMULA GUIDE
            </span>
            <span className="badge badge-casual" style={{ fontSize: 9 }}>Officer Reference</span>
          </div>
          <span style={{ color: "var(--text-muted)", fontSize: 12, transition: "transform 0.2s", display: "inline-block", transform: showFormula ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
        </button>

        {showFormula && (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 20 }}>

            {/* DPS */}
            <div style={{ padding: "16px", borderRadius: 10, background: "rgba(224,80,80,0.07)", border: "1px solid rgba(224,80,80,0.2)" }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "var(--red)", marginBottom: 10 }}>⚔️ DPS EVENT SCORE</div>
              <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text-primary)", background: "rgba(0,0,0,0.3)", padding: "10px 14px", borderRadius: 8, marginBottom: 12, letterSpacing: 0.5 }}>
                CTF Total + Kills + Assists + Performance Points = Event Score
              </div>
              <div style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                <div><span style={{ color: "var(--red)", fontWeight: 700 }}>CTF Total</span> — Sum of 3 CTF round captures (CTF1 + CTF2 + CTF3) logged per Guild League event.</div>
                <div><span style={{ color: "var(--red)", fontWeight: 700 }}>Kills</span> — Total kill count logged in the event's battle log.</div>
                <div><span style={{ color: "var(--gold)", fontWeight: 700 }}>Assists</span> — Total assist count. Also tracked separately for Support recognition.</div>
                <div><span style={{ color: "var(--accent)", fontWeight: 700 }}>Performance Points (PP)</span> — Officer-awarded bonus points for notable plays, clutch moments, or extra effort.</div>
                <div style={{ marginTop: 4, padding: "6px 10px", borderRadius: 6, background: "rgba(224,80,80,0.1)", fontSize: 11, color: "var(--text-muted)" }}>
                  ⚠ Emperium Overrun events are <strong>not scored</strong> — they are attendance-only.
                </div>
              </div>
            </div>

            {/* Support */}
            <div style={{ padding: "16px", borderRadius: 10, background: "rgba(240,192,64,0.07)", border: "1px solid rgba(240,192,64,0.2)" }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "var(--gold)", marginBottom: 10 }}>✨ SUPPORT EVENT SCORE</div>
              <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text-primary)", background: "rgba(0,0,0,0.3)", padding: "10px 14px", borderRadius: 8, marginBottom: 12, letterSpacing: 0.5 }}>
                CTF Total + Kills + Assists + Performance Points = Event Score
              </div>
              <div style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                <div>Support uses the <strong>same universal formula</strong> as DPS. However, the Top 10 Support list is <span style={{ color: "var(--gold)", fontWeight: 700 }}>filtered by role</span> — only members tagged as <code>Support</code> or <code>Utility</code> appear here.</div>
                <div><span style={{ color: "var(--gold)", fontWeight: 700 }}>Assists</span> — The key differentiator. Support players are expected to have higher assist counts. Their assists are shown separately in the list sub-label so officers can recognize pure team play.</div>
                <div style={{ marginTop: 4, padding: "6px 10px", borderRadius: 6, background: "rgba(240,192,64,0.1)", fontSize: 11, color: "var(--text-muted)" }}>
                  💡 Tip: If a Support member has a low score but very high assists, consider giving them a Manual Performance Points bonus via the Events page.
                </div>
              </div>
            </div>

            {/* Attendance */}
            <div style={{ padding: "16px", borderRadius: 10, background: "rgba(64,201,122,0.07)", border: "1px solid rgba(64,201,122,0.2)" }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "var(--green)", marginBottom: 10 }}>🛡️ ATTENDANCE RATE</div>
              <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text-primary)", background: "rgba(0,0,0,0.3)", padding: "10px 14px", borderRadius: 8, marginBottom: 12, letterSpacing: 0.5 }}>
                (Events Present ÷ Total Eligible Events) × 100 = Attendance %
              </div>
              <div style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                <div><span style={{ color: "var(--green)", fontWeight: 700 }}>Events Present</span> — Events where the member's status is marked <code>Present</code>.</div>
                <div><span style={{ color: "var(--green)", fontWeight: 700 }}>Total Eligible Events</span> — All events within the selected period that occurred <strong>on or after</strong> the member's join date. Events before joining are excluded.</div>
                <div><span style={{ color: "var(--text-muted)", fontWeight: 700 }}>Tiebreaker</span> — When two members have the same attendance %, the one with the higher Total Score ranks higher.</div>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { label: "✅ Reliable", range: "80% and above", color: "var(--green)", bg: "rgba(64,201,122,0.1)" },
                  { label: "⚠ Average", range: "60% – 79%", color: "var(--gold)", bg: "rgba(240,192,64,0.1)" },
                  { label: "🚨 At Risk", range: "Below 60%", color: "var(--red)", bg: "rgba(224,80,80,0.1)" },
                ].map(t => (
                  <div key={t.label} style={{ padding: "6px 12px", borderRadius: 8, background: t.bg, border: `1px solid ${t.color}44`, fontSize: 11 }}>
                    <span style={{ fontWeight: 700, color: t.color }}>{t.label}</span>
                    <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>{t.range}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {reportData ? (
        <div className="grid-3 gap-6">
          {renderRankList(reportData.topDPS, "DPS", "⚔️", "var(--red)")}
          {renderRankList(reportData.topSupport, "Support", "✨", "var(--gold)")}
          {renderRankList(reportData.topAttendance, "Attendance", "🛡️", "var(--green)")}
        </div>
      ) : (
        <div className="card p-20 text-center">
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <h2 className="font-cinzel text-xl mb-2">No Events Found</h2>
          <p className="text-muted">There are no events recorded for this {reportType} range.</p>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;
