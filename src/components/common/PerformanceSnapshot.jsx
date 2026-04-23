import React, { useMemo } from 'react';
import { useGuild } from '../../context/GuildContext';
import { computeLeaderboard } from '../../utils/scoring';
import Icon from '../ui/icons';

const PerformanceSnapshot = () => {
  const { members, events, attendance, performance, eoRatings } = useGuild();

  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);

  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const currentYear = new Date().getFullYear().toString(); // "YYYY"

  const monthlyLb = useMemo(() => 
    computeLeaderboard(activeMembers, events, attendance, performance, eoRatings, currentMonth),
    [activeMembers, events, attendance, performance, eoRatings, currentMonth]
  );

  const ytdLb = useMemo(() => 
    computeLeaderboard(activeMembers, events, attendance, performance, eoRatings, null, currentYear),
    [activeMembers, events, attendance, performance, eoRatings, currentYear]
  );

  const getRankBadge = (rank) => {
    if (rank > 2) return <span style={{ opacity: 0.7, fontSize: 11 }}>#{rank + 1}</span>;
    
    const colors = [
      'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)', // Gold
      'linear-gradient(135deg, #C0C0C0 0%, #708090 100%)', // Silver
      'linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)'  // Bronze
    ];
    
    const icons = ['🥇', '🥈', '🥉'];

    return (
      <div style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: colors[rank],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        boxShadow: rank === 0 ? '0 0 12px rgba(255, 215, 0, 0.4)' : '0 0 8px rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        margin: '0 auto'
      }}>
        {icons[rank]}
      </div>
    );
  };

  const renderRankList = (data, title, icon, color) => (
    <div className="card" style={{ 
      flex: 1, 
      minWidth: 300, 
      display: 'flex', 
      flexDirection: 'column', 
      maxHeight: 500,
      border: `1px solid ${color}33`,
      background: `linear-gradient(180deg, ${color}08 0%, var(--bg-card2) 100%)`,
      paddingBottom: '12px'
    }}>
      <div className="flex items-center justify-between mb-4">
        <div className="card-title" style={{ marginBottom: 0, fontSize: 16, color, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon} {title}
        </div>
        <div className="badge badge-casual" style={{ fontSize: 10, background: `${color}20`, color }}>{data.length} Members</div>
      </div>

      <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', paddingRight: 8, marginBottom: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '8px 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', width: '50px', textAlign: 'center' }}>Rank</th>
              <th style={{ padding: '8px 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Member</th>
              <th style={{ padding: '8px 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Score & Stats</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m, i) => (
              <tr key={m.memberId} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 4px', textAlign: 'center' }}>
                  {getRankBadge(i)}
                </td>
                <td style={{ padding: '12px 4px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{m.ign}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{m.class}</div>
                </td>
                <td style={{ padding: '12px 4px', textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color, lineHeight: 1, marginBottom: 4 }}>{m.totalScore}</div>
                  <div style={{ 
                    fontSize: 10, 
                    color: 'var(--text-secondary)', 
                    display: 'flex', 
                    gap: 3, 
                    justifyContent: 'flex-end', 
                    flexWrap: 'wrap',
                    fontWeight: 600
                  }}>
                    <span title="Kills" style={{ display: 'flex', alignItems: 'center', gap: 1, background: 'var(--bg-hover)', padding: '1px 4px', borderRadius: 4 }}>⚔️{m.totalKills}</span>
                    <span title="Assists" style={{ display: 'flex', alignItems: 'center', gap: 1, background: 'var(--bg-hover)', padding: '1px 4px', borderRadius: 4 }}>🤝{m.totalAssists}</span>
                    <span title="CTF" style={{ display: 'flex', alignItems: 'center', gap: 1, background: 'var(--bg-hover)', padding: '1px 4px', borderRadius: 4 }}>🚩{m.totalCTF}</span>
                    <span title="Performance Points" style={{ display: 'flex', alignItems: 'center', gap: 1, background: 'var(--bg-hover)', padding: '1px 4px', borderRadius: 4 }}>⭐{m.totalPP}</span>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                  No data for this period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend section */}
      <div style={{ 
        paddingTop: '10px', 
        borderTop: '1px dashed var(--border)',
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ opacity: 0.8 }}>⚔️</span> Kills
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ opacity: 0.8 }}>🤝</span> Assists
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ opacity: 0.8 }}>🚩</span> CTF
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ opacity: 0.8 }}>⭐</span> PP
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid-2 gap-4 mb-4">
      {renderRankList(monthlyLb, `Monthly Performance (${new Date().toLocaleString('default', { month: 'long' })})`, "📅", "var(--accent)")}
      {renderRankList(ytdLb, `Year-to-Date Summary (${currentYear})`, "🏆", "var(--gold)")}
    </div>
  );
};

export default PerformanceSnapshot;
