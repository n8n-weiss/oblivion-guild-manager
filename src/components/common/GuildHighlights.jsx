import React, { useMemo } from 'react';
import { useGuild } from '../../context/GuildContext';

const GuildHighlights = () => {
  const { members, events, performance } = useGuild();

  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);
  const recentEvents = events.slice(-5);

  const activityFeed = useMemo(() => {
    const feed = [];
    recentEvents.forEach(ev => {
      const evPerf = performance
        .filter(p => p.eventId === ev.eventId)
        .map(p => ({ ...p, calculatedScore: (p.performancePoints || 0) + (p.ctfPoints || 0) }))
        .sort((a, b) => b.calculatedScore - a.calculatedScore)
        .slice(0, 3);
      evPerf.forEach((p, idx) => {
        const pId = (p.memberId || "").toLowerCase();
        const member = activeMembers.find(m => (m.memberId || "").toLowerCase() === pId);
        if (member) {
          feed.push({
            id: `feed-${ev.eventId}-${p.memberId}`,
            type: "performance",
            member: member.ign,
            text: idx === 0 ? `MVP in ${ev.eventType} (+${p.calculatedScore} pts)` : `Top Performer in ${ev.eventType} (+${p.calculatedScore} pts)`,
            date: ev.eventDate,
            icon: idx === 0 ? "👑" : "🔥"
          });
        }
      });
    });
    return feed.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
  }, [recentEvents, performance, activeMembers]);

  return (
    <div className="card" style={{
      border: "1px solid rgba(240,192,64,0.2)",
      background: "linear-gradient(180deg, rgba(240,192,64,0.1) 0%, rgba(10, 15, 25, 0.6) 100%)",
      backdropFilter: "blur(12px)",
      boxShadow: "0 8px 32px 0 rgba(240, 192, 64, 0.05)",
      transition: "transform 0.2s ease, box-shadow 0.2s ease"
    }}>
      <div className="card-title" style={{ textShadow: "0 0 10px rgba(240,192,64,0.5)" }}>📡 Guild Highlights</div>
      <div className="flex flex-col gap-3 mt-4">
        {activityFeed.map(item => (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg" style={{
            background: "rgba(240,192,64,0.08)",
            border: "1px solid rgba(240,192,64,0.2)",
            transition: "background 0.2s ease, transform 0.2s ease",
            cursor: "default"
          }}>
            <div style={{ fontSize: 20, filter: "drop-shadow(0 0 5px gold)" }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                <span style={{ fontWeight: 800, color: "var(--gold)", textShadow: "0 0 8px rgba(240,192,64,0.4)" }}>{item.member}</span> {item.text}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{item.date}</div>
            </div>
          </div>
        ))}
        {activityFeed.length === 0 && <div className="text-xs text-muted p-4 text-center">No recent MVP highlights.</div>}
      </div>
    </div>
  );
};

export default GuildHighlights;
