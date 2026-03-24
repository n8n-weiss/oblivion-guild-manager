import React, { useState, useMemo } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';

function WeeklyReportPage() {
  const { members, events, attendance, performance, eoRatings } = useGuild();
  const [copied, setCopied] = useState(false);
  const [weekFilter, setWeekFilter] = useState("all"); // "all" | "thisweek" | "lastweek"

  // Filter events based on week
  const filteredEvents = useMemo(() => {
    if (weekFilter === "all") return events;
    const now = new Date();
    const startOfWeek = (offset = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() - offset);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const endOfWeek = (offset = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + (6 - d.getDay()) - offset);
      d.setHours(23, 59, 59, 999);
      return d;
    };
    if (weekFilter === "thisweek") {
      const start = startOfWeek(0);
      const end = endOfWeek(0);
      return events.filter(ev => { const d = new Date(ev.eventDate); return d >= start && d <= end; });
    }
    if (weekFilter === "lastweek") {
      const start = startOfWeek(7);
      const end = endOfWeek(7);
      return events.filter(ev => { const d = new Date(ev.eventDate); return d >= start && d <= end; });
    }
    return events;
  }, [events, weekFilter]);

  const glEvents = filteredEvents.filter(e => e.eventType === "Guild League");
  const eoEvents = filteredEvents.filter(e => e.eventType === "Emperium Overrun");

  // Compute stats
  const totalSlots = filteredEvents.length * members.length;
  const presentSlots = attendance.filter(a => filteredEvents.find(ev => ev.eventId === a.eventId) && a.status === "present").length;
  const attRate = totalSlots > 0 ? Math.round((presentSlots / totalSlots) * 100) : 0;

  // Total absences this period
  const totalAbsences = totalSlots - presentSlots;

  // Member scores for the period
  const memberStats = members.map(member => {
    let score = 0;
    let presentCount = 0;
    let absentCount = 0;
    let consecutiveAbsent = 0;
    let tempConsec = 0;

    filteredEvents.forEach(event => {
      const att = attendance.find(a => a.memberId === member.memberId && a.eventId === event.eventId);
      const perf = performance.find(p => p.memberId === member.memberId && p.eventId === event.eventId);
      if (att?.status === "present") {
        presentCount++;
        tempConsec = 0;
        if (event.eventType === "Guild League") {
          score += (perf?.ctfPoints || 0) + (perf?.performancePoints || 0);
        }
      } else if (att) {
        absentCount++;
        tempConsec++;
        if (tempConsec > consecutiveAbsent) consecutiveAbsent = tempConsec;
      }
    });

    const attPct = filteredEvents.length > 0 ? Math.round((presentCount / filteredEvents.length) * 100) : 0;
    return { ...member, score, presentCount, absentCount, consecutiveAbsent, attPct };
  });

  const topPerformers = [...memberStats].sort((a, b) => b.score - a.score).slice(0, 3);
  const needsAttention = memberStats.filter(m => m.consecutiveAbsent >= 2 || m.attPct < 60).sort((a, b) => a.attPct - b.attPct);
  const topScorer = topPerformers[0];

  // Date range label
  const dateLabel = filteredEvents.length > 0
    ? `${filteredEvents[0].eventDate} – ${filteredEvents[filteredEvents.length - 1].eventDate}`
    : "No events in this period";

  // Discord text
  const discordText = `⚔ **OBLIVION WEEKLY SUMMARY** | ${dateLabel}
━━━━━━━━━━━━━━━
📅 Events: ${filteredEvents.length} (${glEvents.length} GL · ${eoEvents.length} EO)
✅ Attendance: ${attRate}% (${presentSlots}/${totalSlots})
❌ Absences: ${totalAbsences}

🏆 TOP PERFORMERS
${topPerformers.map((p, i) => `${["🥇", "🥈", "🥉"][i]} ${p.ign} — ${p.score}pts (${p.attPct}% att)`).join("\n")}${needsAttention.length > 0 ? `

⚠️ NEEDS ATTENTION
${needsAttention.slice(0, 3).map(m => `${m.consecutiveAbsent >= 3 ? "🔴" : "🟡"} ${m.ign} — ${m.consecutiveAbsent >= 2 ? `${m.consecutiveAbsent} consecutive absences` : `${m.absentCount} absences`} (${m.attPct}% att)`).join("\n")}` : ""}

━━━━━━━━━━━━━━━
📊`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(discordText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📋 Weekly Report</h1>
        <p className="page-subtitle">Auto-generated summary — ready to copy paste sa Discord</p>
      </div>

      {/* Week filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Select Period</div>
            <div className="text-xs text-muted">Piliin kung anong period ang ire-report</div>
          </div>
          <div className="flex gap-2">
            {[["all", "All Events"], ["thisweek", "This Week"], ["lastweek", "Last Week"]].map(([v, l]) => (
              <button key={v} className={`btn btn-sm ${weekFilter === v ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setWeekFilter(v)}>{l}</button>
            ))}
          </div>
        </div>
        {filteredEvents.length === 0 && (
          <div className="text-muted text-sm" style={{ marginTop: 12, padding: "10px 14px", background: "rgba(224,80,80,0.05)", borderRadius: 8, border: "1px solid rgba(224,80,80,0.2)" }}>
            ⚠️ No events found for this period.
          </div>
        )}
      </div>

      {filteredEvents.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            <div className="stat-card" style={{ "--stat-accent": "var(--accent)" }}>
              <div className="stat-icon">📅</div>
              <div className="stat-label">Events</div>
              <div className="stat-value" style={{ color: "var(--accent)" }}>{filteredEvents.length}</div>
              <div className="stat-change">{glEvents.length} GL · {eoEvents.length} EO</div>
            </div>
            <div className="stat-card" style={{ "--stat-accent": attRate >= 75 ? "var(--green)" : attRate >= 50 ? "var(--gold)" : "var(--red)" }}>
              <div className="stat-icon">✅</div>
              <div className="stat-label">Attendance</div>
              <div className="stat-value" style={{ color: attRate >= 75 ? "var(--green)" : attRate >= 50 ? "var(--gold)" : "var(--red)" }}>{attRate}%</div>
              <div className="stat-change">{presentSlots}/${totalSlots} slots</div>
            </div>
            <div className="stat-card" style={{ "--stat-accent": "var(--gold)" }}>
              <div className="stat-icon">🏆</div>
              <div className="stat-label">Top Score</div>
              <div className="stat-value" style={{ color: "var(--gold)" }}>{topScorer?.score || 0}</div>
              <div className="stat-change">{topScorer?.ign || "—"}</div>
            </div>
            <div className="stat-card" style={{ "--stat-accent": "var(--red)" }}>
              <div className="stat-icon">❌</div>
              <div className="stat-label">Absences</div>
              <div className="stat-value" style={{ color: "var(--red)" }}>{totalAbsences}</div>
              <div className="stat-change">this period</div>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 20 }}>
            {/* Top Performers */}
            <div className="card">
              <div className="card-title">🏆 Top Performers</div>
              {topPerformers.length === 0 ? (
                <div className="empty-state"><div className="empty-state-text">No GL score data yet</div></div>
              ) : (
                topPerformers.map((p, i) => (
                  <div key={p.memberId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < topPerformers.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ fontSize: 22 }}>{["🥇", "🥈", "🥉"][i]}</span>
                    <MemberAvatar ign={p.ign} index={i} size={36} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.ign}</div>
                      <div className="text-xs text-muted">{p.class}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "Cinzel,serif", fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>{p.score}</div>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700,
                        background: p.attPct >= 75 ? "rgba(64,201,122,0.15)" : p.attPct >= 50 ? "rgba(240,192,64,0.15)" : "rgba(224,80,80,0.15)",
                        color: p.attPct >= 75 ? "var(--green)" : p.attPct >= 50 ? "var(--gold)" : "var(--red)"
                      }}>
                        {p.attPct}% att
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Needs Attention */}
            <div className="card">
              <div className="card-title">⚠️ Needs Attention</div>
              {needsAttention.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-text">All members are in good standing!</div>
                </div>
              ) : (
                needsAttention.slice(0, 5).map((m, i) => (
                  <div key={m.memberId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < Math.min(needsAttention.length, 5) - 1 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ fontSize: 18 }}>{m.consecutiveAbsent >= 3 || m.attPct < 40 ? "🔴" : "🟡"}</span>
                    <MemberAvatar ign={m.ign} index={i + 3} size={36} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{m.ign}</div>
                      <div className="text-xs text-muted">
                        {m.consecutiveAbsent >= 2 ? `${m.consecutiveAbsent} consecutive absences` : `${m.absentCount} absences this period`}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: m.attPct < 40 ? "var(--red)" : "var(--gold)" }}>{m.attPct}%</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Discord copy section */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="card-title" style={{ marginBottom: 2 }}>📢 Discord-Ready Text</div>
                <div className="text-xs text-muted">I-click ang Copy button tapos i-paste sa Discord channel</div>
              </div>
              <button className={`btn ${copied ? "btn-primary" : "btn-ghost"}`} onClick={copyToClipboard}>
                <Icon name="copy" size={14} />
                {copied ? "Copied! ✅" : "Copy for Discord"}
              </button>
            </div>
            <div style={{
              background: "var(--bg-deepest)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "16px 18px",
              fontFamily: "monospace",
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.9,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word"
            }}>
              {discordText}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default WeeklyReportPage;
