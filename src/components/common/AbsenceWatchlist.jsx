import React, { useMemo } from 'react';
import { useGuild } from '../../context/GuildContext';

const AbsenceWatchlist = () => {
  const { members, events, attendance } = useGuild();

  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);

  const atRiskMembers = useMemo(() => {
    const allAbsencesMap = {};
    events.forEach(ev => {
      const evAtt = attendance.filter(a => a.eventId === ev.eventId);
      activeMembers.forEach(m => {
        const a = evAtt.find(att => att.memberId === m.memberId);
        if ((a?.status || "present") !== "present") {
          allAbsencesMap[m.memberId] = (allAbsencesMap[m.memberId] || 0) + 1;
        }
      });
    });
    return Object.entries(allAbsencesMap)
      .map(([memberId, count]) => {
         const member = activeMembers.find(m => m.memberId === memberId);
         return { memberId, ign: member?.ign || memberId, class: member?.class || "Unknown", count };
      })
      .filter(m => activeMembers.some(am => am.memberId === m.memberId))
      .sort((a, b) => b.count - a.count);
  }, [events, attendance, activeMembers]);

  return (
    <div className="card" style={{
      border: "1px solid var(--border)",
      background: "var(--bg-card)",
      backdropFilter: "var(--glass-blur)",
      boxShadow: "var(--shadow-premium)"
    }}>
      <div className="card-title flex justify-between items-center">
        <span style={{ textShadow: "0 0 10px rgba(224,80,80,0.5)" }}>🚨 Absence Watchlist</span>
        <span style={{ fontSize: 11, fontWeight: "normal", color: "var(--text-muted)" }}>Lifetime</span>
      </div>
      <p className="text-xs text-muted mb-4">Members with the highest total absences across all operations.</p>
      <div className="flex flex-col gap-3" style={{ maxHeight: "300px", overflowY: "auto", paddingRight: "4px" }}>
        {atRiskMembers.length > 0 ? atRiskMembers.map((m, idx) => (
           <div key={m.memberId} className="flex items-center justify-between p-2 rounded border border-border" style={{
             background: idx < 3 ? "rgba(224,80,80,0.1)" : "var(--bg-deepest)",
             transition: "background 0.2s ease"
           }}>
              <div className="flex items-center gap-3">
                 <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--bg-card2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: idx < 3 ? "var(--red)" : "var(--text-muted)", fontSize: 12, border: "1px solid var(--border)" }}>
                   {idx + 1}
                 </div>
                 <div>
                   <div style={{ fontSize: 14, fontWeight: "bold", color: "var(--text-primary)" }}>{m.ign}</div>
                   <div className="text-xs text-muted">{m.class}</div>
                 </div>
              </div>
              <div style={{ textAlign: "right" }}>
                 <div style={{ fontSize: 14, fontWeight: "bold", color: "var(--red)", textShadow: idx < 3 ? "0 0 8px rgba(224,80,80,0.6)" : "none" }}>{m.count}</div>
                 <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase" }}>Missed</div>
              </div>
           </div>
        )) : (
          <div className="text-center text-sm text-muted py-6">All active members have perfect attendance!</div>
        )}
      </div>
    </div>
  );
};

export default AbsenceWatchlist;
