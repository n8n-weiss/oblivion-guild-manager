import React, { useState } from 'react';
import { useGuild } from '../../context/GuildContext';
import Icon from '../ui/icons';

const OfficerHub = () => {
  const { requests, joinRequests, absences, events, resetMonthlyScores } = useGuild();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

        <div className="mt-4 pt-3 border-t border-white border-opacity-10 flex flex-col gap-2">
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }} className="flex items-center gap-2">
            Maintenance
            {(() => {
              const now = new Date();
              const day = now.getDate();
              return (day >= 1 && day <= 10) ? (
                <span className="flex items-center gap-1 text-[10px] text-green-400 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span>
                  Reset Window Open
                </span>
              ) : null;
            })()}
          </div>
          {(() => {
            const now = new Date();
            const day = now.getDate();
            const isWindowOpen = day >= 1 && day <= 10;

            return (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => isWindowOpen ? setShowResetConfirm(true) : alert("Monthly reset is only available from the 1st to the 10th of the month.")}
                  className={`w-full py-1.5 px-3 rounded text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 border border-white border-opacity-10 ${isWindowOpen ? 'hover:bg-white hover:bg-opacity-10 shadow-[0_0_10px_rgba(224,92,138,0.2)]' : 'opacity-50 cursor-not-allowed'}`}
                  style={{ color: "var(--text-primary)", background: "rgba(0,0,0,0.3)" }}
                  disabled={!isWindowOpen}
                >
                  <span className={isWindowOpen ? 'animate-spin-slow' : ''}>🔄</span> Reset Monthly Data
                </button>
                <div className={`text-[10px] text-center ${isWindowOpen ? 'text-green-400' : 'text-muted'} italic`}>
                  {isWindowOpen ? "🟢 Reset window is currently open." : "🔒 Reset window opens on the 1st of every month."}
                </div>
              </div>
            );
          })()}
        </div>

        {(pendingJoin === 0 && pendingProfile === 0 && upcomingAbsences === 0 && pendingAudits.length === 0) && (
           <div className="mt-4 text-xs text-center text-muted">All clear. No pending administrative actions.</div>
        )}
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="card max-w-md w-full p-6 text-center border border-white border-opacity-20" style={{ background: "rgba(15, 20, 30, 0.9)", borderRadius: 16 }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
            <div className="text-lg font-bold text-white mb-2">Confirm Monthly Reset</div>
            <div className="text-sm text-muted mb-6 leading-relaxed">
              This will <b>archive attendance</b> for the current month and <b>completely clear</b> all performance scores and EO ratings. <br/><br/>
              This action cannot be undone.
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded text-xs font-bold text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowResetConfirm(false);
                  await resetMonthlyScores();
                }}
                className="px-4 py-2 rounded text-xs font-bold text-white transition-all"
                style={{ background: "var(--accent)", boxShadow: "0 0 12px var(--accent)" }}
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OfficerHub;
