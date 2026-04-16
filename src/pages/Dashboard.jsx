import React, { useMemo } from 'react';
import { useGuild } from '../context/GuildContext';
import { computeLeaderboard } from '../utils/scoring';
import StatsGrid from '../components/common/StatsGrid';
import OfficerHub from '../components/common/OfficerHub';
import MemberStatus from '../components/common/MemberStatus';
import AbsenceWatchlist from '../components/common/AbsenceWatchlist';
import GuildHighlights from '../components/common/GuildHighlights';
import LootRadar from '../components/common/LootRadar';
import AttendanceTrend from '../components/common/AttendanceTrend';

function Dashboard() {
  const {
    members, events, attendance, performance, onlineUsers = [],
    myMemberId, isOfficer
  } = useGuild();

  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);
  const lb = useMemo(() => computeLeaderboard(activeMembers, events, attendance, performance), [activeMembers, events, attendance, performance]);

  // Guild Level and XP Calculation
  const totalGuildScore = lb.reduce((sum, m) => sum + (m.totalScore || 0), 0);
  const guildLevel = Math.max(1, Math.floor(Math.sqrt(totalGuildScore / 10)));
  const nextLevelXP = Math.pow(guildLevel + 1, 2) * 10;
  const currentLevelXP = Math.pow(guildLevel, 2) * 10;
  const xpProgress = Math.min(100, Math.round(((totalGuildScore - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100));

  const myLbEntry = useMemo(() => lb.find(l => l.memberId === myMemberId), [lb, myMemberId]);
  const myRankNum = useMemo(() => lb.findIndex(l => l.memberId === myMemberId) + 1, [lb, myMemberId]);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 40 }}>
      {/* HEADER SECTION */}
      <div className="section-header">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="page-title">📊 Dashboard</h1>
            {onlineUsers.length > 0 && (
              <div className="badge badge-active">
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 8px var(--green)" }}></span>
                {onlineUsers.length} ONLINE
              </div>
            )}
          </div>
          <p className="page-subtitle">Guild command center & performance at a glance</p>
        </div>
        <div className="guild-xp-container">
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
      <StatsGrid />

      {/* MAIN WIDGETS GRID */}
      <div className="grid-2 mb-4">
        {isOfficer ? (
          <OfficerHub />
        ) : (
          <MemberStatus rankNum={myRankNum} totalScore={myLbEntry?.totalScore || 0} />
        )}
        <AbsenceWatchlist />
      </div>

      <div className="grid-2 mb-4">
        <GuildHighlights />
        <LootRadar />
      </div>

      {/* ATTENDANCE TREND */}
      <AttendanceTrend />
    </div>
  );
}

export default Dashboard;
