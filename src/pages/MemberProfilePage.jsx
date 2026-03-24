import React from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';

function MemberProfilePage({ member, onBack }) {
  const { members, events, attendance, performance, absences, eoRatings } = useGuild();
  if (!member) return null;

  const memberIdx = members.findIndex(m => m.memberId === member.memberId);
  const memberEvents = events.map(ev => {
    const att = attendance.find(a => a.memberId === member.memberId && a.eventId === ev.eventId);
    const perf = performance.find(p => p.memberId === member.memberId && p.eventId === ev.eventId);
    const eoRating = eoRatings.find(r => r.memberId === member.memberId && r.eventId === ev.eventId);
    const score = ev.eventType === "Guild League" && att?.status === "present"
      ? (perf?.ctfPoints || 0) + (perf?.performancePoints || 0) : 0;
    return { ...ev, att, perf, eoRating, score };
  }).sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));

  const glEvents = memberEvents.filter(e => e.eventType === "Guild League");
  const eoEvents = memberEvents.filter(e => e.eventType === "Emperium Overrun");
  const totalGLScore = glEvents.reduce((sum, e) => sum + e.score, 0);
  const presentCount = memberEvents.filter(e => e.att?.status === "present").length;
  const attPct = memberEvents.length > 0 ? Math.round((presentCount / memberEvents.length) * 100) : 0;
  const avgGL = glEvents.filter(e => e.att?.status === "present").length > 0
    ? Math.round((totalGLScore / glEvents.filter(e => e.att?.status === "present").length) * 10) / 10 : 0;
  const eoRatingsList = eoRatings.filter(r => r.memberId === member.memberId);
  const avgEoRating = eoRatingsList.length > 0
    ? Math.round((eoRatingsList.reduce((s, r) => s + r.rating, 0) / eoRatingsList.length) * 10) / 10 : 0;
  const memberAbsences = absences.filter(a => a.memberId === member.memberId);

  const attStatus = attPct >= 80 ? { label: "Reliable", badge: "badge-active" }
    : attPct >= 60 ? { label: "Average", badge: "badge-casual" }
    : { label: "At Risk", badge: "badge-atrisk" };

  let scoreClass = "At Risk";
  if (totalGLScore > 80) scoreClass = "Core";
  else if (totalGLScore >= 60) scoreClass = "Active";
  else if (totalGLScore >= 40) scoreClass = "Casual";
  const scoreClassBadge = { Core:"badge-core", Active:"badge-active", Casual:"badge-casual", "At Risk":"badge-atrisk" };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost" onClick={onBack}><Icon name="x" size={14}/> Back</button>
          <div>
            <h1 className="page-title">ðŸ‘¤ Member Profile</h1>
            <p className="page-subtitle">Full history and stats for {member.ign}</p>
          </div>
        </div>
      </div>

      {/* Header Card */}
      <div className="card" style={{marginBottom:20}}>
        <div className="flex items-center gap-4" style={{flexWrap:"wrap"}}>
          <MemberAvatar ign={member.ign} index={memberIdx} size={72} />
          <div style={{flex:1}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:22,fontWeight:700,color:"var(--text-primary)",marginBottom:8}}>{member.ign}</div>
            <div className="flex gap-2" style={{flexWrap:"wrap",marginBottom:6}}>
              <span className="text-secondary" style={{fontSize:14}}>{member.class}</span>
              <span className={`badge ${member.role==="DPS"?"badge-dps":"badge-support"}`}>
                {member.role==="DPS"?<Icon name="sword" size={10}/>:<Icon name="shield" size={10}/>} {member.role}
              </span>
              <span className={`badge ${attStatus.badge}`}>ðŸŽ¯ {attStatus.label}</span>
              <span className={`badge ${scoreClassBadge[scoreClass]}`}>âš” {scoreClass}</span>
            </div>
            <div className="text-xs text-muted">{member.memberId}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{marginBottom:20}}>
        <div className="stat-card" style={{"--stat-accent":"var(--gold)"}}>
          <div className="stat-icon">âš”</div>
          <div className="stat-label">GL Score</div>
          <div className="stat-value" style={{color:"var(--gold)"}}>{totalGLScore}</div>
          <div className="stat-change">all time total</div>
        </div>
        <div className="stat-card" style={{"--stat-accent": attPct>=75?"var(--green)":attPct>=50?"var(--gold)":"var(--red)"}}>
          <div className="stat-icon">ðŸ“‹</div>
          <div className="stat-label">Attendance</div>
          <div className="stat-value" style={{color: attPct>=75?"var(--green)":attPct>=50?"var(--gold)":"var(--red)"}}>{attPct}%</div>
          <div className="stat-change">{presentCount}/{memberEvents.length} events</div>
        </div>
        <div className="stat-card" style={{"--stat-accent":"var(--accent)"}}>
          <div className="stat-icon">ðŸ“Š</div>
          <div className="stat-label">Avg / GL</div>
          <div className="stat-value" style={{color:"var(--accent)"}}>{avgGL}</div>
          <div className="stat-change">per event attended</div>
        </div>
        <div className="stat-card" style={{"--stat-accent":"var(--gold)"}}>
          <div className="stat-icon">â­</div>
          <div className="stat-label">EO Rating</div>
          <div className="stat-value" style={{color:"var(--gold)"}}>{avgEoRating > 0 ? `â˜…${avgEoRating}` : "â€”"}</div>
          <div className="stat-change">avg stars Â· {eoRatingsList.length} rated</div>
        </div>
      </div>

      <div className="grid-2" style={{marginBottom:20}}>
        {/* Event History */}
        <div className="card" style={{gridColumn:"1/-1"}}>
          <div className="card-title">ðŸ“… Event History</div>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Date</th><th>Type</th><th>Status</th><th>CTF Breakdown</th><th>Perf Pts</th><th>Score / Rating</th>
              </tr></thead>
              <tbody>
                {memberEvents.length === 0 && (
                  <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-text">No events yet</div></div></td></tr>
                )}
                {memberEvents.map(ev => (
                  <tr key={ev.eventId}>
                    <td><span style={{fontFamily:"Cinzel,serif",fontSize:13}}>{ev.eventDate}</span></td>
                    <td>
                      <span className={`badge ${ev.eventType==="Guild League"?"badge-gl":"badge-eo"}`} style={{fontSize:10}}>
                        {ev.eventType==="Guild League"?"GL":"EO"}
                      </span>
                    </td>
                    <td>
                      <span style={{fontWeight:700,fontSize:13,color:ev.att?.status==="present"?"var(--green)":"var(--red)"}}>
                        {ev.att?.status==="present"?"âœ“ Present":"âœ— Absent"}
                      </span>
                    </td>
                    <td className="text-secondary">
                      {ev.eventType==="Guild League" && ev.att?.status==="present" ? (
                        <div>
                          <div style={{fontSize:12,color:"var(--text-muted)"}}>{ev.perf?.ctf1 ?? ev.perf?.ctfPoints ?? 0} + {ev.perf?.ctf2 ?? 0} + {ev.perf?.ctf3 ?? 0}</div>
                          <div style={{fontWeight:700,color:"var(--accent)",fontSize:13}}>= {(ev.perf?.ctf1 ?? ev.perf?.ctfPoints ?? 0) + (ev.perf?.ctf2 ?? 0) + (ev.perf?.ctf3 ?? 0)}</div>
                        </div>
                      ) : "â€”"}
                    </td>
                    <td className="text-secondary">
                      {ev.eventType==="Guild League" && ev.att?.status==="present" ? (ev.perf?.performancePoints ?? "â€”") : "â€”"}
                    </td>
                    <td>
                      {ev.eventType==="Guild League" && ev.att?.status==="present" ? (
                        <span style={{fontFamily:"Cinzel,serif",fontWeight:700,color:"var(--green)",fontSize:14}}>{ev.score}</span>
                      ) : ev.eventType==="Emperium Overrun" && ev.att?.status==="present" ? (
                        <span style={{color:"var(--gold)"}}>
                          {[1,2,3,4,5].map(s => (
                            <span key={s} style={{fontSize:14,color:s<=(ev.eoRating?.rating||0)?"var(--gold)":"rgba(99,130,230,0.2)"}}>â˜…</span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted">â€”</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Absence Records */}
      <div className="card">
        <div className="card-title">âš  Absence Records ({memberAbsences.length})</div>
        {memberAbsences.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">âœ…</div>
            <div className="empty-state-text">No absences on record</div>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {memberAbsences.slice().reverse().map((a, i) => (
              <div key={a.id||i} style={{
                display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
                background:"rgba(224,80,80,0.05)",borderRadius:10,
                border:"1px solid rgba(224,80,80,0.2)"
              }}>
                <span style={{fontSize:18}}>âš </span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:"var(--red)",marginBottom:2}}>
                    {a.eventDate} Â· {a.eventType}
                  </div>
                  <div className="text-xs text-secondary" style={{fontStyle:"italic"}}>"{a.reason}"</div>
                </div>
                <span style={{fontSize:12,color:a.onlineStatus==="Yes"?"var(--green)":"var(--text-muted)"}}>
                  Online: {a.onlineStatus}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberProfilePage;
