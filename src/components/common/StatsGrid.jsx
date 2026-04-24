import React, { useMemo } from 'react';
import { useGuild } from '../../context/GuildContext';
import Icon from '../../components/ui/icons';

const StatsGrid = () => {
  const { members, events, attendance } = useGuild();

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
