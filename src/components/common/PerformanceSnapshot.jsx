import React, { useMemo, useState } from 'react';
import { useGuild } from '../../context/GuildContext';
import { computeLeaderboard } from '../../utils/scoring';
import Icon from '../ui/icons';

const PerformanceSnapshot = () => {
  const { 
    members, events, attendance, performance, eoRatings, 
    isOfficer, sendDiscordEmbed, discordConfig, showToast 
  } = useGuild();
  const [posting, setPosting] = useState(null); // 'monthly' or 'ytd'
  const [monthOffset, setMonthOffset] = useState(0);

  const activeMembers = useMemo(() => members.filter(m => (m.status || "active").toLowerCase() === "active"), [members]);

  const selectedMonthDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const selectedMonthString = selectedMonthDate.toISOString().slice(0, 7); // "YYYY-MM"
  const currentYear = new Date().getFullYear().toString(); // "YYYY"

  const monthlyLb = useMemo(() => 
    computeLeaderboard(activeMembers, events, attendance, performance, eoRatings, selectedMonthString),
    [activeMembers, events, attendance, performance, eoRatings, selectedMonthString]
  );

  const ytdLb = useMemo(() => 
    computeLeaderboard(activeMembers, events, attendance, performance, eoRatings, null, currentYear),
    [activeMembers, events, attendance, performance, eoRatings, currentYear]
  );

  const weeklyLb = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) to 6 (Sat)
    // Adjust to find the most recent Monday
    // (day === 0 ? -6 : 1) handles Sunday being the end of the previous week
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    
    const end = new Date(); // Today
    return computeLeaderboard(
      activeMembers, events, attendance, performance, eoRatings, 
      null, null, 
      monday.toISOString().split('T')[0], 
      end.toISOString().split('T')[0]
    );
  }, [activeMembers, events, attendance, performance, eoRatings]);

  const combatHighlights = useMemo(() => {
    const getTop = (lb) => {
      if (!lb || lb.length === 0) return { killer: null, assistant: null, objective: null };
      const sortedKills = [...lb].sort((a, b) => (b.totalKills || 0) - (a.totalKills || 0));
      const sortedAssists = [...lb].sort((a, b) => (b.totalAssists || 0) - (a.totalAssists || 0));
      const sortedObjectives = [...lb].sort((a, b) => ((b.totalTablets || 0) + (b.totalMonsters || 0) + (b.totalBoss || 0)) - ((a.totalTablets || 0) + (a.totalMonsters || 0) + (a.totalBoss || 0)));
      return { 
        killer: sortedKills[0], 
        assistant: sortedAssists[0],
        objective: sortedObjectives[0]
      };
    };

    return {
      monthly: getTop(monthlyLb),
      ytd: getTop(ytdLb),
      weekly: getTop(weeklyLb)
    };
  }, [monthlyLb, ytdLb, weeklyLb]);

  const postToDiscord = async (type, data, label, mode = 'top10') => {
    if (!isOfficer || posting) return;
    setPosting(`${type}_${mode}`);
    try {
      let fields = [];
      const highlights = combatHighlights[type];

      if (mode === 'top10') {
        const activeScorers = data.filter(m => m.totalScore > 0);
        const topOverall = activeScorers.slice(0, 10);
        const topDPS = [...activeScorers].filter(m => m.role === "DPS")
          .sort((a, b) => (b.totalKills || 0) - (a.totalKills || 0) || (b.totalScore || 0) - (a.totalScore || 0))
          .slice(0, 10);
        const topSupport = [...activeScorers].filter(m => m.role === "Support")
          .sort((a, b) => (b.totalAssists || 0) - (a.totalAssists || 0) || (b.totalScore || 0) - (a.totalScore || 0))
          .slice(0, 10);
        const topAttendance = [...activeScorers].sort((a, b) => 
          ((b.attendancePct || 0) - (a.attendancePct || 0)) || 
          ((b.totalScore || 0) - (a.totalScore || 0))
        ).slice(0, 10);

        const formatDetailedMember = (m, rank) => {
          let str = `**#${rank}** — ${m.ign} (**${m.totalScore.toLocaleString()} pts**)`;
          str += `\n╰ \`Vale\` ⚔️${m.valeKills || 0} | 🤝${m.valeAssists || 0} | ⭐${m.totalPP || 0} | 🎯${m.totalValeScore || 0}`;
          if (m.totalStellarScore > 0) {
            const stlrObj = m.totalBoss > 0 ? `👹${m.totalBoss}` : `✨${m.totalTablets || 0}`;
            str += `\n╰ \`Stlr\` ⚔️${m.stellarKills || 0} | 🤝${m.stellarAssists || 0} | ${stlrObj} | 🎯${m.totalStellarScore || 0}`;
          }
          return str;
        };

        const overallChunks = [];
        for (let i = 0; i < topOverall.length; i += 5) {
          overallChunks.push(topOverall.slice(i, i + 5));
        }

        overallChunks.forEach((chunk, idx) => {
          fields.push({
            name: idx === 0 ? "🏆 TOP 1-5 OVERALL WARRIORS" : `🏆 TOP ${idx * 5 + 1}-${idx * 5 + chunk.length} OVERALL`,
            value: chunk.length > 0 ? chunk.map((m, i) => formatDetailedMember(m, idx * 5 + i + 1)).join("\n\n") : "No data recorded.",
            inline: false
          });
        });

        fields.push(
          { 
            name: "⚔️ TOP 10 DPS ELITES", 
            value: topDPS.length > 0 ? topDPS.map((m, i) => `**#${i + 1}** — ${m.ign}\n╰ **${m.totalScore.toLocaleString()} pts**`).join("\n") : "No data recorded.",
            inline: true 
          },
          { 
            name: "🛡️ TOP 10 SUPPORT SPECIALISTS", 
            value: topSupport.length > 0 ? topSupport.map((m, i) => `**#${i + 1}** — ${m.ign}\n╰ **${m.totalScore.toLocaleString()} pts**`).join("\n") : "No data recorded.",
            inline: true 
          },
          { 
            name: "📋 TOP 10 ATTENDANCE LEADERS", 
            value: topAttendance.length > 0 ? topAttendance.map((m, i) => `**#${i + 1}** — ${m.ign}\n╰ **${m.attendancePct}% attendance**`).join("\n") : "No data recorded.",
            inline: false 
          }
        );

        if (type === 'weekly' && highlights?.killer) {
          fields.unshift({
            name: "🔥 WEEKLY COMBAT HIGHLIGHTS",
            value: `⚔️ **Top Killer:** ${highlights.killer?.ign} (${highlights.killer?.totalKills} kills)\n🤝 **Top Assistant:** ${highlights.assistant?.ign} (${highlights.assistant?.totalAssists} assists)\n✨ **Objective MVP:** ${highlights.objective?.ign} (${(highlights.objective?.totalTablets || 0) + (highlights.objective?.totalBoss || 0)} pts)`,
            inline: false
          });
        }
      } else if (mode === 'full') {
        // Chunk full roster to prevent exceeding Discord 1024-char limit per field
        const getMedal = (rank) => {
          if (rank === 1) return "🥇";
          if (rank === 2) return "🥈";
          if (rank === 3) return "🥉";
          return "▫️";
        };

        const activeScorers = data.filter(m => m.totalScore > 0);
        const chunkSize = 6; // Safety margin for 1024-char limit with detailed breakdown
        for (let i = 0; i < activeScorers.length; i += chunkSize) {
          const chunk = activeScorers.slice(i, i + chunkSize);
          fields.push({
            name: `📜 OVERALL RANKS ${i + 1} TO ${i + chunk.length}`,
            value: chunk.map((m, idx) => {
              const rank = i + idx + 1;
              let str = `**#${rank}** ${getMedal(rank)} **${m.ign}** — **${m.totalScore.toLocaleString()} pts**`;
              str += `\n╰ \`V\` ⚔️${m.valeKills || 0} 🤝${m.valeAssists || 0} ⭐${m.totalPP || 0} 🎯${m.totalValeScore || 0}`;
              if (m.totalStellarScore > 0) {
                const stlrObj = m.totalBoss > 0 ? `👹${m.totalBoss}` : `✨${m.totalTablets || 0}`;
                str += `\n╰ \`S\` ⚔️${m.stellarKills || 0} 🤝${m.stellarAssists || 0} ${stlrObj} 🎯${m.totalStellarScore || 0}`;
              }
              return str;
            }).join("\n\n"),
            inline: false
          });
        }
      }

      fields.unshift({
        name: "📖 SYMBOLS LEGEND",
        value: "`Vale Clash` ⚔️ Kills | 🤝 Assists | ⭐ Performance Pts | 🎯 Event Total Score\n`Stellar Clash` ⚔️ Kills | 🤝 Assists | ✨ Tablets (Main) | 👹 Boss (Sub) | 🎯 Event Total Score",
        inline: false
      });

      const MAX_FIELDS_PER_EMBED = 8;
      for (let i = 0; i < fields.length; i += MAX_FIELDS_PER_EMBED) {
        const fieldBatch = fields.slice(i, i + MAX_FIELDS_PER_EMBED);
        const isFirstBatch = i === 0;
        const isLastBatch = i + MAX_FIELDS_PER_EMBED >= fields.length;

        await sendDiscordEmbed(
          isFirstBatch 
            ? `🛡️  __**OBLIVION ${label.toUpperCase()} ${mode === 'full' ? 'FULL LEADERBOARD' : (type === 'weekly' ? 'DIGEST' : 'HONORS')}**__  🛡️`
            : `🛡️  __**OBLIVION ${label.toUpperCase()} (Part ${Math.floor(i / MAX_FIELDS_PER_EMBED) + 1})**__  🛡️`,
          isFirstBatch 
            ? (mode === 'full' 
              ? `The complete official rankings for this period. Every point counts!\n\u200B`
              : (type === 'weekly' 
                ? `Detailed performance report for the past 7 days. Excellent work, Oblivion!\n\u200B`
                : `Recognizing our top performers for this period!\n\u200B`))
            : null,
          type === 'monthly' ? 0x6382E6 : (type === 'weekly' ? 0x9333ea : 0xF0C040),
          fieldBatch,
          isFirstBatch ? "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png" : null,
          "reports",
          `${type}_${mode}`,
          { scope: label },
          null,
          isFirstBatch ? null : " " // Use a space to override ping and avoid duplicate pings on continuation messages
        );
        
        if (!isLastBatch) {
          await new Promise(res => setTimeout(res, 1000)); // 1 second delay to avoid rate limits
        }
      }

      showToast(`${label} ${mode === 'full' ? 'Full Leaderboard' : 'Top 10'} posted to Discord!`, "success");
    } catch (err) {
      console.error("Discord Error:", err);
      showToast("Failed to post honors", "error");
    } finally {
      setPosting(null);
    }
  };


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
        width: 26, height: 26, borderRadius: '50%', background: colors[rank],
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
        boxShadow: rank === 0 ? '0 0 12px rgba(255, 215, 0, 0.4)' : '0 0 8px rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.3)', margin: '0 auto'
      }}>
        {icons[rank]}
      </div>
    );
  };

  const renderHighlightCard = (member, label, icon, color, subValue) => (
    <div className="card" style={{ 
      padding: '16px 20px', flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 16,
      border: `1px solid ${color}33`, background: `linear-gradient(135deg, ${color}15, var(--bg-card))`
    }}>
      <div style={{ 
        width: 44, height: 44, borderRadius: 12, background: `${color}20`, 
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        boxShadow: `0 0 15px ${color}20`
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{member?.ign || "—"}</div>
        <div style={{ fontSize: 12, color, fontWeight: 700 }}>{subValue}</div>
      </div>
    </div>
  );

  const renderRankList = (data, title, icon, color, controls = null) => (
    <div className="card" style={{ 
      flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', maxHeight: 500,
      border: `1px solid ${color}33`, background: `linear-gradient(180deg, ${color}08 0%, var(--bg-card2) 100%)`,
      paddingBottom: '12px'
    }}>
      <div className="flex items-center justify-between mb-4">
        <div className="card-title" style={{ marginBottom: 0, fontSize: 16, color, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon} {title}
          {controls && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>{controls}</div>}
        </div>
        <div className="badge badge-casual" style={{ fontSize: 10, background: `${color}20`, color }}>{data.length} Members</div>
      </div>

      <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', paddingRight: 8, marginBottom: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '8px 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', width: '40px', textAlign: 'center' }}>Rank</th>
              <th style={{ padding: '8px 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Member</th>
              <th style={{ padding: '8px 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Performance Breakdown</th>
              <th style={{ padding: '8px 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right', width: '60px' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m, i) => {
              return (
                <tr key={m.memberId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 4px', textAlign: 'center' }}>{getRankBadge(i)}</td>
                  <td style={{ padding: '12px 4px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{m.ign}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{m.class}</div>
                  </td>
                  <td style={{ padding: '12px 6px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      {/* MINI TABLE DIVISION */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', minWidth: '220px' }}>
                        {/* VALE CLASH COLUMN */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: 4, 
                          padding: '6px 10px',
                          background: 'rgba(99, 130, 230, 0.04)',
                          borderRadius: '6px',
                          border: '1px solid rgba(99, 130, 230, 0.08)',
                          alignItems: 'flex-end'
                        }}>
                          <div style={{ 
                            fontSize: '8px', 
                            color: 'var(--accent)', 
                            textTransform: 'uppercase', 
                            fontWeight: 900, 
                            letterSpacing: '1px',
                            borderBottom: '1px solid rgba(99, 130, 230, 0.2)',
                            width: '100%',
                            textAlign: 'right',
                            marginBottom: 2,
                            paddingBottom: 2
                          }}>Vale Clash</div>
                          
                          <div style={{ display: 'flex', gap: 6, fontWeight: 700, color: 'var(--text-primary)', fontSize: 11 }}>
                            <span title="Kills">⚔️ {m.valeKills}</span>
                            <span title="Assists">🤝 {m.valeAssists}</span>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end', fontSize: 10 }}>
                            <span title="CTF Captures" style={{ color: 'var(--accent)', opacity: 0.9 }}>🚩 {m.totalCTF}</span>
                            <span title="Perf. Points" style={{ color: 'var(--gold)', opacity: 0.9 }}>⭐ {m.totalPP}</span>
                          </div>
                          
                          <div style={{ 
                            fontWeight: 800, 
                            fontSize: 12, 
                            color: 'var(--text-primary)',
                            marginTop: 2,
                            paddingTop: 2,
                            borderTop: '1px dashed rgba(255,255,255,0.1)',
                            width: '100%',
                            textAlign: 'right'
                          }}>🎯 {m.totalValeScore}</div>
                        </div>

                        {/* STELLAR CLASH COLUMN */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: 4, 
                          padding: '6px 10px',
                          background: 'rgba(139, 92, 246, 0.04)',
                          borderRadius: '6px',
                          border: '1px solid rgba(139, 92, 246, 0.08)',
                          alignItems: 'flex-end'
                        }}>
                          <div style={{ 
                            fontSize: '8px', 
                            color: 'var(--color-wizard)', 
                            textTransform: 'uppercase', 
                            fontWeight: 900, 
                            letterSpacing: '1px',
                            borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
                            width: '100%',
                            textAlign: 'right',
                            marginBottom: 2,
                            paddingBottom: 2
                          }}>Stellar Clash</div>
                          
                          { (m.stellarKills > 0 || m.stellarAssists > 0 || m.totalTablets > 0 || m.totalBoss > 0 || m.totalIngameScore > 0) ? (
                            <>
                              <div style={{ display: 'flex', gap: 6, fontWeight: 700, color: 'var(--text-primary)', fontSize: 11 }}>
                                <span title="Kills">⚔️ {m.stellarKills}</span>
                                <span title="Assists">🤝 {m.stellarAssists}</span>
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end', fontSize: 10 }}>
                                { m.totalTablets > 0 && <span title="Tablets" style={{ color: 'var(--purple)', opacity: 0.9 }}>✨ {m.totalTablets}</span> }
                                { m.totalBoss > 0 && <span title="Boss Dmg" style={{ color: 'var(--red)', opacity: 0.9 }}>👹 {m.totalBoss}</span> }
                                { m.totalIngameScore > 0 && <span title="In-game Score" style={{ color: 'var(--green)', opacity: 0.9 }}>📊 {m.totalIngameScore}</span> }
                              </div>
                              
                              <div style={{ 
                                fontWeight: 800, 
                                fontSize: 12, 
                                color: 'var(--text-primary)',
                                marginTop: 2,
                                paddingTop: 2,
                                borderTop: '1px dashed rgba(255,255,255,0.1)',
                                width: '100%',
                                textAlign: 'right'
                              }}>🎯 {m.totalStellarScore}</div>
                            </>
                          ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', opacity: 0.2, fontSize: 14 }}>—</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                    <div style={{ 
                      fontWeight: 900, 
                      fontSize: 18, 
                      color, 
                      lineHeight: 1,
                      fontFamily: 'Cinzel, serif',
                      textShadow: `0 0 10px ${color}44`
                    }}>{m.totalScore.toLocaleString()}</div>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 12 }}>No data for this period</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ 
        paddingTop: '12px', 
        borderTop: '1px dashed var(--border)', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px',
        background: 'rgba(0,0,0,0.1)',
        borderRadius: '0 0 12px 12px',
        padding: '12px'
      }}>
        {/* VALE LEGEND */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '8px', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1 }}>Vale:</span>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>⚔️ Kills</div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>🤝 Assists</div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>🚩 CTF</div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>⭐ PP</div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}>🎯 Score</div>
        </div>

        {/* STELLAR LEGEND */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '8px', fontWeight: 800, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: 1 }}>Stellar:</span>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>⚔️ Kills</div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>🤝 Assists</div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>✨ Tablets</div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>👹 Boss</div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>📊 In-game</div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}>🎯 Score</div>
        </div>
      </div>
      
      {isOfficer && (
        <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', display: 'flex', gap: 8 }}>
          <button 
            className="btn btn-primary btn-sm"
            style={{ flex: 1, justifyContent: 'center', gap: '8px', background: 'rgba(99, 130, 230, 0.15)', border: '1px solid rgba(99, 130, 230, 0.3)', color: 'var(--accent)' }}
            disabled={posting || data.length === 0}
            onClick={() => postToDiscord(title.includes('MONTHLY') ? 'monthly' : (title.includes('WEEKLY') ? 'weekly' : 'ytd'), data, title, 'top10')}
          >
            <Icon name="brand-discord" size={14} />
            {posting === `${title.includes('MONTHLY') ? 'monthly' : (title.includes('WEEKLY') ? 'weekly' : 'ytd')}_top10` ? 'Posting...' : `Post Top 10`}
          </button>
          
          <button 
            className="btn btn-secondary btn-sm"
            style={{ flex: 1, justifyContent: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
            disabled={posting || data.length === 0}
            onClick={() => postToDiscord(title.includes('MONTHLY') ? 'monthly' : (title.includes('WEEKLY') ? 'weekly' : 'ytd'), data, title, 'full')}
          >
            <Icon name="brand-discord" size={14} />
            {posting === `${title.includes('MONTHLY') ? 'monthly' : (title.includes('WEEKLY') ? 'weekly' : 'ytd')}_full` ? 'Posting...' : `Post Full Roster`}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {renderHighlightCard(combatHighlights.monthly.killer, `Top Executioner (${selectedMonthDate.toLocaleString('default', { month: 'short' })})`, "⚔️", "var(--red)", `${combatHighlights.monthly.killer?.totalKills || 0} Kills`)}
        {renderHighlightCard(combatHighlights.monthly.assistant, `Tactical MVP (${selectedMonthDate.toLocaleString('default', { month: 'short' })})`, "🤝", "var(--accent)", `${combatHighlights.monthly.assistant?.totalAssists || 0} Assists`)}
        {renderHighlightCard(combatHighlights.monthly.objective, `Objective Hero (${selectedMonthDate.toLocaleString('default', { month: 'short' })})`, "✨", "var(--purple)", `${combatHighlights.monthly.objective?.totalTablets || 0} Tablets / ${combatHighlights.monthly.objective?.totalMonsters || 0} Mon`)}
        {renderHighlightCard(combatHighlights.ytd.killer, "Annual Slayer (YTD)", "💀", "var(--gold)", `${combatHighlights.ytd.killer?.totalKills || 0} Total Kills`)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {renderRankList(
          monthlyLb, 
          `Monthly Performance (${selectedMonthDate.toLocaleString('default', { month: 'long' })})`, 
          "📅", 
          "var(--accent)",
          (
            <>
              <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', height: 24, fontSize: 12 }} onClick={() => setMonthOffset(p => p - 1)} title="Previous Month">◀</button>
              {monthOffset < 0 && <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', height: 24, fontSize: 12 }} onClick={() => setMonthOffset(0)} title="Current Month">↺</button>}
              {monthOffset < 0 && <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', height: 24, fontSize: 12 }} onClick={() => setMonthOffset(p => p + 1)} title="Next Month">▶</button>}
            </>
          )
        )}
        {renderRankList(weeklyLb, `Weekly Digest (Last 7 Days)`, "📢", "var(--purple)")}
        {renderRankList(ytdLb, `Year-to-Date Summary (${currentYear})`, "🏆", "var(--gold)")}
      </div>
    </div>
  );
};

export default PerformanceSnapshot;
