import React, { useMemo } from 'react';
import { useGuild } from '../../context/GuildContext';

const MemberStatus = ({ rankNum, totalScore }) => {
  const { members, myMemberId } = useGuild();

  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);
  const myProfile = useMemo(() => activeMembers.find(m => m.memberId === myMemberId), [activeMembers, myMemberId]);

  return (
    <div className="card" style={{
      border: "1px solid rgba(99,130,230,0.3)",
      background: "linear-gradient(180deg, rgba(99,130,230,0.1) 0%, rgba(10, 15, 25, 0.6) 100%)",
      backdropFilter: "blur(12px)",
      boxShadow: "0 8px 32px 0 rgba(99, 130, 230, 0.1)"
    }}>
      <div className="card-title text-accent flex items-center justify-between">
        <span style={{ textShadow: "0 0 10px rgba(99,130,230,0.5)" }}>👤 My Guild Status</span>
        <span style={{ fontSize: 10, background: "rgba(99,130,230,0.3)", padding: '2px 8px', borderRadius: 8, color: "var(--accent)", border: "1px solid rgba(99,130,230,0.4)" }}>MEMBER</span>
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
             <div style={{ background: "rgba(0,0,0,0.4)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", transition: "background 0.2s ease" }}>
               <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Guild Rank</div>
               <div style={{ fontFamily: "Cinzel,serif", fontSize: 24, color: "var(--gold)", fontWeight: "bold", textShadow: "0 0 10px rgba(240,192,64,0.5)" }}>#{rankNum}</div>
             </div>
             <div style={{ background: "rgba(0,0,0,0.4)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", transition: "background 0.2s ease" }}>
               <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Total Points</div>
               <div style={{ fontFamily: "Cinzel,serif", fontSize: 24, color: "var(--accent)", fontWeight: "bold", textShadow: "0 0 10px rgba(99,130,230,0.5)" }}>{totalScore}</div>
             </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-muted">No profile data found. Please link your account or wait for officer approval.</div>
      )}
    </div>
  );
};

export default MemberStatus;
