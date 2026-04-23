import React from 'react';
import { useGuild } from '../../context/GuildContext';
import Icon from '../ui/icons';

const OfficerHub = () => {
  const { requests, joinRequests, absences, events } = useGuild();

  const pendingJoin = joinRequests.filter(r => r.status === "pending").length;
  const pendingProfile = requests.filter(r => r.status === "pending").length;
  const upcomingAbsences = absences.filter(a => new Date(a.date) >= new Date()).length;
  const pendingAudits = events.filter(ev => ev.battlelogAudit && ev.battlelogAudit.status === "pending");

  return (
    <>
      <div className="card" style={{
        border: "1px solid rgba(224,92,138,0.3)",
        background: "linear-gradient(180deg, rgba(224,92,138,0.1) 0%, rgba(10, 15, 25, 0.6) 100%)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px 0 rgba(224, 92, 138, 0.1)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease"
      }}>
        <div className="card-title text-accent2 flex items-center justify-between">
          <span style={{ textShadow: "0 0 10px rgba(224,92,138,0.5)" }}>🛡️ Officer Action Center</span>
          <span style={{ fontSize: 10, background: "rgba(224,92,138,0.3)", padding: '2px 8px', borderRadius: 8, color: "var(--accent2)", border: "1px solid rgba(224,92,138,0.4)" }}>ADMIN</span>
        </div>
        <div className="flex flex-col gap-2 mt-3">
          <div className="flex justify-between items-center p-2 rounded border border-white border-opacity-5" style={{ background: "rgba(0,0,0,0.4)", transition: "background 0.2s ease" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>New Applications</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${pendingJoin > 0 ? "text-white" : "text-muted"}`} style={{ background: pendingJoin > 0 ? "var(--accent)" : "transparent", boxShadow: pendingJoin > 0 ? "0 0 8px var(--accent)" : "none" }}>{pendingJoin} Pending</span>
          </div>
          <div className="flex justify-between items-center p-2 rounded border border-white border-opacity-5" style={{ background: "rgba(0,0,0,0.4)", transition: "background 0.2s ease" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Profile Updates</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${pendingProfile > 0 ? "text-white" : "text-muted"}`} style={{ background: pendingProfile > 0 ? "var(--accent2)" : "transparent", boxShadow: pendingProfile > 0 ? "0 0 8px var(--accent2)" : "none" }}>{pendingProfile} Unread</span>
          </div>
          <div className="flex justify-between items-center p-2 rounded border border-white border-opacity-5" style={{ background: "rgba(0,0,0,0.4)", transition: "background 0.2s ease" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Upcoming Absences</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${upcomingAbsences > 0 ? "text-black" : "text-muted"}`} style={{ background: upcomingAbsences > 0 ? "var(--gold)" : "transparent", boxShadow: upcomingAbsences > 0 ? "0 0 8px var(--gold)" : "none" }}>{upcomingAbsences} Filed</span>
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

        {pendingJoin === 0 && pendingProfile === 0 && upcomingAbsences === 0 && pendingAudits.length === 0}
      </div>


    </>
  );
};

export default OfficerHub;
