import React, { useMemo, useState } from 'react';
import { useGuild } from '../context/GuildContext';
import { JOB_CLASSES } from '../utils/constants';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { writeAuditLog } from "./AuditLogPage";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';

function MemberProfilePage({ member, onBack, isOwnProfile }) {
  const { 
    members, events, attendance, performance, absences, eoRatings, 
    notifications, markNotifRead,
    isMember, myMemberId, isArchitect, setAbsences, setMembers, showToast, currentUser 
  } = useGuild();
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({
    eventType: "Guild League",
    eventDate: new Date().toISOString().split("T")[0],
    reason: "",
    onlineStatus: "No"
  });
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState(member.bio || "");
  const [tempSocial, setTempSocial] = useState({
    discord: member.discord || "",
    motto: member.motto || "",
    joinDate: member.joinDate || ""
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [collapsed, setCollapsed] = useState({});

  if (!member) return null;

  // Security: Members can only see their own profile
  if (isMember && member.memberId !== myMemberId) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
        <h2 className="page-title">Access Denied</h2>
        <p className="text-muted">You are only permitted to view your own performance profile.</p>
        <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Return to My Profile</button>
      </div>
    );
  }

  const memberIdx = members.findIndex(m => m.memberId === member.memberId);
  const memberEvents = events.map(ev => {
    const att = attendance.find(a => a.memberId === member.memberId && a.eventId === ev.eventId);
    const perf = performance.find(p => p.memberId === member.memberId && p.eventId === ev.eventId);
    const eoRating = eoRatings.find(r => r.memberId === member.memberId && r.eventId === ev.eventId);
    const score = ev.eventType === "Guild League" && att?.status === "present"
      ? (perf?.ctfPoints || 0) + (perf?.performancePoints || 0) : 0;
    return { ...ev, att, perf, eoRating, score };
  }).sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate))
    .filter(e => !member.joinDate || new Date(e.eventDate) >= new Date(member.joinDate));

  const glEvents = memberEvents.filter(e => e.eventType === "Guild League");
  const eoEvents = memberEvents.filter(e => e.eventType === "Emperium Overrun");
  const memberAbsences = absences.filter(a => a.memberId === member.memberId);
  const myNotifs = notifications.filter(n => n.targetId === "all" || n.targetId === member.memberId);
  const unreadCount = myNotifs.filter(n => !n.isRead && n.targetId !== "all").length;
  
  const totalGLScore = glEvents.reduce((sum, e) => sum + e.score, 0);
  const presentCount = memberEvents.filter(e => e.att?.status === "present").length;
  const attPct = memberEvents.length > 0 ? Math.round((presentCount / memberEvents.length) * 100) : 0;
  const avgGL = glEvents.filter(e => e.att?.status === "present").length > 0
    ? Math.round((totalGLScore / glEvents.filter(e => e.att?.status === "present").length) * 10) / 10 : 0;
  const eoRatingsList = eoRatings.filter(r => r.memberId === member.memberId);
  const avgEoRating = eoRatingsList.length > 0
    ? Math.round((eoRatingsList.reduce((s, r) => s + r.rating, 0) / eoRatingsList.length) * 10) / 10 : 0;

  // --- NEW CALCULATIONS ---
  // 1. Guild Average GL
  const activeMembers = members.filter(m => (m.status || "active") === "active");
  const guildTotalGL = activeMembers.reduce((sum, m) => {
    const mEvents = events.filter(e => e.eventType === "Guild League");
    const mScore = mEvents.reduce((s, e) => {
      const att = attendance.find(a => a.memberId === m.memberId && a.eventId === e.eventId);
      const perf = performance.find(p => p.memberId === m.memberId && p.eventId === e.eventId);
      return s + (att?.status === "present" ? (perf?.ctfPoints || 0) + (perf?.performancePoints || 0) : 0);
    }, 0);
    return sum + mScore;
  }, 0);
  const guildAvgGL = activeMembers.length > 0 ? Math.round(guildTotalGL / activeMembers.length) : 0;

  // 2. Trend Logic (Last 3 vs Previous)
  const glScores = glEvents.filter(e => e.att?.status === "present").map(e => e.score);
  const currentAvg = glScores.slice(0, 3).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(3, glScores.length));
  const prevAvg = glScores.slice(3, 6).length > 0 ? glScores.slice(3, 6).reduce((a, b) => a + b, 0) / glScores.slice(3, 6).length : currentAvg;
  const glTrend = currentAvg > prevAvg ? "up" : currentAvg < prevAvg ? "down" : "stable";

  // 3. Badges Logic
  const badges = [];
  if (totalGLScore >= 80) badges.push({ icon: "🔥", label: "War Hero", color: "var(--color-assassin)" });
  if (attPct === 100 && memberEvents.length >= 5) badges.push({ icon: "🛡️", label: "Iron Wall", color: "var(--color-knight)" });
  if (avgGL > (guildAvgGL / (activeMembers.length || 1)) + 5) badges.push({ icon: "⚡", label: "Clutch", color: "var(--accent)" });
  if (eoRatingsList.length >= 3 && avgEoRating >= 4.5) badges.push({ icon: "⭐", label: "MVP", color: "var(--color-priest)" });

  // 4. Class Theme & Icon
  const classThemes = useMemo(() => {
    const themes = {};
    JOB_CLASSES.forEach(branch => {
      branch.jobs.forEach(job => {
        themes[job.name] = { color: job.color, icon: job.emoji };
      });
    });
    // Fallbacks
    themes["Professor"] = { color: "var(--color-priest)", icon: "📖" };
    themes["Whitesmith"] = { color: "var(--color-blacksmith)", icon: "🔨" };
    themes["Creator"] = { color: "var(--color-blacksmith)", icon: "🧪" };
    return themes;
  }, []);
  const theme = classThemes[member.class] || { color: "var(--color-others)", icon: "👤" };

  const attStatus = attPct >= 80 ? { label: "Reliable", badge: "badge-active" }
    : attPct >= 60 ? { label: "Average", badge: "badge-casual" }
      : { label: "At Risk", badge: "badge-atrisk" };

  let scoreClass = "At Risk";
  if (totalGLScore > 80) scoreClass = "Core";
  else if (totalGLScore >= 60) scoreClass = "Active";
  else if (totalGLScore >= 40) scoreClass = "Casual";
  const scoreClassBadge = { Core: "badge-core", Active: "badge-active", Casual: "badge-casual", "At Risk": "badge-atrisk" };

  // Support-specific stats
  const isSupport = member.role === "Support";
  // SPI: Support Performance Index (0–100)
  const supportIndex = Math.round((attPct * 0.5) + (avgEoRating * 10));
  // Pillar Score (SPI - Absence Penalties)
  const pillarScore = Math.max(0, Math.round(supportIndex - (memberAbsences.length * 5)));

  // 5. RPG Rankings & Levels
  const getRankInfo = (score) => {
    if (score >= 200) return { rank: "LEGEND", label: "Mythic Vanguard", color: "#ff4d4d" };
    if (score >= 150) return { rank: "ELITE", label: "Heroic Knight", color: "#ffcc00" };
    if (score >= 100) return { rank: "VETERAN", label: "Experienced Hero", color: "#33cc33" };
    if (score >= 50) return { rank: "SOLDIER", label: "Guild Soldier", color: "#4db8ff" };
    return { rank: "NOVICE", label: "Initiate Hero", color: "#999999" };
  };
  const rankInfo = getRankInfo(totalGLScore);
  const level = Math.max(1, Math.floor(Math.sqrt(totalGLScore * 5)));
  const nextLevelScore = Math.pow((level + 1) / 5, 2);
  const prevLevelScore = Math.pow(level / 5, 2);
  const levelProgress = Math.min(100, Math.round(((totalGLScore - prevLevelScore) / (nextLevelScore - prevLevelScore || 1)) * 100));

  // 6. Radar Chart Comparison
  const radarData = [
    { subject: 'GL Score', A: totalGLScore, B: guildAvgGL, fullMark: Math.max(totalGLScore, guildAvgGL, 100) },
    { subject: 'Attendance', A: attPct, B: 75, fullMark: 100 },
    { subject: 'Avg GL', A: avgGL * 10, B: (guildAvgGL / 10) * 10, fullMark: 100 },
    { subject: 'Reliability', A: 100 - (memberAbsences.length * 10), B: 90, fullMark: 100 },
    { subject: 'EO Skill', A: avgEoRating * 20, B: 70, fullMark: 100 },
  ];

  // 7. Next Event Logic
  const upcomingEvent = events
    .filter(ev => new Date(ev.eventDate) >= new Date().setHours(0, 0, 0, 0))
    .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))[0];
  const pastEvent = events
    .filter(ev => new Date(ev.eventDate) < new Date().setHours(0, 0, 0, 0))
    .sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate))[0];
  const nextEvent = upcomingEvent || pastEvent;
  const isUpcoming = !!upcomingEvent;

  const quickAbsence = () => {
    if (!nextEvent) return;
    const id = `ABS${Date.now()}`;
    const newAbsence = {
      id,
      memberId: member.memberId,
      eventType: nextEvent.eventType,
      eventDate: nextEvent.eventDate,
      reason: "Quick-filed from portal (Busy)",
      onlineStatus: "No"
    };
    setAbsences(prev => [...prev, newAbsence]);
    showToast(`Absence filed for ${nextEvent.eventDate}`, "success");
    // writeAuditLog removed (member-initiated)
  };

  // 8. Performance Summary
  const attendedGLEvents = glEvents.filter(e => e.att?.status === "present");
  const bestEvent = attendedGLEvents.reduce((best, e) => (!best || e.score > best.score ? e : best), null);
  const worstEvent = attendedGLEvents.reduce((worst, e) => (!worst || e.score < worst.score ? e : worst), null);
  // Win streak: consecutive events attended (most recent first)
  let winStreak = 0;
  for (const ev of memberEvents) {
    if (ev.att?.status === "present") winStreak++;
    else break;
  }
  const toggleCollapse = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const chartData = useMemo(() => {
    return [...memberEvents].reverse().map(ev => ({
      date: ev.eventDate.split('-').slice(1).join('/'), // Concise date
      fullDate: ev.eventDate,
      score: ev.eventType === "Guild League" ? ev.score : null,
      rating: ev.eventType === "Emperium Overrun" ? ev.eoRating?.rating : null,
      present: ev.att?.status === "present",
      type: ev.eventType
    }));
  }, [memberEvents]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="card shadow-xl" style={{ border: "1px solid var(--border)", padding: "10px", background: "rgba(10, 15, 25, 0.95)", backdropFilter: "blur(8px)" }}>
          <p className="text-xs text-muted mb-1">{data.fullDate}</p>
          <p className="font-cinzel text-sm mb-1" style={{ color: data.type === "Guild League" ? "var(--accent)" : "var(--gold)" }}>
            {data.type}
          </p>
          {data.score !== null && (
            <p className="text-sm font-bold" style={{ color: "var(--green)" }}>
              Score: {data.score}
            </p>
          )}
          {data.rating !== null && (
            <p className="text-sm font-bold" style={{ color: "var(--gold)" }}>
              Rating: ★{data.rating}
            </p>
          )}
          <p className="text-xs mt-1" style={{ color: data.present ? "var(--green)" : "var(--red)" }}>
            {data.present ? "✅ Present" : "❌ Absent"}
          </p>
        </div>
      );
    }
    return null;
  };

  const RadarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="card shadow-xl" style={{ border: "1px solid var(--border)", padding: "10px", background: "rgba(10, 15, 25, 0.95)", backdropFilter: "blur(8px)" }}>
          <p className="font-cinzel text-sm mb-1" style={{ color: "var(--accent)" }}>{payload[0].payload.subject}</p>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between gap-4">
              <span className="text-xs text-muted">You:</span>
              <span className="text-xs font-bold" style={{ color: theme.color }}>{payload[0].value}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs text-muted">Guild Avg:</span>
              <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{payload[1].value}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const submitAbsence = () => {
    if (!absenceForm.reason.trim()) { showToast("Please provide a reason", "error"); return; }
    const id = `ABS${Date.now()}`;
    const newAbsence = { ...absenceForm, memberId: member.memberId, id };
    setAbsences(prev => [...prev, newAbsence]);
    showToast("Absence filed successfully!", "success");
    // writeAuditLog removed (member-initiated)
    setShowAbsenceForm(false);
    setAbsenceForm(f => ({ ...f, reason: "" }));
  };

  const saveSocialData = () => {
    const updatedMembers = members.map(m =>
      m.memberId === member.memberId
        ? { ...m, bio: tempBio, discord: tempSocial.discord, motto: tempSocial.motto, joinDate: tempSocial.joinDate }
        : m
    );
    setMembers(updatedMembers);
    setIsEditingBio(false);
    showToast("Profile updated!", "success");
  };

  const toggleDonator = () => {
    const updatedMembers = members.map(m =>
      m.memberId === member.memberId ? { ...m, isDonator: !m.isDonator } : m
    );
    setMembers(updatedMembers);
    showToast(member.isDonator ? "Patron badge revoked." : "Patron badge granted!", "success");
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "patron_toggle", `${member.isDonator ? "Revoked" : "Granted"} Patron status for ${member.ign}`);
  };

  return (
    <div>
      {/* Sticky mini-bar header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50, marginBottom: 4,
        background: "rgba(10,14,22,0.85)", backdropFilter: "blur(12px)",
        borderBottom: `2px solid ${theme.color}44`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", gap: 16
      }}>
        <div className="flex items-center gap-3">
          {onBack && !isOwnProfile && (
            <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="x" size={13} /> Back</button>
          )}
          <MemberAvatar ign={member.ign} index={memberIdx} size={32} memberClass={member.class} glScore={totalGLScore} />
          <div>
            <div style={{ fontFamily: "Cinzel,serif", fontWeight: 700, fontSize: 14, lineHeight: 1 }}>{member.ign}</div>
            <div style={{ fontSize: 10, color: rankInfo.color, fontWeight: 700, letterSpacing: 1 }}>{rankInfo.rank} · LV.{level}</div>
          </div>
          <div className="flex gap-1 flex-wrap items-center" style={{ marginLeft: 8 }}>
            {member.guildRank && member.guildRank !== "Member" && (() => {
               let badgeColor = "var(--text-muted)";
               let badgeIcon = "🛡️";
               let glow = "";
               if (member.guildRank === "System Architect (Creator)" || member.guildRank === "System Architect" || member.guildRank === "Creator") { 
                 badgeColor = "#ff4d4d"; badgeIcon = "👁️‍🗨️"; glow = "0 0 12px rgba(255,77,77,0.8)"; 
               }
               else if (member.guildRank === "Guild Master") { badgeColor = "var(--gold)"; badgeIcon = "👑"; glow = "0 0 10px rgba(240,192,64,0.6)"; }
               else if (member.guildRank === "Vice Guild Master") { badgeColor = "#e6e6e6"; badgeIcon = "⚜️"; glow = "0 0 8px rgba(230,230,230,0.5)"; }
               else if (member.guildRank === "Commander") { badgeColor = "#ff4d4d"; badgeIcon = "⚔️"; glow = "0 0 8px rgba(255,77,77,0.5)"; }
               else if (member.guildRank === "Charisma Baby") { badgeColor = "var(--color-priest)"; badgeIcon = "💖"; glow = "0 0 8px rgba(255,105,180,0.5)"; }
               else if (member.guildRank === "Officer") { badgeColor = "#4db8ff"; badgeIcon = "🛡️"; }
               
               return <span className="badge" style={{ background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}`, boxShadow: glow, fontSize: 8, fontWeight: 800 }}>{badgeIcon} {member.guildRank.toUpperCase()}</span>
            })()}
            {member.isDonator && <span title="Oblivion Patron" style={{ fontSize: 12, filter: 'drop-shadow(0 0 4px var(--gold))', marginLeft: 2 }}>🌟</span>}
            <span className="badge badge-premium" style={{ background: theme.color, fontSize: 9 }}>{theme.icon} {member.class}</span>
            <span className={`badge ${member.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 9 }}>{member.role}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isOwnProfile && !showAbsenceForm && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAbsenceForm(true)}>
              <Icon name="absence" size={12} /> File Absence
            </button>
          )}
        </div>
      </div>

      {/* Absence Form */}
      {showAbsenceForm && (
        <div className="card shadow-2xl" style={{ border: "2px solid var(--accent)", background: "rgba(99,130,230,0.05)", marginBottom: 20 }}>
          <div className="card-title">🚨 File Absence</div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Event Type</label>
              <select className="form-select" value={absenceForm.eventType} onChange={e => setAbsenceForm(f => ({ ...f, eventType: e.target.value }))}>
                <option>Guild League</option><option>Emperium Overrun</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Event Date</label>
              <input type="date" className="form-input" value={absenceForm.eventDate} onChange={e => setAbsenceForm(f => ({ ...f, eventDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Will you be online?</label>
              <select className="form-select" value={absenceForm.onlineStatus} onChange={e => setAbsenceForm(f => ({ ...f, onlineStatus: e.target.value }))}>
                <option value="Yes">Yes</option><option value="No">No</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label className="form-label">Reason</label>
              <textarea className="form-input" rows={2} placeholder="Reason for absence..." value={absenceForm.reason} onChange={e => setAbsenceForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button className="btn btn-ghost" onClick={() => setShowAbsenceForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitAbsence}>Submit</button>
          </div>
        </div>
      )}

      {/* Next Event Banner */}
      {nextEvent && (
        <div className="card mb-4" style={{
          background: "linear-gradient(90deg, rgba(240,192,64,0.1), transparent)",
          borderLeft: `4px solid var(--gold)`, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px"
        }}>
          <div>
            <div className="rank-label" style={{ color: isUpcoming ? "var(--gold)" : "var(--text-muted)", marginBottom: 3 }}>
              {isUpcoming ? "🚨 Next Mission" : "📅 Most Recent Event"}
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 16 }}>{nextEvent.eventType === "Guild League" ? "⚔️" : "🏰"}</span>
              <span style={{ fontWeight: 700, fontFamily: "Cinzel, serif" }}>{nextEvent.eventType} — {nextEvent.eventDate}</span>
              {!isUpcoming && <span className="badge badge-atrisk" style={{ fontSize: 9 }}>Past</span>}
            </div>
          </div>
          {isOwnProfile && isUpcoming && (
            <button className="btn btn-danger btn-sm" onClick={quickAbsence}>I'm Busy Today 🛡️</button>
          )}
        </div>
      )}

      {/* Portal Hero */}
      <div className="portal-hero animate-fade-in" style={{ borderColor: theme.color, marginBottom: 20 }}>
        <div className="portal-hero-bg" style={{ background: `radial-gradient(circle at 70% 30%, ${theme.color}, transparent 60%)` }} />
        <div className="flex flex-col items-center gap-3" style={{ zIndex: 2, position: "relative", minWidth: 150 }}>
          <div className="rank-badge-lg" style={{ '--stat-accent': rankInfo.color, '--stat-accent-glow': `${rankInfo.color}66` }}>
            <span className="rank-label">{rankInfo.rank}</span>
            <span className="rank-value">LV.{level}</span>
          </div>
          <MemberAvatar ign={member.ign} index={memberIdx} size={64} memberClass={member.class} glScore={totalGLScore} hexagon />
          <div style={{ fontFamily: "Cinzel,serif", fontSize: 20, fontWeight: 700, textAlign: "center" }}>{member.ign}</div>
        </div>

        <div className="portal-hero-content">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex gap-2 mb-2 flex-wrap items-center">
                {member.guildRank && member.guildRank !== "Member" && (() => {
                   let badgeColor = "var(--text-muted)";
                   let badgeIcon = "🛡️";
                   let glow = "";
                   if (member.guildRank === "System Architect (Creator)" || member.guildRank === "System Architect" || member.guildRank === "Creator") { 
                     badgeColor = "#ff4d4d"; badgeIcon = "👁️‍🗨️"; glow = "0 0 15px rgba(255,77,77,0.9)"; 
                   }
                   else if (member.guildRank === "Guild Master") { badgeColor = "var(--gold)"; badgeIcon = "👑"; glow = "0 0 10px rgba(240,192,64,0.6)"; }
                   else if (member.guildRank === "Vice Guild Master") { badgeColor = "#e6e6e6"; badgeIcon = "⚜️"; glow = "0 0 8px rgba(230,230,230,0.5)"; }
                   else if (member.guildRank === "Commander") { badgeColor = "#ff4d4d"; badgeIcon = "⚔️"; glow = "0 0 8px rgba(255,77,77,0.5)"; }
                   else if (member.guildRank === "Charisma Baby") { badgeColor = "var(--color-priest)"; badgeIcon = "💖"; glow = "0 0 8px rgba(255,105,180,0.5)"; }
                   else if (member.guildRank === "Officer") { badgeColor = "#4db8ff"; badgeIcon = "🛡️"; }
                   
                   return <span className="badge" style={{ background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}`, boxShadow: glow, fontSize: 10, fontWeight: 800 }}>{badgeIcon} {member.guildRank.toUpperCase()}</span>
                })()}
                {member.isDonator && <span title="Oblivion Patron (Donator)" style={{ fontSize: 18, filter: 'drop-shadow(0 0 6px var(--gold))' }}>🌟</span>}
                <span className="badge badge-premium" style={{ background: theme.color }}>{theme.icon} {member.class}</span>
                <span className={`badge ${member.role === "DPS" ? "badge-dps" : "badge-support"}`}>
                  {member.role === "DPS" ? <Icon name="sword" size={10} /> : <Icon name="shield" size={10} />} {member.role}
                </span>
                <span className={`badge ${attStatus.badge}`}>🎯 {attStatus.label}</span>
                {badges.map((b, i) => <span key={i} title={b.label} style={{ fontSize: 16 }}>{b.icon}</span>)}
              </div>
              <div className="rank-label" style={{ color: "var(--text-muted)", fontSize: 12, letterSpacing: 2 }}>{rankInfo.label}</div>
            </div>
            <div className="flex gap-2 items-center">
              {isArchitect && (
                <button className="btn btn-sm" style={{ background: "rgba(240,192,64,0.1)", color: "var(--gold)", border: "1px solid var(--gold)" }} onClick={toggleDonator}>
                  {member.isDonator ? "Revoke Patron" : "Grant Patron 🌟"}
                </button>
              )}
              {isOwnProfile && (
                <button className="btn btn-ghost btn-sm" onClick={() => isEditingBio ? saveSocialData() : setIsEditingBio(true)}>
                  {isEditingBio ? "💾 Save" : "✏️ Edit"}
                </button>
              )}
            </div>
          </div>

          {!isEditingBio ? (
            <div className="glass-card" style={{ padding: "12px 16px", borderRadius: 10 }}>
              {(member.motto) && <div style={{ fontFamily: "Cinzel, serif", fontSize: 15, marginBottom: 4 }}>"{member.motto}"</div>}
              <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{member.bio || <span className="text-muted" style={{ fontStyle: "italic" }}>No bio yet.</span>}</p>
              <div className="flex gap-4 mt-3">
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>DISCORD:</span> {member.discord || "Not linked"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>ID:</span> {member.memberId}
                </div>
                {member.joinDate && (
                  <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, background: "rgba(99,130,230,0.1)", padding: "2px 6px", borderRadius: 4 }}>
                    JOINED: {member.joinDate}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input className="form-input" placeholder="Battle motto..." value={tempSocial.motto} onChange={e => setTempSocial({ ...tempSocial, motto: e.target.value })} />
              <textarea className="form-input" rows={2} placeholder="Bio / notes..." value={tempBio} onChange={e => setTempBio(e.target.value)} />
              <input className="form-input" placeholder="Discord Username#0000" value={tempSocial.discord} onChange={e => setTempSocial({ ...tempSocial, discord: e.target.value })} />
              {isArchitect && (
                <div className="form-group mb-0" style={{ marginTop: 4 }}>
                  <label className="form-label" style={{ fontSize: 10, color: "var(--gold)", marginBottom: 4 }}>🛡️ JOIN DATE (ADMIN ONLY)</label>
                  <input type="date" className="form-input" value={tempSocial.joinDate} onChange={e => setTempSocial({ ...tempSocial, joinDate: e.target.value })} />
                </div>
              )}
            </div>
          )}

          <div className="level-bar-container">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <div style={{ 
                  width: 32, height: 32, borderRadius: "50%", 
                  border: `2px solid ${theme.color}`, 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: theme.color,
                  background: `${theme.color}11`
                }}>
                  {Math.min(100, Math.round(totalGLScore / 2))}%
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: 1 }}>CLASS MASTERY</div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Path to {getRankInfo(totalGLScore + 50).rank}</div>
            </div>
            <div className="progress-bar-wrap" style={{ height: 8 }}>
              <div className="progress-bar-fill" style={{ width: `${levelProgress}%`, background: `linear-gradient(90deg, ${theme.color}, ${rankInfo.color})`, boxShadow: `0 0 12px ${theme.color}66` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid animate-slide-up" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ "--stat-accent": "var(--gold)" }}>
          <div className="stat-icon">⚔</div>
          <div className="stat-label">Power Score</div>
          <div className="stat-value" style={{ color: "var(--gold)", display: "flex", alignItems: "baseline", gap: 6 }}>
            {totalGLScore}
            {glTrend !== "stable" && <span className={glTrend === "up" ? "trend-up" : "trend-down"} style={{ fontSize: 12 }}>{glTrend === "up" ? "▲" : "▼"}</span>}
          </div>
          <div className="stat-change">all time GL total</div>
        </div>
        <div className="stat-card" style={{ "--stat-accent": attPct >= 75 ? "var(--green)" : attPct >= 50 ? "var(--gold)" : "var(--red)" }}>
          <div className="stat-icon">📋</div>
          <div className="stat-label">War Duty</div>
          <div className="stat-value" style={{ color: attPct >= 75 ? "var(--green)" : attPct >= 50 ? "var(--gold)" : "var(--red)" }}>{attPct}%</div>
          <div className="stat-change">{presentCount} of {memberEvents.length} events</div>
        </div>
        {/* Stat Card 3 — role-based */}
        {isSupport ? (
          <div className="stat-card" style={{ "--stat-accent": "var(--color-priest)" }}>
            <div className="stat-icon">🌟</div>
            <div className="stat-label">Support Index</div>
            <div className="stat-value" style={{ color: "var(--color-priest)" }}>
              {avgEoRating > 0 || attPct > 0 ? supportIndex : "—"}
            </div>
            <div className="stat-change">Attendance (50%) + EO Quality (50%)</div>
          </div>
        ) : (
          <div className="stat-card" style={{ "--stat-accent": "var(--accent)" }}>
            <div className="stat-icon">📊</div>
            <div className="stat-label">Kill Efficiency</div>
            <div className="stat-value" style={{ color: "var(--accent)" }}>{avgGL}</div>
            <div className="stat-change">per war average</div>
          </div>
        )}

        {/* Stat Card 4 — role-based */}
        {isSupport ? (
          <div className="stat-card" style={{ "--stat-accent": "var(--gold)" }}>
            <div className="stat-icon">🏛️</div>
            <div className="stat-label">Guild Pillar</div>
            <div className="stat-value" style={{
              color: pillarScore >= 70 ? "var(--green)" : pillarScore >= 40 ? "var(--gold)" : "var(--red)"
            }}>{pillarScore}</div>
            <div className="stat-change">attendance + EO − absences</div>
          </div>
        ) : (
          <div className="stat-card" style={{ "--stat-accent": "var(--gold)" }}>
            <div className="stat-icon">⭐</div>
            <div className="stat-label">EO Honor</div>
            <div className="stat-value" style={{ color: "var(--gold)" }}>{avgEoRating > 0 ? `★${avgEoRating}` : "—"}</div>
            <div className="stat-change">{eoRatingsList.length} reviews</div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-card2)", borderRadius: 12, padding: 6 }}>
        {[
          { id: "overview", label: "📊 Overview" },
          { id: "history", label: "📅 History" },
          { id: "achievements", label: "🏆 Achievements" },
          { id: "notifications", label: `🔔 Alerts ${unreadCount > 0 ? `(${unreadCount})` : ''}` },
          { id: "absences", label: `⚠️ Absences (${memberAbsences.length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s",
              background: activeTab === tab.id ? theme.color : "transparent",
              color: activeTab === tab.id ? "#fff" : "var(--text-muted)",
              boxShadow: activeTab === tab.id ? `0 0 12px ${theme.color}66` : "none"
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="animate-fade-in">
          {/* Performance Summary */}
          <div className="card mb-4">
            <div
              className="flex items-center justify-between"
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => toggleCollapse("perfSummary")}
            >
              <div className="card-title" style={{ margin: 0 }}>🎯 Performance Summary</div>
              <span style={{ fontSize: 16, color: "var(--text-muted)", transform: collapsed.perfSummary ? "rotate(-90deg)" : "rotate(0)", transition: "0.2s" }}>▼</span>
            </div>
            {!collapsed.perfSummary && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginTop: 16 }}>
                <div style={{ background: "rgba(51,204,51,0.08)", border: "1px solid rgba(51,204,51,0.2)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>🏆</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>BEST EVENT</div>
                  <div style={{ fontFamily: "Cinzel,serif", fontWeight: 700, fontSize: 22, color: "var(--green)" }}>{bestEvent ? bestEvent.score : "—"}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{bestEvent?.eventDate || "No data"}</div>
                </div>
                <div style={{ background: "rgba(224,80,80,0.08)", border: "1px solid rgba(224,80,80,0.2)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>📉</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>WORST EVENT</div>
                  <div style={{ fontFamily: "Cinzel,serif", fontWeight: 700, fontSize: 22, color: "var(--red)" }}>{worstEvent ? worstEvent.score : "—"}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{worstEvent?.eventDate || "No data"}</div>
                </div>
                <div style={{ background: `${theme.color}11`, border: `1px solid ${theme.color}33`, borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>🔥</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>ATTEND STREAK</div>
                  <div style={{ fontFamily: "Cinzel,serif", fontWeight: 700, fontSize: 22, color: theme.color }}>{winStreak}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>consecutive events</div>
                </div>
                <div style={{ background: "rgba(240,192,64,0.08)", border: "1px solid rgba(240,192,64,0.2)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>⚔</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>TOTAL EVENTS</div>
                  <div style={{ fontFamily: "Cinzel,serif", fontWeight: 700, fontSize: 22, color: "var(--gold)" }}>{memberEvents.length}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{glEvents.length} GL / {eoEvents.length} EO</div>
                </div>
              </div>
            )}
          </div>

          {/* Radar + Chart row */}
          <div className="grid-2 mb-4">
            <div className="card">
              <div className="card-title">🛡️ Benchmark Comparison</div>
              <div style={{ height: 240, width: "100%", marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="You" dataKey="A" stroke={theme.color} fill={theme.color} fillOpacity={0.55} dot={{ r: 3, fill: theme.color }} />
                    <Radar name="Guild Avg" dataKey="B" stroke="var(--text-muted)" fill="transparent" strokeWidth={1} strokeDasharray="4 4" />
                    <Tooltip content={<RadarTooltip />} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-title">📈 Performance Chart</div>
              <div style={{ height: 240, width: "100%", marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 9 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 9 }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
                    <Bar dataKey="score" name="GL Score" barSize={16} radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.present ? theme.color : "rgba(224,80,80,0.25)"} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="rating" name="EO Rating" stroke="var(--gold)" strokeWidth={2} dot={{ r: 3, fill: "var(--gold)" }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: History */}
      {activeTab === "history" && (
        <div className="card animate-fade-in">
          <div className="card-title">📅 Event History</div>
          {memberEvents.length === 0 ? (
            <div className="empty-state"><div className="empty-state-text">No events yet</div></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {memberEvents.map(ev => {
                const isPresent = ev.att?.status === "present";
                const isGL = ev.eventType === "Guild League";
                const isEO = ev.eventType === "Emperium Overrun";
                const barColor = isPresent ? (isGL ? theme.color : "var(--gold)") : "var(--red)";
                return (
                  <div key={ev.eventId} style={{
                    display: "flex", gap: 14, alignItems: "stretch",
                    background: isPresent ? `${barColor}08` : "rgba(224,80,80,0.04)",
                    border: `1px solid ${barColor}22`, borderRadius: 10, overflow: "hidden"
                  }}>
                    {/* Timeline bar */}
                    <div style={{ width: 4, background: barColor, flexShrink: 0, borderRadius: "10px 0 0 10px" }} />
                    {/* Content */}
                    <div style={{ flex: 1, padding: "10px 10px 10px 0", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 90 }}>
                        <div style={{ fontFamily: "Cinzel,serif", fontSize: 12, fontWeight: 700 }}>{ev.eventDate}</div>
                        <span className={`badge ${isGL ? "badge-gl" : "badge-eo"}`} style={{ fontSize: 9, marginTop: 2 }}>{isGL ? "GL" : "EO"}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: isPresent ? "var(--green)" : "var(--red)" }}>
                          {isPresent ? "✅ Present" : "❌ Absent"}
                        </span>
                        {isGL && isPresent && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            CTF: {(ev.perf?.ctf1 ?? ev.perf?.ctfPoints ?? 0)} + {ev.perf?.ctf2 ?? 0} + {ev.perf?.ctf3 ?? 0} = <span style={{ color: "var(--accent)", fontWeight: 700 }}>{(ev.perf?.ctf1 ?? ev.perf?.ctfPoints ?? 0) + (ev.perf?.ctf2 ?? 0) + (ev.perf?.ctf3 ?? 0)}</span> &nbsp;·&nbsp; Perf: {ev.perf?.performancePoints ?? "—"}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {isGL && isPresent ? (
                          <span style={{ fontFamily: "Cinzel,serif", fontWeight: 700, color: theme.color, fontSize: 18 }}>{ev.score}</span>
                        ) : isEO && isPresent ? (
                          <span style={{ color: "var(--gold)" }}>{[1, 2, 3, 4, 5].map(s => <span key={s} style={{ fontSize: 14, color: s <= (ev.eoRating?.rating || 0) ? "var(--gold)" : "rgba(99,130,230,0.2)" }}>★</span>)}</span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: 12 }}>—</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Achievements */}
      {activeTab === "achievements" && (
        <div className="animate-fade-in">
          <div className="card">
            <div className="card-title">🏆 Achievement Hall</div>
            <p className="text-xs text-muted mb-6">Earn trophies by participating in guild events and reaching performance milestones.</p>
            <div className="achievement-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 }}>
              {[
                { id: 'hero', icon: '🔥', name: 'War Hero', desc: '80+ total GL score', earned: totalGLScore >= 80 },
                { id: 'wall', icon: '🛡️', name: 'Iron Wall', desc: '100% attendance (5+ events)', earned: attPct === 100 && memberEvents.length >= 5 },
                { id: 'clutch', icon: '⚡', name: 'Clutch King', desc: 'Above guild avg skill', earned: avgGL > (guildAvgGL / 10) + 1 },
                { id: 'mvp', icon: '⭐', name: 'MVP Material', desc: '4.5+ EO Rating (3+ reviews)', earned: eoRatingsList.length >= 3 && avgEoRating >= 4.5 },
                { id: 'loyal', icon: '💎', name: 'Old Guard', desc: '10+ events attended', earned: memberEvents.length >= 10 },
                { id: 'legend', icon: '👑', name: 'Living Legend', desc: '200+ total score', earned: totalGLScore >= 200 },
                { id: 'streak3', icon: '🎯', name: 'On a Roll', desc: '3+ attendance streak', earned: winStreak >= 3 },
                { id: 'elite', icon: '🏅', name: 'Elite Warrior', desc: 'Reach ELITE rank', earned: totalGLScore >= 150 },
              ].map(ach => (
                <div key={ach.id} className={`achievement-item ${!ach.earned ? 'locked' : ''}`} 
                  style={{ 
                    padding: "16px", borderRadius: 16, textAlign: "center",
                    background: ach.earned ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.2)",
                    border: ach.earned ? `1px solid ${theme.color}44` : "1px solid rgba(255,255,255,0.05)",
                    opacity: ach.earned ? 1 : 0.4,
                    transition: "all 0.3s ease",
                    position: "relative",
                    overflow: "hidden"
                  }}>
                  {ach.earned && (
                    <div style={{ 
                      position: "absolute", inset: 0, 
                      background: `radial-gradient(circle at center, ${theme.color}11, transparent 70%)`,
                      pointerEvents: "none"
                    }} />
                  )}
                  <div style={{ fontSize: 32, marginBottom: 8, filter: ach.earned ? "none" : "grayscale(1)" }}>{ach.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ach.earned ? "var(--text-primary)" : "var(--text-muted)", marginBottom: 4 }}>{ach.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.3 }}>{ach.desc}</div>
                  {ach.earned && (
                    <div style={{ 
                      marginTop: 10, fontSize: 9, color: "var(--green)", fontWeight: 800, 
                      letterSpacing: 1, textTransform: "uppercase" 
                    }}>Unlocked</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Notifications */}
      {activeTab === "notifications" && (
        <div className="animate-fade-in flex flex-col gap-3">
          {myNotifs.length === 0 && <div className="card p-12 text-center text-muted italic">No notifications found for this profile.</div>}
          {myNotifs.map(n => (
            <div key={n.id} className={`card p-4 border animate-slide-up ${n.isRead ? 'opacity-60 border-white/5' : 'border-accent/30 bg-accent/5 shadow-[0_4px_20px_rgba(99,130,230,0.08)]'}`}
              onClick={() => n.targetId !== 'all' && markNotifRead(n.id)}
              style={{ cursor: n.targetId !== 'all' ? 'pointer' : 'default' }}>
              <div className="flex justify-between items-start mb-2">
                <div style={{ color: n.type === 'warning' ? 'var(--red)' : n.type === 'success' ? 'var(--green)' : 'var(--accent)', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {n.type === 'warning' ? '⚠️' : n.type === 'success' ? '✅' : '🔔'} {n.title}
                  {!n.isRead && n.targetId !== 'all' && <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
                </div>
                <div className="text-[10px] text-muted">{new Date(n.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <p className="text-xs text-secondary leading-relaxed">{n.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Absences */}
      {activeTab === "absences" && (
        <div className="card animate-fade-in">
          <div className="card-title">⚠️ Absence Records ({memberAbsences.length})</div>
          {memberAbsences.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-text">No absences on record</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {memberAbsences.slice().reverse().map((a, i) => (
                <div key={a.id || i} style={{
                  display: "flex", gap: 14, alignItems: "stretch",
                  background: "rgba(224,80,80,0.05)", border: "1px solid rgba(224,80,80,0.2)", borderRadius: 10, overflow: "hidden"
                }}>
                  <div style={{ width: 4, background: "var(--red)", flexShrink: 0 }} />
                  <div style={{ flex: 1, padding: "10px 10px 10px 0", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 18 }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--red)" }}>{a.eventDate} · {a.eventType}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontStyle: "italic", marginTop: 2 }}>"{a.reason}"</div>
                    </div>
                    <span style={{ fontSize: 11, color: a.onlineStatus === "Yes" ? "var(--green)" : "var(--text-muted)" }}>
                      Online: {a.onlineStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MemberProfilePage;