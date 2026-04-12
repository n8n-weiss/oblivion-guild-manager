import React, { useMemo } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { computeLeaderboard } from '../utils/scoring';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

function renderAttendanceTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="card shadow-xl" style={{ border: "1px solid var(--border)", padding: "10px", background: "rgba(10, 15, 25, 0.95)", backdropFilter: "blur(8px)" }}>
        <p className="text-xs text-muted mb-1">{label}</p>
        <p className="font-cinzel text-sm" style={{ color: "var(--accent)" }}>
          Attendance: <span className="text-white">{payload[0].value}%</span>
        </p>
        <p className="text-xs text-muted">
          {payload[0].payload.present} / {payload[0].payload.total} Members
        </p>
      </div>
    );
  }
  return null;
}

function Dashboard() {
  const { 
    members, events, attendance, performance, onlineUsers = [], 
    requests = [], joinRequests = [], absences = [], auctionWishlist = [], 
    myMemberId, isOfficer 
  } = useGuild();
  
  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);
  const lb = useMemo(() => computeLeaderboard(activeMembers, events, attendance, performance), [activeMembers, events, attendance, performance]);
  
  // Total presences considering missing records as present for active members
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

  // Guild Level and XP Calculation
  const totalGuildScore = lb.reduce((sum, m) => sum + (m.totalScore || 0), 0);
  const guildLevel = Math.max(1, Math.floor(Math.sqrt(totalGuildScore / 10)));
  const nextLevelXP = Math.pow(guildLevel + 1, 2) * 10;
  const currentLevelXP = Math.pow(guildLevel, 2) * 10;
  const xpProgress = Math.min(100, Math.round(((totalGuildScore - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100));

  // --- OFFICER SPECIFIC METRICS ---
  const pendingJoin = joinRequests.filter(r => r.status === "pending").length;
  const pendingProfile = requests.filter(r => r.status === "pending").length;
  const upcomingAbsences = absences.filter(a => new Date(a.date) >= new Date()).length;
  const pendingAudits = events.filter(ev => ev.battlelogAudit && ev.battlelogAudit.status === "pending");

  // --- ABSENCE WATCHLIST (At Risk) ---
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

  // --- MEMBER SPECIFIC METRICS ---
  const myProfile = useMemo(() => activeMembers.find(m => m.memberId === myMemberId), [activeMembers, myMemberId]);
  const myLbEntry = useMemo(() => lb.find(l => l.memberId === myMemberId), [lb, myMemberId]);
  const myRankNum = useMemo(() => lb.findIndex(l => l.memberId === myMemberId) + 1, [lb, myMemberId]);

  // --- LOOT WISHLIST RADAR ---
  const wishlistRadar = useMemo(() => {
     let cardAlbumCount = 0;
     let ldCount = 0;
     const albumMembers = [];
     const ldMembers = [];
     
     auctionWishlist.forEach(entry => {
       const member = activeMembers.find(m => m.memberId === entry.id);
       if (!member) return;
       const bids = entry.bids || [];
       if (bids.some(b => b.type === "Card Album")) {
         cardAlbumCount++;
         albumMembers.push(member.ign);
       }
       if (bids.some(b => b.type === "Light & Dark")) {
         ldCount++;
         ldMembers.push(member.ign);
       }
     });
     
     return [
       { type: "Card Album", icon: "🃏", count: cardAlbumCount, members: albumMembers },
       { type: "Light & Dark", icon: "✨", count: ldCount, members: ldMembers }
     ].filter(w => w.count > 0).sort((a,b) => b.count - a.count);
  }, [auctionWishlist, activeMembers]);

  // --- GUILD ACTIVITY FEED ---
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

  // Chart Data
  const chartData = useMemo(() => {
    return events.slice(-10).map(ev => {
      const evAtt = attendance.filter(a => a.eventId === ev.eventId);
      const present = activeMembers.filter(m => {
        const a = evAtt.find(att => att.memberId === m.memberId);
        return (a?.status || "present") === "present";
      }).length;
      const pct = activeMembers.length ? Math.round((present / activeMembers.length) * 100) : 0;
      return {
        date: ev.eventDate,
        attendance: pct,
        present: present,
        total: evAtt.length,
        type: ev.eventType === "Guild League" ? "⚔️" : "🏰"
      };
    });
  }, [events, attendance, activeMembers]);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 40 }}>
      {/* HEADER SECTION */}
      <div className="page-header flex justify-between items-end" style={{ marginBottom: 24 }}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="page-title" style={{ fontSize: 32, textShadow: "0 0 16px rgba(255,255,255,0.1)" }}>📊 Dashboard</h1>
            {onlineUsers.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(64, 201, 122, 0.1)", border: "1px solid rgba(64, 201, 122, 0.3)", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, color: "var(--green)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 8px var(--green)" }}></span>
                {onlineUsers.length} ONLINE
              </div>
            )}
          </div>
          <p className="page-subtitle">Guild command center & performance at a glance</p>
        </div>
        <div style={{ textAlign: "right", minWidth: 200 }}>
          <div className="flex justify-between items-end mb-1" style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>
            <span>GUILD RANK: {guildLevel}</span>
            <span className="text-muted" style={{ fontWeight: 400 }}>{totalGuildScore} / {nextLevelXP} XP</span>
          </div>
          <div className="progress-bar-wrap" style={{ height: 6 }}>
            <div className="progress-bar-fill" style={{ width: `${xpProgress}%`, background: "linear-gradient(90deg, #d4af37, #f0c040)", boxShadow: "0 0 10px rgba(240,192,64,0.4)" }} />
          </div>
        </div>
      </div>

      {/* CORE STATS GRID */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ "--stat-accent": "var(--accent)", background: "linear-gradient(145deg, rgba(99,130,230,0.05), rgba(0,0,0,0.2))" }}>
          <div className="stat-icon" style={{ textShadow: "0 0 12px var(--accent)" }}>⚔️</div>
          <div className="stat-label">Active Roster</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{activeMembers.length}</div>
          <div className="stat-change">Total mobilized units</div>
        </div>
        <div className="stat-card" style={{ "--stat-accent": attRate >= 75 ? "var(--green)" : attRate >= 50 ? "var(--gold)" : "var(--red)", background: "linear-gradient(145deg, rgba(64,201,122,0.05), rgba(0,0,0,0.2))" }}>
          <div className="stat-icon">📋</div>
          <div className="stat-label">Guild Attendance</div>
          <div className="stat-value" style={{ color: attRate >= 75 ? "var(--green)" : attRate >= 50 ? "var(--gold)" : "var(--red)" }}>{attRate}%</div>
          <div className="stat-change">Lifetime event average</div>
        </div>
        <div className="stat-card" style={{ "--stat-accent": "var(--gold)", background: "linear-gradient(145deg, rgba(240,192,64,0.05), rgba(0,0,0,0.2))" }}>
          <div className="stat-icon">🏆</div>
          <div className="stat-label">Total Operations</div>
          <div className="stat-value" style={{ color: "var(--gold)" }}>{events.length}</div>
          <div className="stat-change">Successful campaigns</div>
        </div>
      </div>

      {/* SPLIT VIEW 1: ROLE BASED HUB & ABSENCE WATCHLIST */}
      <div className="grid-2 mb-4">
        {isOfficer ? (
          <div className="card" style={{ border: "1px solid rgba(224,92,138,0.2)", background: "linear-gradient(180deg, rgba(224,92,138,0.05) 0%, rgba(0,0,0,0.2) 100%)" }}>
            <div className="card-title text-accent2 flex items-center justify-between">
              <span>🛡️ Officer Action Center</span>
              <span style={{ fontSize: 10, background: "rgba(224,92,138,0.2)", padding: '2px 8px', borderRadius: 8, color: "var(--accent2)" }}>ADMIN</span>
            </div>
            <div className="flex flex-col gap-2 mt-3">
              <div className="flex justify-between items-center p-2 rounded border border-white border-opacity-5" style={{ background: "rgba(0,0,0,0.3)" }}>
                <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>New Applications</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${pendingJoin > 0 ? "text-white" : "text-muted"}`} style={{ background: pendingJoin > 0 ? "var(--accent)" : "transparent" }}>{pendingJoin} Pending</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-white border-opacity-5" style={{ background: "rgba(0,0,0,0.3)" }}>
                <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Profile Updates</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${pendingProfile > 0 ? "text-white" : "text-muted"}`} style={{ background: pendingProfile > 0 ? "var(--accent2)" : "transparent" }}>{pendingProfile} Unread</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-white border-opacity-5" style={{ background: "rgba(0,0,0,0.3)" }}>
                <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Upcoming Absences</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${upcomingAbsences > 0 ? "text-black" : "text-muted"}`} style={{ background: upcomingAbsences > 0 ? "var(--gold)" : "transparent" }}>{upcomingAbsences} Filed</span>
              </div>
            </div>
            {pendingAudits.length > 0 && (
              <div className="mt-4 border-t border-white border-opacity-10 pt-3">
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Pending Event Audits</div>
                <div className="flex flex-col gap-2 relative">
                  {pendingAudits.slice(0, 3).map(ev => (
                    <div key={ev.eventId} className="flex justify-between items-center" style={{ fontSize: 13 }}>
                      <span className="text-white">{ev.eventDate} ({ev.eventType === "Guild League" ? "GL" : "EO"})</span>
                      <span style={{ color: "var(--accent)" }}>Auditor: {ev.battlelogAudit.assignedIgn || "Unassigned"}</span>
                    </div>
                  ))}
                  {pendingAudits.length > 3 && (
                    <div className="text-xs text-muted text-right italic pt-1">...and {pendingAudits.length - 3} more</div>
                  )}
                </div>
              </div>
            )}
            {(pendingJoin === 0 && pendingProfile === 0 && upcomingAbsences === 0 && pendingAudits.length === 0) && (
               <div className="mt-4 text-xs text-center text-muted">All clear. No pending administrative actions.</div>
            )}
          </div>
        ) : (
          <div className="card" style={{ border: "1px solid rgba(99,130,230,0.2)", background: "linear-gradient(180deg, rgba(99,130,230,0.05) 0%, rgba(0,0,0,0.2) 100%)" }}>
            <div className="card-title text-accent flex items-center justify-between">
              <span>👤 My Guild Status</span>
              <span style={{ fontSize: 10, background: "rgba(99,130,230,0.2)", padding: '2px 8px', borderRadius: 8, color: "var(--accent)" }}>MEMBER</span>
            </div>
            {myProfile ? (
              <div className="mt-4">
                <div className="flex items-center gap-4 mb-4">
                  <div style={{ width: 50, height: 50, borderRadius: 12, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: "bold", boxShadow: "0 0 15px rgba(99,130,230,0.4)" }}>
                    {myProfile.ign[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: "bold", color: "white" }}>{myProfile.ign}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>{myProfile.class} | {myProfile.role}</div>
                  </div>
                </div>
                <div className="grid-2 gap-3">
                   <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                     <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Guild Rank</div>
                     <div style={{ fontFamily: "Cinzel,serif", fontSize: 24, color: "var(--gold)", fontWeight: "bold" }}>#{myRankNum}</div>
                   </div>
                   <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                     <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Total Points</div>
                     <div style={{ fontFamily: "Cinzel,serif", fontSize: 24, color: "var(--accent)", fontWeight: "bold" }}>{myLbEntry?.totalScore || 0}</div>
                   </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-muted">No profile data found. Please link your account or wait for officer approval.</div>
            )}
          </div>
        )}

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-title flex justify-between items-center">
            <span>🚨 Absence Watchlist</span>
            <span style={{ fontSize: 11, fontWeight: "normal", color: "var(--text-muted)" }}>Lifetime</span>
          </div>
          <p className="text-xs text-muted mb-4">Members with the highest total absences across all operations.</p>
          <div className="flex flex-col gap-3" style={{ maxHeight: "300px", overflowY: "auto", paddingRight: "4px" }}>
            {atRiskMembers.length > 0 ? atRiskMembers.map((m, idx) => (
               <div key={m.memberId} className="flex items-center justify-between p-2 rounded border border-white border-opacity-5" style={{ background: idx < 3 ? "rgba(224,80,80,0.05)" : "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-3">
                     <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: idx < 3 ? "var(--red)" : "var(--text-muted)", fontSize: 12 }}>
                       {idx + 1}
                     </div>
                     <div>
                       <div style={{ fontSize: 14, fontWeight: "bold", color: "white" }}>{m.ign}</div>
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
      </div>

      {/* SPLIT VIEW 2: HIGHLIGHTS & LOOT */}
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-title">📡 Guild Highlights</div>
          <div className="flex flex-col gap-3 mt-4">
            {activityFeed.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(240,192,64,0.05)", border: "1px solid rgba(240,192,64,0.15)" }}>
                <div style={{ fontSize: 20 }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    <span style={{ fontWeight: 800, color: "var(--gold)" }}>{item.member}</span> {item.text}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{item.date}</div>
                </div>
              </div>
            ))}
            {activityFeed.length === 0 && <div className="text-xs text-muted p-4 text-center">No recent MVP highlights.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-title flex justify-between items-center">
            <span>⭐ Active Loot Wishlist</span>
            <span style={{ fontSize: 11, fontWeight: "normal", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>Live Radar</span>
          </div>
          <div className="text-xs text-muted mt-1 mb-4">Items currently requested by members on their active wishlist.</div>
          
          <div className="flex flex-col gap-3">
             {wishlistRadar.length > 0 ? wishlistRadar.map(w => (
                <div key={w.type} className="p-3 rounded border border-white border-opacity-5" style={{ background: "rgba(0,0,0,0.2)" }}>
                   <div className="flex justify-between items-end mb-2">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 18 }}>{w.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: "bold", color: "var(--gold)" }}>{w.type}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 16, fontWeight: "bold", color: "var(--text-primary)" }}>{w.count}</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4, textTransform: "uppercase" }}>Demand</span>
                      </div>
                   </div>
                   <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4, wordWrap: "break-word" }}>
                     <span className="text-muted">Requested by: </span> {w.members.join(", ")}
                   </div>
                </div>
             )) : (
                <div className="text-center text-sm text-muted py-6">No items currently on wishlist.</div>
             )}
          </div>
        </div>
      </div>

      {/* ATTENDANCE TREND */}
      <div className="card mb-4" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div className="card-title">📈 Guild Attendance Trend</div>
        <div className="text-xs text-muted mt-1 mb-4">Tracking operation participation across the last 10 events.</div>
        <div style={{ flex: 1, minHeight: 250, width: "100%", marginLeft: -20, marginRight: -20 }}>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                domain={[0, 100]}
                dx={-10}
              />
              <Tooltip content={renderAttendanceTooltip} cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Area
                type="monotone"
                dataKey="attendance"
                stroke="var(--accent)"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorAtt)"
                animationDuration={1500}
                activeDot={{ r: 6, fill: "var(--accent)", stroke: "#fff", strokeWidth: 2, boxShadow: "0 0 10px var(--accent)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
