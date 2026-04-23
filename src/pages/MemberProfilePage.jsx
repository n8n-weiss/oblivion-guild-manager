import React, { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useGuild } from '../context/GuildContext';
import { JOB_CLASSES } from '../utils/constants';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { writeAuditLog } from '../utils/audit';
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

const ProfileRadarChartCard = React.memo(function ProfileRadarChartCard({ radarData, themeColor }) {
  const RadarLabel = React.useCallback(({ x, y, payload, cx, cy }) => {
    const stat = radarData.find(d => d.subject === payload.value);
    if (!stat) return null;
    const angle = Math.atan2(y - cy, x - cx);
    const radiusOffset = 22;
    const labelX = x + Math.cos(angle) * radiusOffset;
    const labelY = y + Math.sin(angle) * radiusOffset;
    return (
      <g>
        <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" fill={themeColor} style={{ fontSize: 16, filter: `drop-shadow(0 0 8px ${themeColor}66)` }}>
          {stat.icon}
        </text>
        <text x={labelX} y={labelY + 12} textAnchor="middle" dominantBaseline="middle" fill="var(--text-muted)" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
          {stat.subject}
        </text>
      </g>
    );
  }, [radarData, themeColor]);

  const radarTooltip = React.useCallback(({ active, payload }) => {
    if (!(active && payload && payload.length)) return null;
    return (
      <div className="card shadow-xl" style={{ border: "1px solid var(--border)", padding: "10px", background: "rgba(10, 15, 25, 0.95)", backdropFilter: "blur(8px)" }}>
        <p className="font-cinzel text-sm mb-1" style={{ color: "var(--accent)" }}>{payload[0].payload.subject}</p>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between gap-4">
            <span className="text-xs text-muted">You:</span>
            <span className="text-xs font-bold" style={{ color: themeColor }}>{payload[0].value}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-xs text-muted">Guild Avg:</span>
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{payload[1].value}</span>
          </div>
        </div>
      </div>
    );
  }, [themeColor]);

  return (
    <div className="card" style={{ position: "relative", overflow: "hidden" }}>
      <div className="card-title">🛡️ Benchmark Comparison</div>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -40%)", width: 280, height: 280, pointerEvents: "none", zIndex: 0, opacity: 0.15 }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="none" stroke={themeColor} strokeWidth="0.5" strokeDasharray="2 2" />
          <circle cx="50" cy="50" r="35" fill="none" stroke={themeColor} strokeWidth="0.2" />
          <circle cx="50" cy="50" r="22" fill="none" stroke={themeColor} strokeWidth="0.2" />
          <line x1="50" y1="2" x2="50" y2="98" stroke={themeColor} strokeWidth="0.1" />
          <line x1="2" y1="50" x2="98" y2="50" stroke={themeColor} strokeWidth="0.1" />
        </svg>
      </div>
      <div style={{ height: 280, width: "100%", marginTop: 10, position: "relative", zIndex: 1 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.06)" />
            <PolarAngleAxis dataKey="subject" tick={RadarLabel} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name="You" dataKey="A" stroke={themeColor} fill={themeColor} fillOpacity={0.65} strokeWidth={2} dot={{ r: 4, fill: themeColor, stroke: "#fff", strokeWidth: 1 }} isAnimationActive animationDuration={1500} />
            <Radar name="Guild Avg" dataKey="B" stroke="var(--text-muted)" fill="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="4 4" />
            <Tooltip content={radarTooltip} />
            <Legend iconType="diamond" verticalAlign="bottom" />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

const ProfilePerformanceChartCard = React.memo(function ProfilePerformanceChartCard({ chartData, themeColor }) {
  const customTooltip = React.useCallback(({ active, payload }) => {
    if (!(active && payload && payload.length)) return null;
    const data = payload[0].payload;
    return (
      <div className="card shadow-xl" style={{ border: "1px solid var(--border)", padding: "10px", background: "rgba(10, 15, 25, 0.95)", backdropFilter: "blur(8px)" }}>
        <p className="text-xs text-muted mb-1">{data.fullDate}</p>
        <p className="font-cinzel text-sm mb-1" style={{ color: data.type === "Guild League" ? "var(--accent)" : "var(--gold)" }}>{data.type}</p>
        {data.score !== null && <p className="text-sm font-bold" style={{ color: "var(--green)" }}>Score: {data.score}</p>}
        {data.rating !== null && <p className="text-sm font-bold" style={{ color: "var(--gold)" }}>Rating: ★{data.rating}</p>}
        <p className="text-xs mt-1" style={{ color: data.present ? "var(--green)" : "var(--red)" }}>{data.present ? "✅ Present" : "❌ Absent"}</p>
      </div>
    );
  }, []);

  return (
    <div className="card">
      <div className="card-title">📈 Performance Chart</div>
      <div style={{ height: 240, width: "100%", marginTop: 10 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 9 }} dy={8} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 9 }} />
            <Tooltip content={customTooltip} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
            <Bar dataKey="score" name="GL Score" barSize={16} radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.present ? themeColor : "rgba(224,80,80,0.25)"} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="rating" name="EO Rating" stroke="var(--gold)" strokeWidth={2} dot={{ r: 3, fill: "var(--gold)" }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

function MemberProfilePage({ member, onBack, isOwnProfile }) {
  const { 
    members, events, attendance, performance, absences, eoRatings, 
    notifications, markNotifRead,
    requests, submitRequest,
    isMember, myMemberId, isArchitect, setAbsences, setMembers, showToast, currentUser,
    auctionSessions, migrateMemberData,
    memberLootStats, auctionWishlist, submitWishlistRequest, removeWishlistRequest, updateWishlistMetadata
  } = useGuild();
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    ign: member.ign,
    class: member.class,
    role: member.role
  });
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileShowHeatmap, setMobileShowHeatmap] = useState(window.innerWidth >= 768);
  const [mobileShowCharts, setMobileShowCharts] = useState(window.innerWidth >= 768);
  const MotionDiv = motion.div;

  React.useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileShowHeatmap(true);
        setMobileShowCharts(true);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 3D Card Tilt State
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-8deg", "8deg"]);
  const glareX = useTransform(mouseX, [-0.5, 0.5], ["-50%", "50%"]);
  const glareY = useTransform(mouseY, [-0.5, 0.5], ["-50%", "50%"]);
  const glareOpacity = useTransform(mouseX, [-0.5, 0, 0.5], [0.6, 0.1, 0.6]);
  const holoBgPosition = useTransform(mouseX, [-0.5, 0.5], ["0% 50%", "100% 50%"]);
  const holoOpacity = useTransform(mouseX, [-0.5, 0, 0.5], [0.8, 0, 0.8]);

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const xPct = (event.clientX - rect.left) / width - 0.5;
    const yPct = (event.clientY - rect.top) / height - 0.5;
    mouseX.set(xPct);
    mouseY.set(yPct);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const isAccessDenied = isMember && member.memberId !== myMemberId;

  const memberIdx = members.findIndex(m => (m.memberId || "").trim() === (member.memberId || "").trim());
  const mId = (member.memberId || "").trim().toLowerCase();
  const activeMembers = React.useMemo(
    () => members.filter(m => (m.status || "active") === "active"),
    [members]
  );
  const glBaseEvents = React.useMemo(
    () => events.filter(e => e.eventType === "Guild League"),
    [events]
  );
  const attendanceIndex = React.useMemo(() => {
    const map = new Map();
    attendance.forEach(a => map.set(`${(a.memberId || "").trim().toLowerCase()}__${a.eventId}`, a));
    return map;
  }, [attendance]);
  const performanceIndex = React.useMemo(() => {
    const map = new Map();
    performance.forEach(p => map.set(`${(p.memberId || "").trim().toLowerCase()}__${p.eventId}`, p));
    return map;
  }, [performance]);
  const eoRatingsIndex = React.useMemo(() => {
    const map = new Map();
    eoRatings.forEach(r => map.set(`${(r.memberId || "").trim().toLowerCase()}__${r.eventId}`, r));
    return map;
  }, [eoRatings]);
  const memberEvents = React.useMemo(() => {
    return events
      .map(ev => {
        const k = `${mId}__${ev.eventId}`;
        const att = attendanceIndex.get(k);
        const perf = performanceIndex.get(k);
        const eoRating = eoRatingsIndex.get(k);
        const score = ev.eventType === "Guild League" && att?.status === "present"
          ? (perf?.ctfPoints || 0) + (perf?.performancePoints || 0) : 0;
        return { ...ev, att, perf, eoRating, score };
      })
      .sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate))
      .filter(e => {
        if (!member.joinDate) return true;
        if (new Date(e.eventDate) >= new Date(member.joinDate)) return true;
        return e.att || e.perf || e.eoRating;
      });
  }, [events, mId, attendanceIndex, performanceIndex, eoRatingsIndex, member.joinDate]);

  const glEvents = React.useMemo(() => memberEvents.filter(e => e.eventType === "Guild League"), [memberEvents]);
  const eoEvents = React.useMemo(() => memberEvents.filter(e => e.eventType === "Emperium Overrun"), [memberEvents]);
  const memberAbsences = React.useMemo(() => absences.filter(a => a.memberId === member.memberId), [absences, member.memberId]);
  const myNotifs = React.useMemo(
    () => notifications.filter(n => n.targetId === "all" || n.targetId === member.memberId),
    [notifications, member.memberId]
  );
  const unreadCount = React.useMemo(
    () => myNotifs.filter(n => !n.isRead && n.targetId !== "all").length,
    [myNotifs]
  );
  
  const myPendingRequest = requests.find(r => r.memberId === member.memberId && r.status === "pending");
  
  const totalGLScore = React.useMemo(() => glEvents.reduce((sum, e) => sum + e.score, 0), [glEvents]);
  const presentCount = React.useMemo(() => memberEvents.filter(e => (e.att?.status || "present") === "present").length, [memberEvents]);
  const attPct = memberEvents.length > 0 ? Math.round((presentCount / memberEvents.length) * 100) : 0;
  const presentGLCount = React.useMemo(() => glEvents.filter(e => (e.att?.status || "present") === "present").length, [glEvents]);
  const avgGL = presentGLCount > 0 ? Math.round((totalGLScore / presentGLCount) * 10) / 10 : 0;
  const eoRatingsList = React.useMemo(() => eoRatings.filter(r => r.memberId === member.memberId), [eoRatings, member.memberId]);
  const avgEoRating = eoRatingsList.length > 0
    ? Math.round((eoRatingsList.reduce((s, r) => s + r.rating, 0) / eoRatingsList.length) * 10) / 10 : 0;

  // --- NEW CALCULATIONS ---
  // 1. Guild Average GL
  const guildTotalGL = React.useMemo(() => activeMembers.reduce((sum, m) => {
    const memberIdLower = (m.memberId || "").toLowerCase();
    const mScore = glBaseEvents.reduce((s, e) => {
      const att = attendanceIndex.get(`${memberIdLower}__${e.eventId}`);
      const perf = performanceIndex.get(`${memberIdLower}__${e.eventId}`);
      return s + (att?.status === "present" ? (perf?.ctfPoints || 0) + (perf?.performancePoints || 0) : 0);
    }, 0);
    return sum + mScore;
  }, 0), [activeMembers, glBaseEvents, attendanceIndex, performanceIndex]);
  const guildAvgGL = activeMembers.length > 0 ? Math.round(guildTotalGL / activeMembers.length) : 0;

  // 2. Trend Logic (Last 3 vs Previous)
  const glScores = glEvents.filter(e => (e.att?.status || "present") === "present").map(e => e.score);
  const currentAvg = glScores.slice(0, 3).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(3, glScores.length));
  const prevAvg = glScores.slice(3, 6).length > 0 ? glScores.slice(3, 6).reduce((a, b) => a + b, 0) / glScores.slice(3, 6).length : currentAvg;
  const glTrend = currentAvg > prevAvg ? "up" : currentAvg < prevAvg ? "down" : "stable";

  // 3. Dynamic Badge System Logic
  const getBadges = () => {
    const list = [];
    
    // Shield of Reliability: 100% attendance in last 4 guild events (GL or EO)
    const last4 = memberEvents.slice(0, 4);
    if (last4.length === 4 && last4.every(e => (e.att?.status || "present") === "present")) {
      list.push({ id: "reliability", icon: "🛡️", label: "Reliability Shield", desc: "Solid as a rock. 100% attendance in the last 4 major operations.", color: "#4db8ff" });
    }

    // Blade of Oblivion: High score (>30) in any GL event
    if (memberEvents.some(e => e.eventType === "Guild League" && e.score >= 30)) {
      list.push({ id: "blade", icon: "⚔️", label: "Blade of Oblivion", desc: "A true powerhouse. Achieved a legendary score of 30+ in a single war.", color: "var(--red)" });
    }

    // Star of the Empire: 5-star EO rating
    if (eoRatingsList.some(r => r.rating === 5)) {
      list.push({ id: "star", icon: "🌟", label: "Star of the Empire", desc: "Strategic excellence. Earned a perfect 5-star rating for EO mastery.", color: "var(--gold)" });
    }

    // Vanguard: Top scorer in the most recent GL event
    const lastGL = glBaseEvents.slice().sort((a,b) => new Date(b.eventDate) - new Date(a.eventDate))[0];
    if (lastGL) {
      const glAtt = attendance.filter(a => a.eventId === lastGL.eventId);
      const glPerf = performance.filter(p => p.eventId === lastGL.eventId);
      const scores = activeMembers.map(m => {
        const att = glAtt.find(a => a.memberId === m.memberId);
        const perf = glPerf.find(p => p.memberId === m.memberId);
        return { memberId: m.memberId, score: (att?.status || "present") === "present" ? (perf?.ctfPoints || 0) + (perf?.performancePoints || 0) : 0 };
      });
      const topScore = Math.max(...scores.map(s => s.score));
      if (topScore > 0 && scores.find(s => s.memberId === member.memberId)?.score === topScore) {
        list.push({ id: "vanguard", icon: "🔥", label: "Frontline Vanguard", desc: "Leading the charge. Top scorer in the guild's most recent operation.", color: "#ff4d4d" });
      }
    }

    return list;
  };
  const dynamicBadges = getBadges();


  // 4. Class Theme & Icon
  const classThemes = (() => {
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
  })();
  const theme = classThemes[member.class] || { color: "var(--color-others)", icon: "👤" };

  const attStatus = attPct >= 80 ? { label: "Reliable", badge: "badge-active" }
    : attPct >= 60 ? { label: "Average", badge: "badge-casual" }
      : { label: "At Risk", badge: "badge-atrisk" };

  // Support-specific stats removed as per new simplified scoring
  const isSupport = member.role === "Support";

  // 5. RPG Rankings & Levels
  const getRankInfo = (score) => {
    if (score >= 200) return { rank: "LEGEND", label: "Mythic Vanguard", color: "#ff4d4d" };
    if (score >= 150) return { rank: "ELITE", label: "Heroic Knight", color: "#ffcc00" };
    if (score >= 100) return { rank: "VETERAN", label: "Experienced Hero", color: "#33cc33" };
    if (score >= 50) return { rank: "SOLDIER", label: "Guild Soldier", color: "#4db8ff" };
    return { rank: "NOVICE", label: "Initiate Hero", color: "#999999" };
  };
  const rankInfo = getRankInfo(totalGLScore);
  
  // Calculate Next Rank
  const nextRankThresholds = [50, 100, 150, 200];
  const nextThreshold = nextRankThresholds.find(t => t > totalGLScore) || 200;
  const pointsToNextRank = nextThreshold - totalGLScore;

  const level = Math.max(1, Math.floor(Math.sqrt(totalGLScore * 5)));
  const nextLevelScore = Math.pow((level + 1) / 5, 2);
  const prevLevelScore = Math.pow(level / 5, 2);
  const levelProgress = Math.min(100, Math.round(((totalGLScore - prevLevelScore) / (nextLevelScore - prevLevelScore || 1)) * 100));

  // 6. Updated Radar Chart Data (Removed SPI/EO Rating)
  const totalKills = glEvents.reduce((sum, e) => sum + (e.perf?.kills || 0), 0);
  const totalAssists = glEvents.reduce((sum, e) => sum + (e.perf?.assists || 0), 0);
  
  const radarData = [
    { subject: 'Combat', full: 'TOTAL SCORE', icon: '⚔️', A: totalGLScore, B: guildAvgGL, fullMark: Math.max(totalGLScore, guildAvgGL, 100) },
    { subject: 'Kills', full: 'KILLS', icon: '🔥', A: totalKills, B: 50, fullMark: 100 },
    { subject: 'Assists', full: 'ASSISTS', icon: '🤝', A: totalAssists, B: 50, fullMark: 100 },
    { subject: 'Duty', full: 'ATTENDANCE', icon: '🛡️', A: attPct, B: 75, fullMark: 100 },
    { subject: 'Reliability', full: 'STABILITY', icon: '⚖️', A: Math.max(0, 100 - (memberAbsences.length * 10)), B: 90, fullMark: 100 },
  ];


  // 7. Next Event Logic
  const { nextEvent, isUpcoming } = React.useMemo(() => {
    const todayTs = new Date().setHours(0, 0, 0, 0);
    let nearestUpcoming = null;
    let latestPast = null;
    events.forEach((ev) => {
      const ts = new Date(ev.eventDate).getTime();
      if (ts >= todayTs) {
        if (!nearestUpcoming || ts < new Date(nearestUpcoming.eventDate).getTime()) nearestUpcoming = ev;
      } else if (!latestPast || ts > new Date(latestPast.eventDate).getTime()) {
        latestPast = ev;
      }
    });
    return { nextEvent: nearestUpcoming || latestPast, isUpcoming: !!nearestUpcoming };
  }, [events]);

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
  const attendedGLEvents = glEvents.filter(e => (e.att?.status || "present") === "present");
  const bestEvent = attendedGLEvents.reduce((best, e) => (!best || e.score > best.score ? e : best), null);
  const worstEvent = attendedGLEvents.reduce((worst, e) => (!worst || e.score < worst.score ? e : worst), null);
  // Win streak: consecutive events attended (most recent first)
  let winStreak = 0;
  for (const ev of memberEvents) {
    if ((ev.att?.status || "present") === "present") winStreak++;
    else break;
  }
  const toggleCollapse = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // 9. My Loot History from Auction Builder
  const myLootHistory = React.useMemo(() => {
    const entries = [];
    (auctionSessions || []).forEach(session => {
      const memberEntry = (session.members || []).find(sm => sm.memberId === member.memberId);
      if (!memberEntry) return;
      (session.columns || []).forEach(col => {
        const key = `${member.memberId}_${col.id}`;
        const tags = (session.cells || {})[key] || [];
        if (tags.length > 0) {
          entries.push({ session: session.name, date: session.date, column: col.name, tags });
        }
      });
    });
    return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [auctionSessions, member.memberId]);

  // --- Participation Heatmap Logic ---
  const eventsByDate = React.useMemo(() => {
    const map = new Map();
    memberEvents.forEach(e => map.set(e.eventDate, e));
    return map;
  }, [memberEvents]);
  const heatmapData = React.useMemo(() => {
    const data = [];
    const today = new Date();
    // 21 weeks (approx 5 months)
    for (let i = 146; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const ev = eventsByDate.get(dateStr);
      let status = "no-event";
      if (ev) {
        if ((ev.att?.status || "present") === "present") {
          status = ev.eventType === "Guild League" ? "present-gl" : "present-eo";
        } else {
          status = "absent";
        }
      }
      data.push({ date: dateStr, status, ev });
    }
    return data;
  }, [eventsByDate]);

  const renderParticipationHeatmap = () => (
    <div className="heatmap-container animate-fade-in">
      <div className="heatmap-grid">
        {heatmapData.map((day, i) => (
          <div
            key={i}
            className={`heatmap-cell ${day.status}`}
            title={`${day.date}: ${day.ev ? day.ev.eventType + ' (' + day.status + ')' : 'No Event'}`}
          />
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        <div className="legend-item"><div className="legend-box no-event" /><span>None</span></div>
        <div className="legend-item"><div className="legend-box" style={{ background: 'var(--green)' }} /><span>GL Present</span></div>
        <div className="legend-item"><div className="legend-box" style={{ background: 'var(--gold)' }} /><span>EO Present</span></div>
        <div className="legend-item"><div className="legend-box" style={{ background: 'var(--red)' }} /><span>Absent</span></div>
        <span>More</span>
      </div>
    </div>
  );

  const chartData = React.useMemo(() => {
    return [...memberEvents].reverse().map(ev => ({
      date: ev.eventDate.split('-').slice(1).join('/'), // Concise date
      fullDate: ev.eventDate,
      score: ev.eventType === "Guild League" ? ev.score : null,
      rating: ev.eventType === "Emperium Overrun" ? ev.eoRating?.rating : null,
      present: (ev.att?.status || "present") === "present",
      type: ev.eventType
    }));
  }, [memberEvents]);


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

  const handleRequestSubmit = async () => {
    const success = await submitRequest(member.memberId, requestForm);
    if (success) setShowRequestModal(false);
  };

  const handleRepairHistory = async () => {
    const oldId = window.prompt(`🛠️ REPAIR DATA LINK\n\nEnter the PREVIOUS Member ID (UID) for ${member.ign} to restore their scores and attendance:`);
    if (!oldId) return;
    
    if (window.confirm(`CONFIRM MIGRATION:\n\nMigrate all past records from ${oldId} to ${member.memberId}?\n\nThis will re-link all attendance and score data for ${member.ign}.`)) {
      const result = await migrateMemberData(oldId.trim(), (member.memberId || "").trim());
      if (result.success) {
        // Reload to let GuildContext fetch the updated documents
        setTimeout(() => window.location.reload(), 2000);
      }
    }
  };

  if (isAccessDenied) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
        <h2 className="page-title">Access Denied</h2>
        <p className="text-muted">You are only permitted to view your own performance profile.</p>
        <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Return to My Profile</button>
      </div>
    );
  }

  return (
    <div>
      {/* Sticky mini-bar header */}
      <div className="profile-header-sticky">
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
            <span className={`badge ${attStatus.badge}`} title={`Attendance Score: ${attPct}% (${presentCount}/${memberEvents.length})\n\nReliable: 80%+\nAverage: 60-79%\nAt Risk: Below 60%`}>
              {attPct >= 80 ? "✅" : attPct >= 60 ? "⚠" : "🚨"} {attStatus.label}
            </span>
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
              {isUpcoming ? "📅 Upcoming Mission" : "📅 Most Recent Event"}
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 16 }}>{nextEvent.eventType === "Guild League" ? "⚔️" : "🏰"}</span>
              <span style={{ fontWeight: 700, fontFamily: "Cinzel, serif" }}>{nextEvent.eventType} — {nextEvent.eventDate}</span>
              {!isUpcoming && <span className="badge badge-atrisk" style={{ fontSize: 9 }}>Past</span>}
            </div>
          </div>
          {isOwnProfile && isUpcoming && (
            <button className="btn btn-danger btn-sm" onClick={quickAbsence} title="File a quick absence notification for this event">Notify Absence 📢</button>
          )}
        </div>
      )}

      {/* Pending Request Banner */}
      {myPendingRequest && (
        <div className="card mb-4" style={{
          background: "rgba(99,130,230,0.05)",
          border: "1px solid var(--accent)",
          display: "flex", alignItems: "center", gap: 12, padding: "12px 20px"
        }}>
          <div className="animate-pulse" style={{ fontSize: 20 }}>⏳</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: 13 }}>Update Request Pending</div>
            <p className="text-xs text-muted">You requested a change: <strong>{myPendingRequest.newData.ign}</strong> ({myPendingRequest.newData.class}). Please wait for an officer to approve.</p>
          </div>
          <button className="btn btn-ghost btn-sm" disabled>Waiting...</button>
        </div>
      )}

      <div className="portal-hero-wrapper">
        <MotionDiv
          className="portal-hero animate-fade-in" 
          style={{ 
            borderColor: theme.color,
            rotateX, rotateY, transformStyle: "preserve-3d"
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* 3D Glare Overlay */}
          <MotionDiv style={{
            position: "absolute", width: "200%", height: "200%",
            top: "-50%", left: "-50%", zIndex: 30, pointerEvents: "none",
            background: `radial-gradient(circle at center, rgba(255,255,255,0.4) 0%, transparent 60%)`,
            x: glareX, y: glareY, opacity: glareOpacity, mixBlendMode: "overlay"
          }} />

          {/* Holographic Shimmer Overlay */}
          <MotionDiv style={{
            position: "absolute", inset: "-10%", zIndex: 25, pointerEvents: "none",
            background: `linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.1) 30%, ${theme.color}44 40%, transparent 50%, rgba(255,255,255,0.1) 60%, transparent 70%)`,
            backgroundSize: "200% 200%",
            backgroundPosition: holoBgPosition,
            opacity: holoOpacity,
            mixBlendMode: "color-dodge"
          }} />

          <div className="portal-hero-bg" style={{ background: `radial-gradient(circle at 70% 30%, ${theme.color}, transparent 60%)` }} />
          <div className="flex flex-col items-center gap-3" style={{ zIndex: 2, position: "relative", minWidth: 150, transform: "translateZ(30px)" }}>
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
                <span className={`badge ${attStatus.badge}`} title={`Thresholds:\nReliable: 80%+\nAverage: 60-79%\nAt Risk: Below 60%`}>
                  🎯 {attStatus.label} ({attPct}%)
                </span>
                {dynamicBadges.map((b, i) => (
                  <span key={i} title={`${b.label}: ${b.desc}`} style={{ 
                    fontSize: 18, cursor: "help", filter: `drop-shadow(0 0 6px ${b.color}66)`,
                    animation: `floatUpDown ${3 + i}s ease-in-out infinite`
                  }}>
                    {b.icon}
                  </span>
                ))}

              </div>
              <div className="rank-label" style={{ color: "var(--text-muted)", fontSize: 12, letterSpacing: 2 }}>{rankInfo.label}</div>
            </div>
            <div className="flex gap-2 items-center">
              {isArchitect && (
                <div className="flex gap-2">
                  <button className="btn btn-sm" style={{ background: "rgba(240,192,64,0.1)", color: "var(--gold)", border: "1px solid var(--gold)" }} onClick={toggleDonator}>
                    {member.isDonator ? "Revoke Patron" : "Grant Patron 🌟"}
                  </button>
                  <button className="btn btn-sm" style={{ background: "rgba(99,130,230,0.1)", color: "var(--accent)", border: "1px solid var(--accent)" }} onClick={handleRepairHistory}>
                    🛠️ Repair History
                  </button>
                </div>
              )}
              {isOwnProfile && (
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={() => isEditingBio ? saveSocialData() : setIsEditingBio(true)}>
                    {isEditingBio ? "💾 Save" : "✏️ Edit Bio"}
                  </button>
                  {!myPendingRequest && (
                    <button className="btn btn-sm" style={{ background: "rgba(99,130,230,0.1)", color: "var(--accent)", border: "1px solid var(--accent)" }} onClick={() => setShowRequestModal(true)}>
                      ⚔️ Request Update
                    </button>
                  )}
                </div>
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
            {pointsToNextRank > 0 && (
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 6, textAlign: "right", letterSpacing: 1 }}>
                {pointsToNextRank} POINTS UNTIL NEXT RANK
              </div>
            )}
          </div>
        </div>
        </MotionDiv>
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
        <div className="stat-card" style={{ "--stat-accent": attPct >= 75 ? "var(--green)" : attPct >= 50 ? "var(--gold)" : "var(--red)" }} 
          title={`Calculation: (Present Events / Total Events) * 100\n\nYour stats: ${presentCount} present out of ${memberEvents.length} operations.`}>
          <div className="stat-icon">📋</div>
          <div className="stat-label">War Duty</div>
          <div className="stat-value" style={{ color: attPct >= 75 ? "var(--green)" : attPct >= 50 ? "var(--gold)" : "var(--red)" }}>{attPct}%</div>
          <div className="stat-change">{presentCount} of {memberEvents.length} events</div>
        </div>
        <div className="stat-card" style={{ "--stat-accent": "var(--accent)" }}>
          <div className="stat-icon">🔥</div>
          <div className="stat-label">Total Kills</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{totalKills}</div>
          <div className="stat-change">career combat kills</div>
        </div>

        <div className="stat-card" style={{ "--stat-accent": "var(--color-priest)" }}>
          <div className="stat-icon">🤝</div>
          <div className="stat-label">Total Assists</div>
          <div className="stat-value" style={{ color: "var(--color-priest)" }}>{totalAssists}</div>
          <div className="stat-change">career combat assists</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: "flex",
        gap: 4,
        marginBottom: 20,
        background: "var(--bg-card2)",
        borderRadius: 12,
        padding: 6,
        overflowX: isMobile ? "auto" : "visible",
        scrollbarWidth: "thin"
      }}>
        {[
          { id: "overview", label: "📊 Overview" },
          { id: "history", label: "📅 History" },
          { id: "achievements", label: "🏆 Achievements" },
          { id: "notifications", label: `🔔 Alerts ${unreadCount > 0 ? `(${unreadCount})` : ''}` },
          { id: "absences", label: `⚠️ Absences (${memberAbsences.length})` },
          ...(isOwnProfile ? [{ id: "mystats", label: "✨ My Stats" }] : []),
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              flex: isMobile ? "0 0 auto" : 1,
              minWidth: isMobile ? 120 : "auto",
              padding: isMobile ? "7px 10px" : "8px 12px",
              borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s",
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
          {isMobile && (
            <div className="card mb-4" style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 12px" }}>
              <button className={`btn btn-sm ${mobileShowHeatmap ? "btn-primary" : "btn-ghost"}`} onClick={() => setMobileShowHeatmap(v => !v)}>
                {mobileShowHeatmap ? "Hide Heatmap" : "Show Heatmap"}
              </button>
              <button className={`btn btn-sm ${mobileShowCharts ? "btn-primary" : "btn-ghost"}`} onClick={() => setMobileShowCharts(v => !v)}>
                {mobileShowCharts ? "Hide Charts" : "Show Charts"}
              </button>
            </div>
          )}

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

          <div className="card mb-4" style={{ overflow: "hidden" }}>
            <div className="card-title">⭐ Loot Wishlist</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: 20, marginTop: 10 }}>
              
              {/* Card Album Progress */}
              <div style={{ 
                background: "var(--bg-hover)", borderRadius: 12, padding: 16, border: "1px solid var(--border)",
                display: "flex", flexDirection: "column", gap: 12
              }}>
                <div className="flex justify-between items-center">
                  <div style={{ fontFamily: "Cinzel, serif", fontWeight: 700, fontSize: 13, color: "var(--accent)" }}>🎴 Card Album Collection</div>
                  <div className="badge badge-casual" style={{ fontSize: 10 }}>10 WINS = 1 CARD</div>
                </div>
                
                {(() => {
                  const wishEntry = auctionWishlist.find(b => b.id === member.memberId);
                  const albumWish = wishEntry?.bids?.find(bi => bi.type === "Card Album");
                  const manualCount = albumWish?.currentCount;
                  
                  // Use manual count if provided, otherwise fallback to session-derived stats
                  const cardWins = manualCount !== undefined ? manualCount : (memberLootStats[member.memberId]?.cardAlbums || 0);
                  const progress = cardWins % 10;
                  const totalCards = Math.floor(cardWins / 10);
                  return (
                    <>
                      <div className="flex items-start justify-between">
                        <div style={{ display: "flex", flexDirection: "column" }}>
                           <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)", textShadow: "var(--text-shadow-accent)" }}>
                             {progress}<span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700 }}> / 10</span>
                           </div>
                           <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: -2 }}>ALBUMS HELD</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                           <div style={{ fontSize: 16, fontWeight: 900, color: "var(--gold)" }}>🏆 {totalCards}</div>
                           <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase" }}>Completed Cards</div>
                        </div>
                      </div>
                      
                      <div style={{ width: "100%", height: 10, background: "var(--bg-deepest)", borderRadius: 5, overflow: "hidden", position: "relative", border: "1px solid var(--border)" }}>
                        <div style={{ 
                          width: `${progress * 10}%`, height: "100%", 
                          background: `linear-gradient(90deg, var(--accent), var(--accent-glow))`,
                          boxShadow: "0 0 10px var(--accent-glow)",
                          transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
                        }} />
                        {progress >= 9 && <div className="animate-pulse" style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.1)" }} />}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                        {progress >= 9 ? "🔥 Almost there! One more win to complete your card." : `You need ${10 - progress} more wins to complete your next card.`}
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <button 
                            className="btn btn-ghost btn-sm"
                            style={{ flex: 1, fontSize: 10, border: "1px solid var(--border)" }}
                          onClick={() => {
                             const val = prompt("Enter your current total Card Album wins:", cardWins);
                             if (val !== null) {
                                const num = parseInt(val);
                                if (!isNaN(num)) updateWishlistMetadata(member.memberId, "Card Album", { currentCount: num });
                             }
                          }}
                        >
                          Input your current Album Card count
                        </button>
                        <button 
                           className={`btn btn-sm ${albumWish ? "btn-danger" : "btn-primary"}`}
                           style={{ flex: 1.2, fontSize: 10 }}
                           onClick={() => {
                             if (albumWish) removeWishlistRequest(member.memberId, "Card Album");
                             else submitWishlistRequest(member.memberId, "Card Album");
                           }}
                        >
                           {albumWish ? "Remove Wishlist" : "⭐ Add to Wishlist"}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Feather Progress & Bidding */}
              <div style={{ 
                background: "var(--bg-hover)", borderRadius: 12, padding: 16, border: "1px solid var(--border)",
                display: "flex", flexDirection: "column", gap: 12
              }}>
                <div style={{ fontFamily: "Cinzel, serif", fontWeight: 700, fontSize: 13, color: "var(--gold)" }}>🪶 L&D Feather Progress</div>
                
                <div className="flex items-center justify-between">
                  <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>
                    {memberLootStats[member.memberId]?.feathers || 0}
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginLeft: 4 }}>WINS</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-deepest)", padding: "2px 6px", borderRadius: 4 }}>
                    LIFETIME
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-auto">
                   <button 
                      className={`btn btn-sm ${auctionWishlist.find(b => b.id === member.memberId)?.bids?.some(bi => bi.type === "Light & Dark") ? "btn-danger" : "btn-casual"}`}
                      style={{ fontSize: 11, width: "100%" }}
                      onClick={() => {
                        const active = auctionWishlist.find(b => b.id === member.memberId)?.bids?.some(bi => bi.type === "Light & Dark");
                        if (active) removeWishlistRequest(member.memberId, "Light & Dark");
                        else submitWishlistRequest(member.memberId, "Light & Dark");
                      }}
                   >
                      {auctionWishlist.find(b => b.id === member.memberId)?.bids?.some(bi => bi.type === "Light & Dark") ? "❌ Remove from Wishlist" : "⭐ Add to Wishlist"}
                   </button>
                   {auctionWishlist.find(b => b.id === member.memberId)?.bids?.some(bi => bi.type === "Light & Dark") && (
                     <div className="animate-pulse" style={{ fontSize: 9, color: "var(--green)", textAlign: "center", fontWeight: 800 }}>
                        ✨ WISHLIST ACTIVE FOR NEXT AUCTION
                     </div>
                   )}
                </div>
              </div>

            </div>
            
            <div style={{ padding: "0 20px 20px" }}>
               <div className="glass-card" style={{ padding: 14, border: "1px dashed rgba(240,192,64,0.3)", background: "rgba(240,192,64,0.05)", borderRadius: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                     <div style={{ marginTop: 2, padding: 8, background: "rgba(240,192,64,0.1)", borderRadius: 8 }}>
                        <Icon name="info" size={16} color="var(--gold)" />
                     </div>
                     <div>
                        <div style={{ fontWeight: 800, fontSize: 12, color: "var(--gold)", marginBottom: 4, letterSpacing: 1, fontFamily: "Cinzel, serif" }}>AUCTION GUIDELINES & POLICY</div>
                        <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.6, opacity: 0.9 }}>
                           Wishlist items prioritize your visibility to officers but do not guarantee an immediate slot. 
                           Loot distribution follows a <strong>rotational distribution system</strong> to ensure fairness across all qualified guild members.
                           Please update your <strong>In-Game Count</strong> regularly to keep your progress accurate.
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          {/* Participation Heatmap */}
          {(!isMobile || mobileShowHeatmap) && (
            <div className="card mb-4">
              <div className="card-title">📅 Participation Heatmap (Last 5 Months)</div>
              {renderParticipationHeatmap()}
            </div>
          )}

          {/* Radar + Chart row */}
          {(!isMobile || mobileShowCharts) && (
          <div className="grid-2 mb-4">
            <ProfileRadarChartCard radarData={radarData} themeColor={theme.color} />
            <ProfilePerformanceChartCard chartData={chartData} themeColor={theme.color} />
          </div>
          )}
        </div>
      )}

      {/* Tab: Achievements (Medal Hall) */}
      {activeTab === "achievements" && (
        <div className="animate-fade-in">
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div style={{ padding: 10, background: "rgba(240,192,64,0.1)", borderRadius: 12, color: "var(--gold)" }}>
                <Icon name="star" size={24} />
              </div>
              <div>
                <h3 className="font-cinzel" style={{ fontSize: 20, margin: 0 }}>Medal Hall</h3>
                <p className="text-xs text-muted">A testament to your loyalty and combat prowess</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {[
                { id: "reliability", icon: "🛡️", label: "Shield of Reliability", criteria: "100% attendance in last 4 events", color: "#4db8ff" },
                { id: "blade", icon: "⚔️", label: "Blade of Oblivion", criteria: "Score 30+ in a single War", color: "var(--red)" },
                { id: "star", icon: "🌟", label: "Star of the Empire", criteria: "Earn a 5-star EO rating", color: "var(--gold)" },
                { id: "vanguard", icon: "🔥", label: "Frontline Vanguard", criteria: "Top scorer in the last War", color: "#ff4d4d" },
              ].map(medal => {
                const isEarned = dynamicBadges.some(b => b.id === medal.id);
                return (
                  <div key={medal.id} className={`glass-card ${!isEarned ? 'locked' : ''}`} style={{ 
                    padding: 20, border: `1px solid ${isEarned ? medal.color + '44' : 'var(--border)'}`,
                    background: isEarned ? `linear-gradient(135deg, ${medal.color}11, transparent)` : 'transparent',
                    opacity: isEarned ? 1 : 0.4,
                    transition: "all 0.3s ease",
                    position: "relative",
                    overflow: "hidden"
                  }}>
                    {isEarned && (
                      <div style={{ position: "absolute", top: -10, right: -10, width: 40, height: 40, background: medal.color, opacity: 0.1, borderRadius: "50%", filter: "blur(20px)" }} />
                    )}
                    <div className="flex items-center gap-4">
                      <div style={{ 
                        fontSize: 32, filter: isEarned ? `drop-shadow(0 0 8px ${medal.color})` : 'grayscale(1)',
                        animation: isEarned ? 'floatUpDown 3s ease-in-out infinite' : 'none'
                      }}>
                        {medal.icon}
                      </div>
                      <div>
                        <div style={{ 
                          fontFamily: "Cinzel, serif", fontSize: 14, fontWeight: 700, 
                          color: isEarned ? "var(--text-primary)" : "var(--text-muted)" 
                        }}>
                          {medal.label}
                        </div>
                        <div style={{ fontSize: 10, letterSpacing: 1, color: isEarned ? medal.color : "var(--text-muted)", textTransform: "uppercase", marginTop: 2 }}>
                          {isEarned ? "Unlocked" : "Locked"}
                        </div>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
                          {isEarned ? dynamicBadges.find(b => b.id === medal.id).desc : `Criteria: ${medal.criteria}`}
                        </p>
                      </div>
                    </div>
                    {!isEarned && (
                      <div className="achievement-progress-wrap">
                        <div className="achievement-progress-fill" style={{ width: "30%", opacity: 0.3 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Participation Milestones */}
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
               <h4 className="font-cinzel" style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>Participation Milestones</h4>
               <div className="flex gap-4 flex-wrap">
                  {[10, 25, 50, 100].map(m => {
                    const progress = Math.min(100, Math.round((memberEvents.length / m) * 100));
                    return (
                      <div key={m} style={{ flex: 1, minWidth: 120, padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid var(--border)" }}>
                        <div className="flex justify-between items-end mb-2">
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{m} EVENTS</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: progress === 100 ? "var(--gold)" : "var(--text-secondary)" }}>{progress}%</span>
                        </div>
                        <div className="progress-bar-wrap" style={{ height: 4 }}>
                          <div className="progress-bar-fill" style={{ width: `${progress}%`, background: progress === 100 ? "var(--gold)" : "var(--accent)" }} />
                        </div>
                      </div>
                    );
                  })}
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
                const isPresent = (ev.att?.status || "present") === "present";
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
                        {isPresent ? (
                          <span style={{ fontFamily: "Cinzel,serif", fontWeight: 700, color: theme.color, fontSize: 18 }}>{isGL ? ev.score : "P"}</span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: 12 }}>A</span>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

      {/* Tab: My Stats (Own profile only) */}
      {activeTab === "mystats" && isOwnProfile && (() => {
        const radius = 52;
        const circumference = 2 * Math.PI * radius;
        const strokeDash = (attPct / 100) * circumference;
        const attColor = attPct >= 75 ? "var(--green)" : attPct >= 50 ? "var(--gold)" : "var(--red)";
        return (
          <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Row 1: Vanguard Profile Card + Attendance Ring */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div className="card" style={{ 
                background: `linear-gradient(180deg, ${theme.color}08 0%, var(--bg-card2) 100%)`, 
                border: `1px solid ${theme.color}33`, 
                padding: 24 
              }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: theme.color, marginBottom: 16, fontWeight: 800 }}>⚔️ Vanguard Profile</div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                  <MemberAvatar ign={member.ign} index={memberIdx} size={56} memberClass={member.class} glScore={totalGLScore} hexagon />
                  <div>
                    <div style={{ fontFamily: "Cinzel,serif", fontWeight: 900, fontSize: 18, color: "var(--text-primary)", textShadow: `0 0 20px ${theme.color}66` }}>{member.ign}</div>
                    <div style={{ fontSize: 11, color: theme.color, fontWeight: 700, marginTop: 2 }}>{theme.icon} {member.class}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>ID: {member.memberId}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="badge badge-premium" style={{ background: theme.color, fontSize: 11 }}>{theme.icon} {member.class}</span>
                  <span className={`badge ${member.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 11 }}>{member.role}</span>
                  <span className="badge" style={{ background: `${rankInfo.color}22`, color: rankInfo.color, border: `1px solid ${rankInfo.color}`, fontSize: 10 }}>{rankInfo.rank} · LV.{level}</span>
                  {member.guildRank && member.guildRank !== "Member" && (
                    <span className="badge" style={{ background: "rgba(240,192,64,0.1)", color: "var(--gold)", border: "1px solid rgba(240,192,64,0.3)", fontSize: 10 }}>🏅 {member.guildRank}</span>
                  )}
                </div>
                {member.motto && (
                  <div style={{ marginTop: 16, fontStyle: "italic", color: "var(--text-secondary)", fontSize: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>"{member.motto}"</div>
                )}
              </div>

              {/* Attendance Ring */}
              <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 800 }}>📋 War Duty Score</div>
                <div style={{ position: "relative", width: 140, height: 140 }}>
                  <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                    <circle
                      cx="70" cy="70" r={radius} fill="none"
                      stroke={attColor}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${strokeDash} ${circumference}`}
                      style={{ filter: `drop-shadow(0 0 8px ${attColor})`, transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)" }}
                    />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                    <div style={{ fontFamily: "Cinzel,serif", fontWeight: 900, fontSize: 28, color: attColor, textShadow: `0 0 16px ${attColor}66` }}>{attPct}%</div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Attendance</div>
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{presentCount} of {memberEvents.length} events</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Status: <span style={{ color: attColor, fontWeight: 700 }}>{attStatus.label}</span></div>
                </div>
              </div>
            </div>

            {/* Row 2: Quick Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { label: "Total GL Score", value: totalGLScore, icon: "⚔️", color: "var(--gold)" },
                { label: "Avg GL / War", value: avgGL || "—", icon: "📊", color: "var(--accent)" },
                { label: "Absences Filed", value: memberAbsences.length, icon: "⚠️", color: memberAbsences.length > 3 ? "var(--red)" : "var(--green)" },
              ].map(stat => (
                <div key={stat.label} style={{ background: `${stat.color}0A`, border: `1px solid ${stat.color}22`, borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
                  <div style={{ fontFamily: "Cinzel,serif", fontSize: 22, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Row 3: My Loot History */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--gold)", fontWeight: 800, flex: 1 }}>💎 My Loot History</div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{myLootHistory.length} entries</span>
              </div>
              {myLootHistory.length === 0 ? (
                <div className="empty-state" style={{ padding: "24px 0" }}>
                  <div className="empty-state-icon">📦</div>
                  <div className="empty-state-text">No loot recorded yet.</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Items from Auction Builder sessions will appear here.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {myLootHistory.map((entry, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "12px 14px",
                      background: "rgba(240,192,64,0.04)", border: "1px solid rgba(240,192,64,0.12)",
                      borderRadius: 12, borderLeft: "3px solid var(--gold)"
                    }}>
                      <div style={{ fontSize: 20 }}>💎</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{entry.column}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{entry.session} · {entry.date}</div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {entry.tags.map((tag, ti) => (
                          <span key={ti} style={{
                            fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                            background: tag.toLowerCase().includes("upto") ? "rgba(240,192,64,0.15)" : tag.toLowerCase().includes("rw") ? "rgba(224,92,138,0.15)" : "rgba(64,201,122,0.15)",
                            color: tag.toLowerCase().includes("upto") ? "var(--gold)" : tag.toLowerCase().includes("rw") ? "var(--accent2)" : "var(--green)",
                            border: `1px solid ${tag.toLowerCase().includes("upto") ? "rgba(240,192,64,0.3)" : tag.toLowerCase().includes("rw") ? "rgba(224,92,138,0.3)" : "rgba(64,201,122,0.3)"}`
                          }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Profile Request Modal Placeholder (Already correctly handled below usually) */}

      {showRequestModal && (
        <div className="modal-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card animate-fade-in" style={{ maxWidth: 450, border: "2px solid var(--accent)" }}>
            <div className="card-title">🛡️ Vanguard Profile Request</div>
            <p className="text-secondary text-xs mb-6">Use this to request a change in your In-Game Name, Job Class, or Role. This requires Officer approval.</p>
            
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">New IGN</label>
                <input className="form-input" value={requestForm.ign} onChange={e => setRequestForm({...requestForm, ign: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">New Class</label>
                <select className="form-select" value={requestForm.class} onChange={e => setRequestForm({...requestForm, class: e.target.value})}>
                  {JOB_CLASSES.map(branch => (
                    <optgroup key={branch.branch} label={branch.branch}>
                      {branch.jobs.map(j => <option key={j.name} value={j.name}>{j.emoji} {j.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">New Role</label>
                <select className="form-select" value={requestForm.role} onChange={e => setRequestForm({...requestForm, role: e.target.value})}>
                  <option value="DPS">DPS</option>
                  <option value="Support">Support / Utility</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button className="btn btn-ghost" onClick={() => setShowRequestModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRequestSubmit}>Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemberProfilePage;