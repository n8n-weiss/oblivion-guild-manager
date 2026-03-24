import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { computeScore, computeLeaderboard } from '../utils/scoring';

function Dashboard() {
  const { members, events, attendance, performance } = useGuild();
  const lb = useMemo(() => computeLeaderboard(members, events, attendance, performance), [members, events, attendance, performance]);
  const totalPresences = attendance.filter(a => a.status === "present").length;
  const totalExpected = attendance.length;
  const attRate = totalExpected ? Math.round((totalPresences / totalExpected) * 100) : 0;
  const activeMembers = lb.filter(m => m.classification === "Core" || m.classification === "Active").length;
  const top5 = lb.slice(0, 5);

  const avatarColors = ["#6382e6","#e05c8a","#40c97a","#f0c040","#a78bfa","#38bdf8","#fb923c","#f472b6","#34d399","#fbbf24"];

  // Score distribution for bar chart
  const maxScore = Math.max(...lb.map(m => m.totalScore), 1);

  // Role distribution
  const dpsCount = members.filter(m => m.role === "DPS").length;
  const supCount = members.filter(m => m.role === "Support").length;
  const total = members.length || 1;

  // Recent events for trend
  const recentEvents = events.slice(-5);

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="page-title">âš” Dashboard</h1>
        </div>
        <p className="page-subtitle">Guild overview & performance at a glance</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card" style={{"--stat-accent":"var(--accent)"}}>
          <div className="stat-icon">âš”</div>
          <div className="stat-label">Total Members</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{members.length}</div>
          <div className="stat-change">Registered guild members</div>
          <div className={`stat-trend ${members.length >= 10 ? "stat-trend-up" : "stat-trend-neutral"}`}>
            {members.length >= 10 ? "â–²" : "â—"} {members.length >= 10 ? "Full roster" : "Recruiting"}
          </div>
        </div>
        <div className="stat-card" style={{"--stat-accent":"var(--green)"}}>
          <div className="stat-icon">ðŸ›¡</div>
          <div className="stat-label">Reliable Members</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>{lb.filter(m=>m.attStatus?.label==="Reliable").length}</div>
          <div className="stat-change">80%+ attendance Â· {lb.filter(m=>m.classification==="Core"||m.classification==="Active").length} high scorers</div>
          <div className={`stat-trend ${lb.filter(m=>m.attStatus?.label==="Reliable").length / members.length >= 0.5 ? "stat-trend-up" : "stat-trend-down"}`}>
            {lb.filter(m=>m.attStatus?.label==="Reliable").length / members.length >= 0.5 ? "â–²" : "â–¼"} {members.length > 0 ? Math.round(lb.filter(m=>m.attStatus?.label==="Reliable").length/members.length*100) : 0}% of roster
          </div>
        </div>
        <div className="stat-card" style={{"--stat-accent": attRate >= 75 ? "var(--green)" : attRate >= 50 ? "var(--gold)" : "var(--red)"}}>
          <div className="stat-icon">ðŸ“‹</div>
          <div className="stat-label">Attendance Rate</div>
          <div className="stat-value" style={{ color: attRate >= 75 ? "var(--green)" : attRate >= 50 ? "var(--gold)" : "var(--red)" }}>{attRate}%</div>
          <div className="stat-change">All events combined</div>
          <div className={`stat-trend ${attRate >= 75 ? "stat-trend-up" : attRate >= 50 ? "stat-trend-neutral" : "stat-trend-down"}`}>
            {attRate >= 75 ? "â–² Excellent" : attRate >= 50 ? "â— Good" : "â–¼ Needs work"}
          </div>
        </div>
        <div className="stat-card" style={{"--stat-accent":"var(--gold)"}}>
          <div className="stat-icon">ðŸ†</div>
          <div className="stat-label">Total Events</div>
          <div className="stat-value" style={{ color: "var(--gold)" }}>{events.length}</div>
          <div className="stat-change">{events.filter(e=>e.eventType==="Guild League").length} GL Â· {events.filter(e=>e.eventType==="Emperium Overrun").length} EO</div>
          <div className="stat-trend stat-trend-neutral">
            â— This season
          </div>
        </div>
      </div>

      <div className="grid-2 mb-4">
        {/* Top 5 Players */}
        <div className="card">
          <div className="card-title">ðŸ† Top Players</div>
          {top5.map((p, i) => (
            <div className="top-player" key={p.memberId}>
              <div className="player-avatar" style={{ background: `${avatarColors[i % avatarColors.length]}22`, color: avatarColors[i % avatarColors.length] }}>
                {p.ign[0]}
              </div>
              <div className="player-info">
                <div className="player-ign">
                  {i === 0 && <span className="text-gold">ðŸ‘‘ </span>}
                  {p.ign}
                </div>
                <div className="player-class">{p.class}</div>
              </div>
              <div>
                <div className="player-score" style={{ color: avatarColors[i % avatarColors.length] }}>{p.totalScore}</div>
                <div className="text-xs text-muted text-right">{p.attendancePct}% att</div>
              </div>
            </div>
          ))}
        </div>

        {/* Score Distribution Bar Chart */}
        <div className="card">
          <div className="card-title">ðŸ“Š Score Distribution</div>
          <div className="chart-bars" style={{ marginTop: 12 }}>
            {lb.map((m, i) => {
              const pct = Math.max(2, (m.totalScore / maxScore) * 100);
              const clrMap = { Core: "var(--gold)", Active: "var(--green)", Casual: "var(--accent)", "At Risk": "var(--red)" };
              return (
                <div className="chart-bar-wrap" key={m.memberId} style={{ position: "relative" }}>
                  <div className="chart-bar" style={{ height: `${pct}%`, background: clrMap[m.classification] || "var(--accent)", opacity: 0.85 }}>
                    <span className="chart-label">{m.ign.split(" ")[0]}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 mt-2" style={{ flexWrap: "wrap" }}>
            {[["Core",  "var(--gold)"], ["Active","var(--green)"],["Casual","var(--accent)"],["At Risk","var(--red)"]].map(([k,c]) => (
              <div className="flex items-center gap-1 text-xs text-muted" key={k}>
                <div style={{ width:8,height:8,borderRadius:2,background:c }}/>
                {k}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Role Distribution + Class Breakdown */}
        <div className="card">
          <div className="card-title">âš” Role Distribution</div>
          <div className="flex items-center gap-4" style={{ marginTop: 12 }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="40" fill="none" stroke="rgba(99,130,230,0.08)" strokeWidth="18"/>
              <circle cx="55" cy="55" r="40" fill="none" stroke="var(--accent2)" strokeWidth="18"
                strokeDasharray={`${(dpsCount/total)*251} 251`} strokeDashoffset="0"
                transform="rotate(-90 55 55)" strokeLinecap="butt"/>
              <circle cx="55" cy="55" r="40" fill="none" stroke="var(--accent)" strokeWidth="18"
                strokeDasharray={`${(supCount/total)*251} 251`} strokeDashoffset={`${-(dpsCount/total)*251}`}
                transform="rotate(-90 55 55)" strokeLinecap="butt"/>
              <text x="55" y="52" textAnchor="middle" fill="var(--text-primary)" style={{fontFamily:"Cinzel,serif",fontSize:13,fontWeight:700}}>{total}</text>
              <text x="55" y="66" textAnchor="middle" fill="var(--text-muted)" style={{fontSize:10}}>members</text>
            </svg>
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div style={{width:10,height:10,borderRadius:2,background:"var(--accent2)"}}/>
                  <span className="text-xs" style={{color:"var(--text-secondary)"}}>DPS</span>
                </div>
                <div className="font-cinzel" style={{fontSize:22,color:"var(--accent2)"}}>{dpsCount} <span className="text-xs text-muted">({Math.round(dpsCount/total*100)}%)</span></div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div style={{width:10,height:10,borderRadius:2,background:"var(--accent)"}}/>
                  <span className="text-xs" style={{color:"var(--text-secondary)"}}>Support</span>
                </div>
                <div className="font-cinzel" style={{fontSize:22,color:"var(--accent)"}}>{supCount} <span className="text-xs text-muted">({Math.round(supCount/total*100)}%)</span></div>
              </div>
            </div>
          </div>

          {/* Class Breakdown */}
          <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid var(--border)"}}>
            <div className="card-title" style={{marginBottom:12}}>ðŸŽ­ Class Breakdown</div>
            {(() => {
              const ALL_CLASSES = [
                {name:"Lord Knight", role:"DPS"},
                {name:"Assassin Cross", role:"DPS"},
                {name:"Sniper", role:"DPS"},
                {name:"High Wizard", role:"DPS"},
                {name:"Stalker", role:"DPS"},
                {name:"Whitesmith", role:"DPS"},
                {name:"Champion", role:"DPS"},
                {name:"High Priest", role:"Support"},
                {name:"Paladin", role:"Support"},
                {name:"Professor", role:"Support"},
                {name:"Creator", role:"Support"},
                {name:"Minstrel", role:"Support"},
                {name:"Diva", role:"Support"},
              ];
              const classCounts = ALL_CLASSES.map(c => ({
                ...c,
                count: members.filter(m => m.class === c.name).length
              })).filter(c => c.count > 0);
              const maxCount = Math.max(...classCounts.map(c => c.count), 1);
              return (
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {classCounts.length === 0 && (
                    <div className="text-xs text-muted">No class data yet.</div>
                  )}
                  {classCounts.map(c => (
                    <div key={c.name} style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:c.role==="DPS"?"var(--accent2)":"var(--accent)",flexShrink:0}}/>
                      <span style={{fontSize:12,color:"var(--text-secondary)",width:130,flexShrink:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</span>
                      <div style={{flex:1,height:6,background:"rgba(99,130,230,0.08)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{
                          height:"100%",
                          width:`${(c.count/maxCount)*100}%`,
                          background:c.role==="DPS"?"var(--accent2)":"var(--accent)",
                          borderRadius:3,
                          transition:"width 0.5s ease",
                          boxShadow:c.role==="DPS"?"0 0 6px rgba(224,92,138,0.4)":"0 0 6px rgba(99,130,230,0.4)"
                        }}/>
                      </div>
                      <span style={{fontSize:12,fontWeight:700,color:"var(--text-primary)",minWidth:16,textAlign:"right"}}>{c.count}</span>
                    </div>
                  ))}
                  {classCounts.length > 0 && (
                    <div style={{marginTop:6,display:"flex",gap:12}}>
                      <span style={{fontSize:11,color:"var(--accent2)"}}>â— DPS classes</span>
                      <span style={{fontSize:11,color:"var(--accent)"}}>â— Support classes</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Recent Events */}
        <div className="card">
          <div className="card-title">ðŸ“… Recent Events</div>
          <div style={{ marginTop: 8 }}>
            {events.slice(-5).reverse().map(ev => {
              const evAtt = attendance.filter(a => a.eventId === ev.eventId);
              const present = evAtt.filter(a => a.status === "present").length;
              const absent = evAtt.length - present;
              const pct = evAtt.length ? Math.round((present / evAtt.length) * 100) : 0;
              const isGL = ev.eventType === "Guild League";
              const barColor = pct >= 75 ? "var(--green)" : pct >= 50 ? "var(--gold)" : "var(--red)";
              const barGlow = pct >= 75 ? "rgba(64,201,122,0.5)" : pct >= 50 ? "rgba(240,192,64,0.5)" : "rgba(224,80,80,0.5)";

              // top scorer for this event
              const evPerf = performance.filter(p => p.eventId === ev.eventId);
              let topScorer = null;
              let topScore = -Infinity;
              evPerf.forEach(p => {
                const member = members.find(m => m.memberId === p.memberId);
                const att = evAtt.find(a => a.memberId === p.memberId);
                const s = computeScore({ event: ev, att, perf: p });
                if (s > topScore) { topScore = s; topScorer = member; }
              });

              return (
                <div key={ev.eventId} style={{padding:"14px 0", borderBottom:"1px solid var(--border)"}}>
                  {/* Header row */}
                  <div className="flex items-center justify-between" style={{marginBottom:10}}>
                    <div className="flex items-center gap-3">
                      <div style={{
                        width:38,height:38,borderRadius:8,
                        background: isGL ? "rgba(240,192,64,0.12)" : "rgba(99,130,230,0.12)",
                        border: `1px solid ${isGL ? "rgba(240,192,64,0.3)" : "rgba(99,130,230,0.3)"}`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:18,flexShrink:0
                      }}>
                        {isGL ? "âš”" : "ðŸ°"}
                      </div>
                      <div>
                        <div style={{fontSize:15,fontWeight:700,color:"var(--text-primary)"}}>{ev.eventDate}</div>
                        <div style={{fontSize:12,color:"var(--text-muted)"}}>{ev.eventType}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Attendance count badge */}
                      <div style={{textAlign:"center"}}>
                        <div style={{fontFamily:"Cinzel,serif",fontSize:20,fontWeight:700,color:barColor,lineHeight:1}}>{present}</div>
                        <div style={{fontSize:10,color:"var(--text-muted)",letterSpacing:1}}>/ {evAtt.length}</div>
                      </div>
                      {/* Pct badge */}
                      <div style={{
                        padding:"4px 12px",borderRadius:20,
                        background: pct>=75?"rgba(64,201,122,0.15)":pct>=50?"rgba(240,192,64,0.15)":"rgba(224,80,80,0.15)",
                        border:`1px solid ${barColor}44`,
                        color:barColor,fontSize:14,fontWeight:700,fontFamily:"Cinzel,serif"
                      }}>{pct}%</div>
                    </div>
                  </div>

                  {/* Progress bar â€” thicker with glow */}
                  <div style={{height:10,background:"rgba(99,130,230,0.08)",borderRadius:5,overflow:"hidden",marginBottom:8}}>
                    <div style={{
                      height:"100%",
                      width:`${pct}%`,
                      borderRadius:5,
                      background:barColor,
                      boxShadow:`0 0 10px ${barGlow}`,
                      transition:"width 0.6s ease"
                    }}/>
                  </div>

                  {/* Bottom row â€” absent count + top scorer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span style={{fontSize:12,color:"var(--green)"}}>âœ“ {present} present</span>
                      <span style={{fontSize:12,color:"var(--red)"}}>âœ— {absent} absent</span>
                    </div>
                    {topScorer && (
                      <div className="flex items-center gap-2">
                        <span style={{fontSize:11,color:"var(--text-muted)"}}>Top:</span>
                        <span style={{fontSize:12,fontWeight:700,color:"var(--gold)"}}>â­ {topScorer.ign}</span>
                        <span style={{fontSize:11,color:"var(--text-muted)"}}>+{topScore}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {events.length === 0 && <div className="text-muted text-sm" style={{padding:"16px 0"}}>No events yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
