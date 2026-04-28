import React, { useMemo } from 'react';
import { useGuild } from '../../context/GuildContext';

const StatsGrid = () => {
  const { members, events, attendance, performance } = useGuild();

  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);

  const totalPresences = useMemo(() => {
    let count = 0;
    events.forEach(ev => {
      activeMembers.forEach(m => {
        const att = attendance.find(a => a.eventId === ev.eventId && a.memberId === m.memberId);
        if ((att?.status || "present") === "present") count++;
      });
    });
    return count;
  }, [events, activeMembers, attendance]);

  const totalExpected = activeMembers.length * events.length;
  const attRate = totalExpected ? Math.round((totalPresences / totalExpected) * 100) : 0;

  const combatStats = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const currentMonthEvents = events.filter(e => (e.eventDate || "").startsWith(currentMonth));
    const eventIds = new Set(currentMonthEvents.map(e => e.eventId));
    
    let kills = 0;
    let assists = 0;
    performance.forEach(p => {
      if (eventIds.has(p.eventId)) {
        kills += Number(p.kills || 0);
        assists += Number(p.assists || 0);
      }
    });
    return { kills, assists };
  }, [events, performance]);

  return (
    <div className="stats-grid" style={{ marginBottom: 24, gap: '16px' }}>
      <div className="stat-card" style={{
        "--stat-accent": "var(--accent)",
        background: "linear-gradient(145deg, rgba(99,130,230,0.1), rgba(0,0,0,0.4))",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        cursor: "default"
      }}>
        <div className="stat-icon" style={{ textShadow: "0 0 12px var(--accent)" }}>⚔️</div>
        <div className="stat-label">Active Roster</div>
        <div className="stat-value" style={{ color: "var(--accent)", textShadow: "0 0 10px rgba(99,130,230,0.5)" }}>{activeMembers.length}</div>
        <div className="stat-change">Total mobilized units</div>
      </div>

      <div className="stat-card" style={{
        "--stat-accent": "var(--red)",
        background: "linear-gradient(145deg, rgba(224,80,80,0.1), rgba(0,0,0,0.4))",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        cursor: "default"
      }}>
        <div className="stat-icon" style={{ textShadow: "0 0 12px var(--red)" }}>💥</div>
        <div className="stat-label">League Combat (MTD)</div>
        <div className="stat-value" style={{ color: "var(--red)", textShadow: "0 0 10px rgba(224,80,80,0.5)", fontSize: combatStats.kills > 999 ? "24px" : "28px" }}>
          {combatStats.kills} <span style={{ fontSize: 14, opacity: 0.6, color: 'var(--text-muted)' }}>/ {combatStats.assists}</span>
        </div>
        <div className="stat-change">Total Kills / Assists</div>
      </div>

      <div className="stat-card" style={{
        "--stat-accent": attRate >= 75 ? "var(--green)" : attRate >= 50 ? "var(--gold)" : "var(--red)",
        background: "linear-gradient(145deg, rgba(64,201,122,0.1), rgba(0,0,0,0.4))",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        cursor: "default"
      }}>
        <div className="stat-icon">📋</div>
        <div className="stat-label">Guild Attendance</div>
        <div className="stat-value" style={{ color: attRate >= 75 ? "var(--green)" : attRate >= 50 ? "var(--gold)" : "var(--red)", textShadow: `0 0 10px ${attRate >= 75 ? 'rgba(64,201,122,0.5)' : attRate >= 50 ? 'rgba(240,192,64,0.5)' : 'rgba(224,80,80,0.5)'}` }}>{attRate}%</div>
        <div className="stat-change">Recent window average</div>
      </div>

      <div className="stat-card" style={{
        "--stat-accent": "var(--gold)",
        background: "linear-gradient(145deg, rgba(240,192,64,0.1), rgba(0,0,0,0.4))",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        cursor: "default"
      }}>
        <div className="stat-icon">🏆</div>
        <div className="stat-label">Recent Operations (45d)</div>
        <div className="stat-value" style={{ color: "var(--gold)", textShadow: "0 0 10px rgba(240,192,64,0.5)" }}>{events.length}</div>
        <div className="stat-change">Active campaign window</div>
      </div>
    </div>
  );
};

export default StatsGrid;
