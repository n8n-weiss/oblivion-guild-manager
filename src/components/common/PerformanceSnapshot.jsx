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

  const renderRankList = (data, title, icon, color) => (
    <div className="card" style={{ 
      flex: 1, 
      minWidth: 300, 
      display: 'flex', 
      flexDirection: 'column', 
      maxHeight: 400,
      border: `1px solid ${color}33`,
      background: `linear-gradient(180deg, ${color}08 0%, rgba(10, 15, 25, 0.6) 100%)`
    }}>
      <div className="flex items-center justify-between mb-4">
        <div className="card-title" style={{ marginBottom: 0, fontSize: 16, color }}>
          {icon} {title}
        </div>
        <div className="badge badge-casual" style={{ fontSize: 10 }}>{data.length} Members</div>
      </div>

      <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '8px 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rank</th>
              <th style={{ padding: '8px 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Member</th>
              <th style={{ padding: '8px 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m, i) => (
              <tr key={m.memberId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '10px 4px', fontSize: 13, fontWeight: 700, color: i < 3 ? color : 'var(--text-muted)' }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </td>
                <td style={{ padding: '10px 4px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{m.ign}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.class}</div>
                </td>
                <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color, lineHeight: 1 }}>{m.totalScore}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <span title="Kills" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>⚔️{m.totalKills}</span>
                    <span title="Assists" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>🤝{m.totalAssists}</span>
                    <span title="CTF" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>🚩{m.totalCTF}</span>
                    <span title="Performance Points" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>⭐{m.totalPP}</span>
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
