import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const INITIAL_MEMBERS = [
  { memberId: "OBL001", ign: "DarkReaper", class: "Assassin Cross", role: "DPS" },
  { memberId: "OBL002", ign: "HolyShield", class: "High Priest", role: "Support" },
  { memberId: "OBL003", ign: "StormBlade", class: "Lord Knight", role: "DPS" },
  { memberId: "OBL004", ign: "SilentArrow", class: "Sniper", role: "DPS" },
  { memberId: "OBL005", ign: "ArcaneVeil", class: "High Wizard", role: "DPS" },
  { memberId: "OBL006", ign: "IronFortress", class: "Paladin", role: "Support" },
  { memberId: "OBL007", ign: "NightCrawler", class: "Stalker", role: "DPS" },
  { memberId: "OBL008", ign: "MysticHeal", class: "Professor", role: "Support" },
  { memberId: "OBL009", ign: "BlazeKnight", class: "Crusader", role: "DPS" },
  { memberId: "OBL010", ign: "VoidWalker", class: "Rogue", role: "DPS" },
];

const INITIAL_EVENTS = [
  { eventId: "EVT001", eventType: "Guild League", eventDate: "2025-07-07" },
  { eventId: "EVT002", eventType: "Guild League", eventDate: "2025-07-08" },
  { eventId: "EVT003", eventType: "Emperium Overrun", eventDate: "2025-07-09" },
  { eventId: "EVT004", eventType: "Guild League", eventDate: "2025-07-10" },
];

const INITIAL_ATTENDANCE = [
  { memberId: "OBL001", eventId: "EVT001", status: "present" },
  { memberId: "OBL002", eventId: "EVT001", status: "present" },
  { memberId: "OBL003", eventId: "EVT001", status: "absent" },
  { memberId: "OBL004", eventId: "EVT001", status: "present" },
  { memberId: "OBL005", eventId: "EVT001", status: "absent" },
  { memberId: "OBL006", eventId: "EVT001", status: "present" },
  { memberId: "OBL007", eventId: "EVT001", status: "present" },
  { memberId: "OBL008", eventId: "EVT001", status: "present" },
  { memberId: "OBL009", eventId: "EVT001", status: "absent" },
  { memberId: "OBL010", eventId: "EVT001", status: "present" },
  { memberId: "OBL001", eventId: "EVT002", status: "present" },
  { memberId: "OBL002", eventId: "EVT002", status: "absent" },
  { memberId: "OBL003", eventId: "EVT002", status: "present" },
  { memberId: "OBL004", eventId: "EVT002", status: "present" },
  { memberId: "OBL005", eventId: "EVT002", status: "present" },
  { memberId: "OBL006", eventId: "EVT002", status: "present" },
  { memberId: "OBL007", eventId: "EVT002", status: "absent" },
  { memberId: "OBL008", eventId: "EVT002", status: "present" },
  { memberId: "OBL009", eventId: "EVT002", status: "present" },
  { memberId: "OBL010", eventId: "EVT002", status: "present" },
  ...INITIAL_MEMBERS.map((m) => ({ memberId: m.memberId, eventId: "EVT003", status: Math.random() > 0.25 ? "present" : "absent" })),
  ...INITIAL_MEMBERS.map((m) => ({ memberId: m.memberId, eventId: "EVT004", status: Math.random() > 0.2 ? "present" : "absent" })),
];

const INITIAL_PERFORMANCE = [
  { memberId: "OBL001", eventId: "EVT001", ctfPoints: 8, performancePoints: 12 },
  { memberId: "OBL002", eventId: "EVT001", ctfPoints: 3, performancePoints: 18 },
  { memberId: "OBL004", eventId: "EVT001", ctfPoints: 6, performancePoints: 10 },
  { memberId: "OBL006", eventId: "EVT001", ctfPoints: 2, performancePoints: 20 },
  { memberId: "OBL007", eventId: "EVT001", ctfPoints: 5, performancePoints: 9 },
  { memberId: "OBL008", eventId: "EVT001", ctfPoints: 1, performancePoints: 16 },
  { memberId: "OBL010", eventId: "EVT001", ctfPoints: 7, performancePoints: 11 },
  { memberId: "OBL001", eventId: "EVT002", ctfPoints: 10, performancePoints: 14 },
  { memberId: "OBL003", eventId: "EVT002", ctfPoints: 9, performancePoints: 13 },
  { memberId: "OBL004", eventId: "EVT002", ctfPoints: 7, performancePoints: 8 },
  { memberId: "OBL005", eventId: "EVT002", ctfPoints: 4, performancePoints: 11 },
  { memberId: "OBL006", eventId: "EVT002", ctfPoints: 2, performancePoints: 22 },
  { memberId: "OBL008", eventId: "EVT002", ctfPoints: 1, performancePoints: 19 },
  { memberId: "OBL009", eventId: "EVT002", ctfPoints: 6, performancePoints: 9 },
  { memberId: "OBL010", eventId: "EVT002", ctfPoints: 8, performancePoints: 12 },
  ...INITIAL_MEMBERS.map((m) => ({ memberId: m.memberId, eventId: "EVT004", ctfPoints: Math.floor(Math.random() * 10), performancePoints: Math.floor(Math.random() * 20) })),
];

// ─── SCORING ENGINE ───────────────────────────────────────────────────────────
function computeScore({ member, event, att, perf }) {
  const isPresent = att?.status === "present";
  if (event.eventType === "Emperium Overrun") {
    return isPresent ? 3 : -5;
  }
  if (!isPresent) return -5;
  const ctf = perf?.ctfPoints ?? 0;
  const pp = perf?.performancePoints ?? 0;
  const isSupport = member?.role === "Support";
  const weightedPP = isSupport ? pp * 1.5 : pp;
  return ctf * 2 + weightedPP + 3;
}

function computeLeaderboard(members, events, attendance, performance) {
  return members.map((member) => {
    let totalScore = 0;
    let presentCount = 0;
    const eventCount = events.length;
    events.forEach((event) => {
      const att = attendance.find((a) => a.memberId === member.memberId && a.eventId === event.eventId);
      const perf = performance.find((p) => p.memberId === member.memberId && p.eventId === event.eventId);
      totalScore += computeScore({ member, event, att, perf });
      if (att?.status === "present") presentCount++;
    });
    const attendancePct = eventCount > 0 ? Math.round((presentCount / eventCount) * 100) : 0;
    const avgScore = eventCount > 0 ? Math.round((totalScore / eventCount) * 10) / 10 : 0;
    let classification = "At Risk";
    if (totalScore > 80) classification = "Core";
    else if (totalScore >= 60) classification = "Active";
    else if (totalScore >= 40) classification = "Casual";
    return { ...member, totalScore, attendancePct, avgScore, classification };
  }).sort((a, b) => b.totalScore - a.totalScore)
    .map((m, i) => ({ ...m, rank: i + 1 }));
};

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 18 }) => {
  const icons = {
    dashboard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    members: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    events: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    leaderboard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>,
    party: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    absence: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    edit: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    sword: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>,
    shield: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    x: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    close: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    crown: <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L8 8l-6 1 4.5 4.5L5 20h14l-1.5-6.5L22 9l-6-1z"/></svg>,
    trophy: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 21h8m-4-4v4M17 3H7l1.5 9h7z"/><path d="M7 3H4l1 5h2"/><path d="M17 3h3l-1 5h-2"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    save: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
    menu: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    refresh: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  };
  return icons[name] || null;
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap');

  :root {
    --bg-deepest: #080a0f;
    --bg-dark: #0d1017;
    --bg-card: #111520;
    --bg-card2: #161c2e;
    --bg-hover: #1a2238;
    --border: rgba(99,130,230,0.15);
    --border-bright: rgba(99,130,230,0.35);
    --accent: #6382e6;
    --accent-glow: rgba(99,130,230,0.4);
    --accent2: #e05c8a;
    --accent2-glow: rgba(224,92,138,0.4);
    --gold: #f0c040;
    --gold-glow: rgba(240,192,64,0.4);
    --green: #40c97a;
    --red: #e05050;
    --text-primary: #e8eaf6;
    --text-secondary: #8892b0;
    --text-muted: #4a5568;
    --sidebar-w: 220px;
  }

  * { margin:0; padding:0; box-sizing:border-box; }
  
  body {
    font-family: 'Rajdhani', sans-serif;
    background: var(--bg-deepest);
    color: var(--text-primary);
    min-height: 100vh;
    overflow-x: hidden;
  }

  .app-root {
    display: flex;
    min-height: 100vh;
  }

  /* ── Sidebar ── */
  .sidebar {
    width: var(--sidebar-w);
    background: var(--bg-dark);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0; left: 0; bottom: 0;
    z-index: 100;
    overflow: hidden;
  }
  .sidebar-logo {
    padding: 24px 20px 20px;
    border-bottom: 1px solid var(--border);
  }
  .logo-title {
    font-family: 'Cinzel', serif;
    font-size: 15px;
    font-weight: 900;
    letter-spacing: 1px;
    color: var(--accent);
    text-shadow: 0 0 20px var(--accent-glow);
    line-height: 1.2;
  }
  .logo-sub {
    font-size: 10px;
    letter-spacing: 3px;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-top: 4px;
  }
  .sidebar-nav {
    flex: 1;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
    transition: all 0.18s;
    border: 1px solid transparent;
    text-transform: uppercase;
  }
  .nav-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border);
  }
  .nav-item.active {
    background: linear-gradient(135deg, rgba(99,130,230,0.15), rgba(99,130,230,0.05));
    color: var(--accent);
    border-color: var(--border-bright);
    box-shadow: 0 0 12px rgba(99,130,230,0.1);
  }
  .sidebar-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-muted);
    letter-spacing: 1px;
  }

  /* ── Main ── */
  .main-content {
    margin-left: var(--sidebar-w);
    flex: 1;
    padding: 28px 32px;
    min-height: 100vh;
    background: radial-gradient(ellipse at 20% 0%, rgba(99,130,230,0.05) 0%, transparent 60%);
  }
  .page-header {
    margin-bottom: 28px;
  }
  .page-title {
    font-family: 'Cinzel', serif;
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 1px;
  }
  .page-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
    letter-spacing: 0.5px;
  }

  /* ── Cards ── */
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent-glow), transparent);
  }
  .card-title {
    font-family: 'Cinzel', serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 1.5px;
    color: var(--text-secondary);
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  /* ── Stat Cards ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  .stat-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px 20px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .stat-card:hover { border-color: var(--border-bright); }
  .stat-label {
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
    font-weight: 600;
  }
  .stat-value {
    font-family: 'Cinzel', serif;
    font-size: 32px;
    font-weight: 700;
    line-height: 1;
  }
  .stat-change {
    font-size: 11px;
    margin-top: 6px;
    color: var(--text-muted);
  }

  /* ── Tables ── */
  .table-wrap {
    overflow-x: auto;
    border-radius: 10px;
    border: 1px solid var(--border);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  thead tr {
    background: rgba(99,130,230,0.06);
    border-bottom: 1px solid var(--border);
  }
  thead th {
    padding: 11px 16px;
    text-align: left;
    font-family: 'Cinzel', serif;
    font-size: 10px;
    letter-spacing: 1.5px;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
  }
  tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background 0.15s;
  }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: var(--bg-hover); }
  tbody td {
    padding: 12px 16px;
    color: var(--text-primary);
    font-weight: 500;
  }

  /* ── Badges ── */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .badge-dps { background: rgba(224,92,138,0.15); color: var(--accent2); border: 1px solid rgba(224,92,138,0.3); }
  .badge-support { background: rgba(99,130,230,0.15); color: var(--accent); border: 1px solid rgba(99,130,230,0.3); }
  .badge-core { background: rgba(240,192,64,0.15); color: var(--gold); border: 1px solid rgba(240,192,64,0.3); }
  .badge-active { background: rgba(64,201,122,0.15); color: var(--green); border: 1px solid rgba(64,201,122,0.3); }
  .badge-casual { background: rgba(99,130,230,0.12); color: var(--accent); border: 1px solid rgba(99,130,230,0.25); }
  .badge-atrisk { background: rgba(224,80,80,0.15); color: var(--red); border: 1px solid rgba(224,80,80,0.3); }
  .badge-present { background: rgba(64,201,122,0.1); color: var(--green); border: 1px solid rgba(64,201,122,0.25); }
  .badge-absent { background: rgba(224,80,80,0.1); color: var(--red); border: 1px solid rgba(224,80,80,0.25); }
  .badge-gl { background: rgba(240,192,64,0.1); color: var(--gold); border: 1px solid rgba(240,192,64,0.25); }
  .badge-eo { background: rgba(99,130,230,0.1); color: var(--accent); border: 1px solid rgba(99,130,230,0.25); }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    font-family: 'Rajdhani', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    border: none;
    transition: all 0.18s;
    text-transform: uppercase;
  }
  .btn-primary {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 0 16px rgba(99,130,230,0.3);
  }
  .btn-primary:hover { background: #7a9aef; box-shadow: 0 0 24px rgba(99,130,230,0.5); }
  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }
  .btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-bright); }
  .btn-danger {
    background: rgba(224,80,80,0.15);
    color: var(--red);
    border: 1px solid rgba(224,80,80,0.3);
  }
  .btn-danger:hover { background: rgba(224,80,80,0.25); }
  .btn-sm { padding: 5px 10px; font-size: 11px; }
  .btn-icon { padding: 6px; border-radius: 6px; }

  /* ── Form ── */
  .form-grid { display: grid; gap: 16px; }
  .form-grid-2 { grid-template-columns: 1fr 1fr; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-label {
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 700;
  }
  .form-input, .form-select {
    background: var(--bg-deepest);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    color: var(--text-primary);
    font-family: 'Rajdhani', sans-serif;
    font-size: 14px;
    font-weight: 500;
    transition: border-color 0.18s, box-shadow 0.18s;
    outline: none;
    width: 100%;
  }
  .form-input:focus, .form-select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(99,130,230,0.1);
  }
  .form-select option { background: var(--bg-dark); }

  /* ── Search bar ── */
  .search-bar {
    position: relative;
    flex: 1;
    max-width: 320px;
  }
  .search-bar .form-input { padding-left: 38px; }
  .search-icon {
    position: absolute;
    left: 12px; top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(4px);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.15s ease;
  }
  .modal {
    background: var(--bg-card);
    border: 1px solid var(--border-bright);
    border-radius: 16px;
    padding: 28px;
    width: 100%;
    max-width: 520px;
    position: relative;
    animation: slideUp 0.2s ease;
    box-shadow: 0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,130,230,0.1);
  }
  .modal-title {
    font-family: 'Cinzel', serif;
    font-size: 17px;
    font-weight: 700;
    margin-bottom: 20px;
    color: var(--text-primary);
  }
  .modal-close {
    position: absolute;
    top: 16px; right: 16px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: color 0.15s;
  }
  .modal-close:hover { color: var(--text-primary); }
  .modal-footer {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }

  /* ── Rank numbers ── */
  .rank-1 { color: var(--gold); }
  .rank-2 { color: #c0c0c0; }
  .rank-3 { color: #cd7f32; }

  /* ── Mini bar chart ── */
  .mini-bar-wrap { display: flex; gap: 3px; align-items: flex-end; height: 40px; }
  .mini-bar { width: 18px; border-radius: 3px 3px 0 0; transition: height 0.3s ease; }

  /* ── Score bar ── */
  .score-bar-wrap { display: flex; align-items: center; gap: 10px; }
  .score-bar-bg { flex: 1; height: 6px; background: rgba(99,130,230,0.1); border-radius: 3px; overflow: hidden; }
  .score-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }

  /* ── Donut chart ── */
  .donut-wrap { position: relative; }

  /* ── Section header ── */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
    gap: 12px;
    flex-wrap: wrap;
  }

  /* ── Party cards ── */
  .party-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .party-card {
    background: var(--bg-card2);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    position: relative;
    overflow: hidden;
  }
  .party-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
  }
  .party-name {
    font-family: 'Cinzel', serif;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 12px;
    letter-spacing: 0.5px;
  }
  .party-member {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    font-size: 13px;
    font-weight: 500;
  }
  .party-member:last-child { border-bottom: none; }

  /* ── Chart ── */
  .chart-bars {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 120px;
    padding-bottom: 28px;
    position: relative;
  }
  .chart-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .chart-bar { width: 100%; border-radius: 4px 4px 0 0; position: relative; cursor: default; transition: opacity 0.15s; min-height: 2px; }
  .chart-bar:hover { opacity: 0.8; }
  .chart-label { font-size: 10px; color: var(--text-muted); text-align: center; position: absolute; bottom: -22px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* ── Grid layout ── */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

  /* ── Top players ── */
  .top-player {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }
  .top-player:last-child { border-bottom: none; }
  .player-avatar {
    width: 36px; height: 36px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Cinzel', serif;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .player-info { flex: 1; min-width: 0; }
  .player-ign { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .player-class { font-size: 11px; color: var(--text-muted); }
  .player-score { font-family: 'Cinzel', serif; font-size: 16px; font-weight: 700; }

  /* ── Notifications / toasts ── */
  .toast {
    position: fixed;
    bottom: 24px; right: 24px;
    background: var(--bg-card);
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    padding: 14px 18px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    z-index: 300;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideUp 0.2s ease;
    max-width: 320px;
  }
  .toast-success { border-left: 3px solid var(--green); }
  .toast-error { border-left: 3px solid var(--red); }

  /* ── Attendance toggle ── */
  .att-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    letter-spacing: 0.5px;
    transition: all 0.18s;
    text-transform: uppercase;
  }
  .att-toggle.present { background: rgba(64,201,122,0.15); color: var(--green); border: 1px solid rgba(64,201,122,0.3); }
  .att-toggle.absent { background: rgba(224,80,80,0.15); color: var(--red); border: 1px solid rgba(224,80,80,0.3); }
  .att-toggle:hover { filter: brightness(1.2); }

  /* ── Empty state ── */
  .empty-state {
    text-align: center;
    padding: 48px 20px;
    color: var(--text-muted);
  }
  .empty-state-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.4; }
  .empty-state-text { font-size: 14px; }

  /* ── Animations ── */
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(99,130,230,0.2); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(99,130,230,0.4); }

  /* ── Progress ring ── */
  .progress-ring { transform: rotate(-90deg); }

  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .gap-2 { gap: 8px; }
  .gap-3 { gap: 12px; }
  .gap-4 { gap: 16px; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .mb-1 { margin-bottom: 4px; }
  .mb-2 { margin-bottom: 8px; }
  .mb-3 { margin-bottom: 12px; }
  .mb-4 { margin-bottom: 16px; }
  .mt-1 { margin-top: 4px; }
  .mt-2 { margin-top: 8px; }
  .text-muted { color: var(--text-muted); }
  .text-secondary { color: var(--text-secondary); }
  .text-accent { color: var(--accent); }
  .text-gold { color: var(--gold); }
  .text-green { color: var(--green); }
  .text-red { color: var(--red); }
  .font-cinzel { font-family: 'Cinzel', serif; }
  .text-sm { font-size: 12px; }
  .text-xs { font-size: 11px; }
  .w-full { width: 100%; }

  @media (max-width: 900px) {
    :root { --sidebar-w: 0px; }
    .sidebar { display: none; }
    .stats-grid { grid-template-columns: 1fr 1fr; }
    .grid-2 { grid-template-columns: 1fr; }
  }
`;

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`toast toast-${type}`}>
      <span style={{ fontSize: 16 }}>{type === "success" ? "✓" : "✕"}</span>
      {message}
    </div>
  );
}

function Modal({ title, children, onClose, footer }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">{title}</h2>
        <button className="modal-close" onClick={onClose}><Icon name="close" /></button>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ members, events, attendance, performance }) {
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
          <h1 className="page-title">⚔ Dashboard</h1>
        </div>
        <p className="page-subtitle">Guild overview & performance at a glance</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Members</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{members.length}</div>
          <div className="stat-change">Registered guild members</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Members</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>{activeMembers}</div>
          <div className="stat-change">Core + Active classification</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Attendance Rate</div>
          <div className="stat-value" style={{ color: attRate >= 75 ? "var(--green)" : attRate >= 50 ? "var(--gold)" : "var(--red)" }}>{attRate}%</div>
          <div className="stat-change">All events combined</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Events</div>
          <div className="stat-value" style={{ color: "var(--gold)" }}>{events.length}</div>
          <div className="stat-change">{events.filter(e=>e.eventType==="Guild League").length} GL · {events.filter(e=>e.eventType==="Emperium Overrun").length} EO</div>
        </div>
      </div>

      <div className="grid-2 mb-4">
        {/* Top 5 Players */}
        <div className="card">
          <div className="card-title">🏆 Top Players</div>
          {top5.map((p, i) => (
            <div className="top-player" key={p.memberId}>
              <div className="player-avatar" style={{ background: `${avatarColors[i % avatarColors.length]}22`, color: avatarColors[i % avatarColors.length] }}>
                {p.ign[0]}
              </div>
              <div className="player-info">
                <div className="player-ign">
                  {i === 0 && <span className="text-gold">👑 </span>}
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
          <div className="card-title">📊 Score Distribution</div>
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
        {/* Role Distribution */}
        <div className="card">
          <div className="card-title">⚔ Role Distribution</div>
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
        </div>

        {/* Recent Events */}
        <div className="card">
          <div className="card-title">📅 Recent Events</div>
          <div style={{ marginTop: 8 }}>
            {events.slice(-5).reverse().map(ev => {
              const evAtt = attendance.filter(a => a.eventId === ev.eventId);
              const present = evAtt.filter(a => a.status === "present").length;
              const pct = evAtt.length ? Math.round((present / evAtt.length) * 100) : 0;
              return (
                <div key={ev.eventId} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{ev.eventDate}</span>
                    <span className={`badge ${ev.eventType === "Guild League" ? "badge-gl" : "badge-eo"}`} style={{fontSize:10}}>
                      {ev.eventType === "Guild League" ? "GL" : "EO"}
                    </span>
                  </div>
                  <div className="score-bar-wrap">
                    <div className="score-bar-bg">
                      <div className="score-bar-fill" style={{ width: `${pct}%`, background: pct >= 75 ? "var(--green)" : pct >= 50 ? "var(--gold)" : "var(--red)" }}/>
                    </div>
                    <span className="text-xs text-muted">{present}/{evAtt.length} ({pct}%)</span>
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

// ─── MEMBERS ──────────────────────────────────────────────────────────────────
function MembersPage({ members, setMembers, showToast }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [form, setForm] = useState({ memberId: "", ign: "", class: "", role: "DPS" });

  const filtered = members.filter(m =>
    (roleFilter === "All" || m.role === roleFilter) &&
    (m.ign.toLowerCase().includes(search.toLowerCase()) ||
     m.memberId.toLowerCase().includes(search.toLowerCase()) ||
     m.class.toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => {
    const nextNum = (members.length + 1).toString().padStart(3, "0");
    setForm({ memberId: `OBL${nextNum}`, ign: "", class: "", role: "DPS" });
    setEditMember(null);
    setShowModal(true);
  };

  const openEdit = (m) => {
    setForm({ ...m });
    setEditMember(m.memberId);
    setShowModal(true);
  };

  const deleteMember = (id) => {
    setMembers(prev => prev.filter(m => m.memberId !== id));
    showToast("Member removed", "success");
  };

  const saveMember = () => {
    if (!form.ign.trim() || !form.class.trim()) { showToast("Fill all fields", "error"); return; }
    if (editMember) {
      setMembers(prev => prev.map(m => m.memberId === editMember ? { ...form } : m));
      showToast("Member updated", "success");
    } else {
      if (members.find(m => m.memberId === form.memberId)) { showToast("ID already exists", "error"); return; }
      setMembers(prev => [...prev, { ...form }]);
      showToast("Member added", "success");
    }
    setShowModal(false);
  };

  const roleColors = { DPS: "var(--accent2)", "Support": "var(--accent)", "Support/Utility": "var(--accent)" };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">⚔ Members</h1>
        <p className="page-subtitle">Manage all guild members — {members.length} registered</p>
      </div>

      <div className="card">
        <div className="section-header">
          <div className="flex gap-2 items-center">
            <div className="search-bar">
              <span className="search-icon"><Icon name="search" size={14} /></span>
              <input className="form-input" placeholder="Search IGN, ID, class…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{width:"auto"}} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option>All</option><option>DPS</option><option>Support</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={14} /> Add Member</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Member ID</th><th>IGN</th><th>Class</th><th>Role</th><th style={{textAlign:"right"}}>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.memberId}>
                  <td><span className="font-cinzel text-xs text-muted">{m.memberId}</span></td>
                  <td><span style={{fontWeight:700}}>{m.ign}</span></td>
                  <td><span className="text-secondary">{m.class}</span></td>
                  <td>
                    <span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`}>
                      {m.role === "DPS" ? <Icon name="sword" size={10}/> : <Icon name="shield" size={10}/>}
                      {m.role}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2 justify-end">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(m)} title="Edit"><Icon name="edit" size={14}/></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteMember(m.memberId)} title="Delete"><Icon name="trash" size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon">⚔</div><div className="empty-state-text">No members found</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editMember ? "Edit Member" : "Add Member"} onClose={() => setShowModal(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveMember}><Icon name="save" size={14}/> Save</button></>}
        >
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Member ID</label>
              <input className="form-input" value={form.memberId} onChange={e => setForm(f=>({...f,memberId:e.target.value}))} disabled={!!editMember} />
            </div>
            <div className="form-group">
              <label className="form-label">IGN</label>
              <input className="form-input" placeholder="In-game name" value={form.ign} onChange={e => setForm(f=>({...f,ign:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Class</label>
              <input className="form-input" placeholder="e.g. Lord Knight" value={form.class} onChange={e => setForm(f=>({...f,class:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
                <option value="DPS">DPS</option>
                <option value="Support">Support / Utility</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────
function EventsPage({ members, events, setEvents, attendance, setAttendance, performance, setPerformance, absences, showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [form, setForm] = useState({ eventType: "Guild League", eventDate: new Date().toISOString().split("T")[0] });
  const [perfEdits, setPerfEdits] = useState({});

  const createEvent = () => {
    const eventId = `EVT${Date.now()}`;
    const newEvent = { eventId, ...form };
    setEvents(prev => [...prev, newEvent]);

    // auto-load members with absence-aware attendance
    const newAtt = members.map(m => {
      const hasAbsence = absences.find(a => a.memberId === m.memberId && a.eventType === form.eventType && a.eventDate === form.eventDate);
      return { memberId: m.memberId, eventId, status: hasAbsence ? "absent" : "present" };
    });
    setAttendance(prev => [...prev, ...newAtt]);
    showToast("Event created with attendance loaded", "success");
    setShowModal(false);
  };

  const toggleAtt = (memberId, eventId) => {
    setAttendance(prev => prev.map(a =>
      a.memberId === memberId && a.eventId === eventId
        ? { ...a, status: a.status === "present" ? "absent" : "present" }
        : a
    ));
  };

  const savePerformance = (memberId, eventId) => {
    const key = `${memberId}_${eventId}`;
    const edits = perfEdits[key] || {};
    setPerformance(prev => {
      const exists = prev.find(p => p.memberId === memberId && p.eventId === eventId);
      if (exists) return prev.map(p => p.memberId === memberId && p.eventId === eventId ? { ...p, ...edits } : p);
      return [...prev, { memberId, eventId, ctfPoints: 0, performancePoints: 0, ...edits }];
    });
    showToast("Performance saved", "success");
  };

  const evt = selectedEvent;
  const evtAtt = evt ? attendance.filter(a => a.eventId === evt.eventId) : [];
  const evtMembers = evt ? members.map(m => ({
    ...m,
    att: evtAtt.find(a => a.memberId === m.memberId),
    perf: performance.find(p => p.memberId === m.memberId && p.eventId === evt.eventId)
  })) : [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📅 Events</h1>
        <p className="page-subtitle">Track Guild League and Emperium Overrun events</p>
      </div>

      <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
        {/* Event List */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-cinzel text-xs text-muted" style={{ letterSpacing: 2, textTransform: "uppercase" }}>Events ({events.length})</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Icon name="plus" size={12}/> New</button>
          </div>
          <div className="flex flex-col gap-2">
            {events.slice().reverse().map(ev => {
              const evAtt = attendance.filter(a => a.eventId === ev.eventId);
              const present = evAtt.filter(a => a.status === "present").length;
              const isActive = selectedEvent?.eventId === ev.eventId;
              return (
                <div key={ev.eventId} onClick={() => setSelectedEvent(ev)}
                  className="card" style={{ cursor: "pointer", padding: "14px 16px", borderColor: isActive ? "var(--accent)" : "var(--border)", boxShadow: isActive ? "0 0 16px var(--accent-glow)" : "none" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-cinzel" style={{fontSize:12,color:"var(--text-primary)",fontWeight:700}}>{ev.eventDate}</span>
                    <span className={`badge ${ev.eventType === "Guild League" ? "badge-gl" : "badge-eo"}`} style={{fontSize:9}}>
                      {ev.eventType === "Guild League" ? "GL" : "EO"}
                    </span>
                  </div>
                  <div className="text-xs text-muted">{present}/{evAtt.length} present</div>
                </div>
              );
            })}
            {events.length === 0 && <div className="text-muted text-sm" style={{textAlign:"center",padding:"24px 0"}}>No events yet</div>}
          </div>
        </div>

        {/* Event Detail */}
        <div style={{ flex: 1 }}>
          {selectedEvent ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-cinzel" style={{fontSize:16,fontWeight:700}}>{selectedEvent.eventDate}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge ${selectedEvent.eventType === "Guild League" ? "badge-gl" : "badge-eo"}`}>{selectedEvent.eventType}</span>
                    <span className="text-xs text-muted">{evtAtt.filter(a=>a.status==="present").length}/{evtAtt.length} present</span>
                  </div>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Member</th><th>Class</th><th>Attendance</th>
                    {selectedEvent.eventType === "Guild League" && <><th>CTF Pts</th><th>Perf Pts</th><th>Score</th><th></th></>}
                    {selectedEvent.eventType === "Emperium Overrun" && <th>Score</th>}
                  </tr></thead>
                  <tbody>
                    {evtMembers.map(m => {
                      const key = `${m.memberId}_${selectedEvent.eventId}`;
                      const curPerf = perfEdits[key] || {};
                      const ctf = curPerf.ctfPoints !== undefined ? curPerf.ctfPoints : (m.perf?.ctfPoints ?? 0);
                      const pp = curPerf.performancePoints !== undefined ? curPerf.performancePoints : (m.perf?.performancePoints ?? 0);
                      const score = computeScore({ member: m, event: selectedEvent, att: m.att, perf: { ctfPoints: ctf, performancePoints: pp } });
                      return (
                        <tr key={m.memberId}>
                          <td>
                            <div style={{fontWeight:700}}>{m.ign}</div>
                            <div className="text-xs text-muted">{m.memberId}</div>
                          </td>
                          <td className="text-secondary" style={{fontSize:12}}>{m.class}</td>
                          <td>
                            <button className={`att-toggle ${m.att?.status || "absent"}`} onClick={() => toggleAtt(m.memberId, selectedEvent.eventId)}>
                              {m.att?.status === "present" ? <><Icon name="check" size={11}/> Present</> : <><Icon name="x" size={11}/> Absent</>}
                            </button>
                          </td>
                          {selectedEvent.eventType === "Guild League" && (
                            <>
                              <td>
                                <input type="number" className="form-input" style={{width:64,padding:"4px 8px",fontSize:13}} min={0}
                                  value={ctf}
                                  onChange={e => setPerfEdits(prev => ({...prev,[key]:{...prev[key]||{},ctfPoints:+e.target.value}}))}
                                  disabled={m.att?.status !== "present"} />
                              </td>
                              <td>
                                <input type="number" className="form-input" style={{width:64,padding:"4px 8px",fontSize:13}} min={0}
                                  value={pp}
                                  onChange={e => setPerfEdits(prev => ({...prev,[key]:{...prev[key]||{},performancePoints:+e.target.value}}))}
                                  disabled={m.att?.status !== "present"} />
                              </td>
                              <td>
                                <span style={{fontFamily:"Cinzel,serif",fontSize:14,fontWeight:700,color:score<0?"var(--red)":score>20?"var(--gold)":"var(--green)"}}>{score}</span>
                              </td>
                              <td>
                                <button className="btn btn-ghost btn-sm" onClick={() => savePerformance(m.memberId, selectedEvent.eventId)}><Icon name="save" size={12}/></button>
                              </td>
                            </>
                          )}
                          {selectedEvent.eventType === "Emperium Overrun" && (
                            <td><span style={{fontFamily:"Cinzel,serif",fontSize:14,fontWeight:700,color:score>0?"var(--green)":"var(--red)"}}>{score}</span></td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:200}}>
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <div className="empty-state-text">Select an event to view details</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <Modal title="Create New Event" onClose={() => setShowModal(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={createEvent}><Icon name="plus" size={14}/> Create Event</button></>}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Event Type</label>
              <select className="form-select" value={form.eventType} onChange={e => setForm(f=>({...f,eventType:e.target.value}))}>
                <option>Guild League</option>
                <option>Emperium Overrun</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Event Date</label>
              <input type="date" className="form-input" value={form.eventDate} onChange={e => setForm(f=>({...f,eventDate:e.target.value}))} />
            </div>
          </div>
          <div className="text-xs text-muted mt-2" style={{padding:"10px 14px",background:"rgba(99,130,230,0.05)",borderRadius:8,border:"1px solid var(--border)"}}>
            ℹ All {members.length} members will be auto-loaded as Present. Absence records will override to Absent.
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ABSENCES ─────────────────────────────────────────────────────────────────
function AbsencesPage({ members, absences, setAbsences, showToast }) {
  const [form, setForm] = useState({ memberId: members[0]?.memberId || "", eventType: "Guild League", eventDate: new Date().toISOString().split("T")[0], reason: "", onlineStatus: "No" });

  const submitAbsence = () => {
    if (!form.memberId || !form.reason.trim()) { showToast("Fill all fields", "error"); return; }
    const id = `ABS${Date.now()}`;
    setAbsences(prev => [...prev, { ...form, id }]);
    showToast("Absence submitted successfully", "success");
    setForm(f => ({ ...f, reason: "" }));
  };

  const deleteAbsence = (id) => {
    setAbsences(prev => prev.filter(a => a.id !== id));
    showToast("Absence removed", "success");
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">⚠ Absence Submissions</h1>
        <p className="page-subtitle">Submit and manage member absences — auto-synced with attendance</p>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Submit Absence</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Member</label>
              <select className="form-select" value={form.memberId} onChange={e => setForm(f=>({...f,memberId:e.target.value}))}>
                {members.map(m => <option key={m.memberId} value={m.memberId}>{m.ign} ({m.memberId})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Event Type</label>
              <select className="form-select" value={form.eventType} onChange={e => setForm(f=>({...f,eventType:e.target.value}))}>
                <option>Guild League</option><option>Emperium Overrun</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Event Date</label>
              <input type="date" className="form-input" value={form.eventDate} onChange={e => setForm(f=>({...f,eventDate:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Will be online?</label>
              <select className="form-select" value={form.onlineStatus} onChange={e => setForm(f=>({...f,onlineStatus:e.target.value}))}>
                <option value="Yes">Yes</option><option value="No">No</option>
              </select>
            </div>
            <div className="form-group" style={{gridColumn:"1/-1"}}>
              <label className="form-label">Reason</label>
              <input className="form-input" placeholder="Reason for absence…" value={form.reason} onChange={e => setForm(f=>({...f,reason:e.target.value}))} />
            </div>
          </div>
          <div className="flex" style={{justifyContent:"flex-end",marginTop:16}}>
            <button className="btn btn-primary" onClick={submitAbsence}><Icon name="save" size={14}/> Submit Absence</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Recent Absences ({absences.length})</div>
          <div style={{maxHeight:400,overflowY:"auto"}}>
            {absences.slice().reverse().map((a, i) => {
              const member = members.find(m => m.memberId === a.memberId);
              return (
                <div key={a.id || i} style={{padding:"12px 0",borderBottom:"1px solid var(--border)"}}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span style={{fontWeight:700,fontSize:14}}>{member?.ign || a.memberId}</span>
                      <span className="text-muted text-xs" style={{marginLeft:8}}>{a.memberId}</span>
                    </div>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteAbsence(a.id || i)}><Icon name="trash" size={12}/></button>
                  </div>
                  <div className="flex gap-2" style={{flexWrap:"wrap"}}>
                    <span className={`badge ${a.eventType==="Guild League"?"badge-gl":"badge-eo"}`} style={{fontSize:9}}>{a.eventType==="Guild League"?"GL":"EO"}</span>
                    <span className="text-xs text-muted">{a.eventDate}</span>
                    <span className="text-xs" style={{color:a.onlineStatus==="Yes"?"var(--green)":"var(--text-muted)"}}>Online: {a.onlineStatus}</span>
                  </div>
                  <div className="text-xs text-secondary mt-1" style={{fontStyle:"italic"}}>"{a.reason}"</div>
                </div>
              );
            })}
            {absences.length === 0 && <div className="empty-state"><div className="empty-state-icon">✅</div><div className="empty-state-text">No absences on record</div></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
function LeaderboardPage({ members, events, attendance, performance }) {
  const [filter, setFilter] = useState("All");
  const lb = useMemo(() => computeLeaderboard(members, events, attendance, performance), [members, events, attendance, performance]);
  const filtered = filter === "All" ? lb : lb.filter(m => m.classification === filter);
  const maxScore = Math.max(...lb.map(m => m.totalScore), 1);

  const rankColors = ["var(--gold)", "#c0c0c0", "#cd7f32"];
  const classColors = { Core: "badge-core", Active: "badge-active", Casual: "badge-casual", "At Risk": "badge-atrisk" };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🏆 Leaderboard</h1>
        <p className="page-subtitle">Rankings based on scoring formula — auto-computed</p>
      </div>

      {/* Top 3 podium */}
      <div className="flex gap-3 mb-4 items-end" style={{maxWidth:600}}>
        {[lb[1], lb[0], lb[2]].map((m, i) => {
          if (!m) return <div key={i} style={{flex:1}}/>;
          const podiumH = [100, 130, 85];
          const idxInRank = m.rank - 1;
          return (
            <div key={m.memberId} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"var(--text-muted)"}}>{m.rank === 1 ? "👑" : m.rank === 2 ? "🥈" : "🥉"}</div>
              <div style={{fontWeight:700,fontSize:13,textAlign:"center"}}>{m.ign}</div>
              <div className="text-xs text-muted">{m.class}</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:18,fontWeight:700,color:rankColors[m.rank-1]}}>{m.totalScore}</div>
              <div style={{width:"100%",height:podiumH[i],background:`linear-gradient(to top, ${rankColors[m.rank-1]}33, ${rankColors[m.rank-1]}11)`,borderRadius:"8px 8px 0 0",border:`1px solid ${rankColors[m.rank-1]}44`,borderBottom:"none",display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:8}}>
                <span style={{fontFamily:"Cinzel,serif",fontSize:22,color:rankColors[m.rank-1],opacity:0.4}}>#{m.rank}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="section-header">
          <div className="font-cinzel text-xs text-muted" style={{letterSpacing:2,textTransform:"uppercase"}}>Full Rankings</div>
          <div className="flex gap-2">
            {["All","Core","Active","Casual","At Risk"].map(f => (
              <button key={f} className={`btn btn-sm ${filter===f?"btn-primary":"btn-ghost"}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>#</th><th>Player</th><th>Role</th><th>Total Score</th><th>Score Bar</th><th>Attendance</th><th>Avg/Event</th><th>Status</th>
            </tr></thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.memberId}>
                  <td>
                    <span className={`font-cinzel`} style={{fontSize:14,fontWeight:700,color:rankColors[m.rank-1]||"var(--text-muted)"}}>
                      {m.rank <= 3 ? ["🥇","🥈","🥉"][m.rank-1] : `#${m.rank}`}
                    </span>
                  </td>
                  <td>
                    <div style={{fontWeight:700}}>{m.ign}</div>
                    <div className="text-xs text-muted">{m.class}</div>
                  </td>
                  <td><span className={`badge ${m.role==="DPS"?"badge-dps":"badge-support"}`} style={{fontSize:10}}>{m.role}</span></td>
                  <td><span className="font-cinzel" style={{fontSize:15,fontWeight:700,color:m.totalScore>80?"var(--gold)":m.totalScore>60?"var(--green)":"var(--text-primary)"}}>{m.totalScore}</span></td>
                  <td style={{minWidth:140}}>
                    <div className="score-bar-wrap">
                      <div className="score-bar-bg">
                        <div className="score-bar-fill" style={{width:`${Math.max(2,(m.totalScore/maxScore)*100)}%`, background:m.totalScore>80?"var(--gold)":m.totalScore>60?"var(--green)":"var(--accent)"}}/>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{color:m.attendancePct>=75?"var(--green)":m.attendancePct>=50?"var(--gold)":"var(--red)",fontWeight:700}}>{m.attendancePct}%</span>
                  </td>
                  <td className="text-secondary">{m.avgScore}</td>
                  <td><span className={`badge ${classColors[m.classification]}`}>{m.classification}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-2" style={{marginTop:16}}>
        <div className="card-title">Classification Legend</div>
        <div className="flex gap-4" style={{flexWrap:"wrap"}}>
          {[["Core","badge-core","Score > 80"],["Active","badge-active","Score 60–80"],["Casual","badge-casual","Score 40–60"],["At Risk","badge-atrisk","Score < 40"]].map(([k,c,d])=>(
            <div key={k} className="flex items-center gap-2">
              <span className={`badge ${c}`}>{k}</span>
              <span className="text-xs text-muted">{d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PARTY BUILDER ────────────────────────────────────────────────────────────
const PARTY_NAMES = ["Alpha Squad", "Bravo Force", "Charlie Wing", "Delta Strike", "Echo Vanguard", "Foxtrot Blade"];

function PartyBuilder({ members, events, attendance, parties, setParties }) {
  // source mode: "all" | "event:<eventId>"
  const [sourceMode, setSourceMode] = useState("all");
  // edit mode: dragging memberId and from-party index
  const [dragging, setDragging] = useState(null); // { memberId, fromParty: idx | "bench" }
  const [dragOver, setDragOver] = useState(null);  // idx | "bench"
  const [editingName, setEditingName] = useState(null); // party index
  const [nameInput, setNameInput] = useState("");
  const [partyNames, setPartyNames] = useState(PARTY_NAMES.slice());
  const [mode, setMode] = useState("auto"); // "auto" | "manual"

  // derive pool of members for current source
  const poolMembers = useMemo(() => {
    if (sourceMode === "all") return members;
    const eventId = sourceMode.replace("event:", "");
    const presentIds = new Set(
      attendance.filter(a => a.eventId === eventId && a.status === "present").map(a => a.memberId)
    );
    return members.filter(m => presentIds.has(m.memberId));
  }, [sourceMode, members, attendance]);

  // bench = pool members not assigned to any party
  const assignedIds = useMemo(() => new Set(parties.flatMap(p => p.map(m => m.memberId))), [parties]);
  const bench = useMemo(() => poolMembers.filter(m => !assignedIds.has(m.memberId)), [poolMembers, assignedIds]);

  const autoGenerate = () => {
    const dps = [...poolMembers.filter(m => m.role === "DPS")].sort(() => Math.random() - 0.5);
    const sup = [...poolMembers.filter(m => m.role !== "DPS")].sort(() => Math.random() - 0.5);
    const partyCount = Math.max(1, Math.ceil(poolMembers.length / 5));
    const result = Array.from({ length: partyCount }, () => []);
    sup.forEach((s, i) => result[i % partyCount].push(s));
    let di = 0;
    result.forEach(p => { while (p.length < 5 && di < dps.length) p.push(dps[di++]); });
    setParties(result.filter(p => p.length > 0));
  };

  const addParty = () => setParties(prev => [...prev, []]);

  const removeParty = (idx) => {
    setParties(prev => prev.filter((_, i) => i !== idx));
  };

  const removeMemberFromParty = (memberId, partyIdx) => {
    setParties(prev => prev.map((p, i) => i === partyIdx ? p.filter(m => m.memberId !== memberId) : p));
  };

  const addMemberToParty = (member, partyIdx) => {
    // remove from any existing party first
    setParties(prev => {
      const cleaned = prev.map(p => p.filter(m => m.memberId !== member.memberId));
      return cleaned.map((p, i) => i === partyIdx ? [...p, member] : p);
    });
  };

  const resetAll = () => { setParties([]); };

  // drag handlers
  const onDragStart = (memberId, fromParty) => setDragging({ memberId, fromParty });
  const onDragEnd = () => { setDragging(null); setDragOver(null); };

  const onDrop = (toTarget) => { // toTarget: partyIdx number | "bench"
    if (!dragging) return;
    const { memberId, fromParty } = dragging;
    const member = members.find(m => m.memberId === memberId);
    if (!member) return;

    if (toTarget === "bench") {
      // remove from party, back to bench
      if (fromParty !== "bench") removeMemberFromParty(memberId, fromParty);
    } else {
      // move to party
      addMemberToParty(member, toTarget);
    }
    setDragging(null);
    setDragOver(null);
  };

  const startRename = (i) => { setEditingName(i); setNameInput(partyNames[i] || PARTY_NAMES[i] || `Party ${i+1}`); };
  const commitRename = () => {
    if (editingName === null) return;
    setPartyNames(prev => { const n = [...prev]; n[editingName] = nameInput || `Party ${editingName+1}`; return n; });
    setEditingName(null);
  };

  const hasParties = parties.length > 0;

  // styles for drag targets
  const dropTargetStyle = (idx) => ({
    outline: dragOver === idx ? "2px dashed var(--accent)" : "none",
    background: dragOver === idx ? "rgba(99,130,230,0.08)" : undefined,
    transition: "background 0.15s",
    minHeight: 48,
    borderRadius: 8,
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">⭐ Party Builder</h1>
        <p className="page-subtitle">Auto-balance or manually arrange teams — state persists across tabs</p>
      </div>

      {/* Controls card */}
      <div className="card" style={{marginBottom:20}}>
        <div className="flex items-center justify-between" style={{flexWrap:"wrap",gap:12}}>
          <div className="flex gap-3 items-center" style={{flexWrap:"wrap"}}>
            {/* Source selector */}
            <div className="form-group" style={{gap:4,marginBottom:0}}>
              <label className="form-label">Member Pool</label>
              <select className="form-select" style={{width:"auto",fontSize:13,padding:"6px 12px"}}
                value={sourceMode} onChange={e => { setSourceMode(e.target.value); setParties([]); }}>
                <option value="all">All Members ({members.length})</option>
                {events.map(ev => {
                  const count = attendance.filter(a => a.eventId === ev.eventId && a.status === "present").length;
                  return (
                    <option key={ev.eventId} value={`event:${ev.eventId}`}>
                      {ev.eventDate} — {ev.eventType === "Guild League" ? "GL" : "EO"} ({count} present)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Mode toggle */}
            <div className="form-group" style={{gap:4,marginBottom:0}}>
              <label className="form-label">Mode</label>
              <div className="flex gap-1">
                <button className={`btn btn-sm ${mode==="auto"?"btn-primary":"btn-ghost"}`} onClick={() => setMode("auto")}>Auto</button>
                <button className={`btn btn-sm ${mode==="manual"?"btn-primary":"btn-ghost"}`} onClick={() => setMode("manual")}>Manual</button>
              </div>
            </div>

            <div className="text-xs text-muted" style={{paddingTop:18}}>
              {poolMembers.length} members · {poolMembers.filter(m=>m.role==="DPS").length} DPS · {poolMembers.filter(m=>m.role!=="DPS").length} Support
            </div>
          </div>

          <div className="flex gap-2" style={{paddingTop:18,flexWrap:"wrap"}}>
            {hasParties && <button className="btn btn-ghost" onClick={resetAll}><Icon name="trash" size={14}/> Reset</button>}
            {mode === "manual" && <button className="btn btn-ghost" onClick={addParty}><Icon name="plus" size={14}/> Add Party</button>}
            <button className="btn btn-primary" onClick={autoGenerate}><Icon name="refresh" size={14}/> {hasParties ? "Rebalance" : "Generate"}</button>
          </div>
        </div>
      </div>

      {/* Manual mode bench */}
      {mode === "manual" && hasParties && (
        <div className="card" style={{marginBottom:16}}>
          <div className="flex items-center justify-between mb-2">
            <div className="card-title" style={{marginBottom:0}}>🪑 Bench ({bench.length} unassigned)</div>
            <span className="text-xs text-muted">Drag members between parties or back here</span>
          </div>
          <div
            style={{...dropTargetStyle("bench"), display:"flex", flexWrap:"wrap", gap:8, padding:bench.length===0?"12px 0":4}}
            onDragOver={e => { e.preventDefault(); setDragOver("bench"); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => onDrop("bench")}
          >
            {bench.length === 0 && <span className="text-xs text-muted" style={{padding:"8px 12px"}}>All members are assigned to a party</span>}
            {bench.map(m => (
              <div key={m.memberId}
                draggable
                onDragStart={() => onDragStart(m.memberId, "bench")}
                onDragEnd={onDragEnd}
                style={{
                  display:"flex",alignItems:"center",gap:8,padding:"6px 12px",
                  background:"var(--bg-card2)",border:"1px solid var(--border)",borderRadius:8,
                  cursor:"grab",userSelect:"none",fontSize:13,fontWeight:600,
                  opacity: dragging?.memberId === m.memberId ? 0.4 : 1,
                }}>
                <span className={`badge ${m.role==="DPS"?"badge-dps":"badge-support"}`} style={{fontSize:9}}>{m.role==="DPS"?"DPS":"SUP"}</span>
                {m.ign}
                <span className="text-xs text-muted">{m.class}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Party cards */}
      {hasParties && (
        <div className="party-grid">
          {parties.map((party, i) => {
            const dpsC = party.filter(m => m.role === "DPS").length;
            const supC = party.filter(m => m.role !== "DPS").length;
            const name = partyNames[i] || `Party ${i+1}`;
            return (
              <div className="party-card" key={i}
                style={mode==="manual" ? dropTargetStyle(i) : {}}
                onDragOver={mode==="manual" ? (e => { e.preventDefault(); setDragOver(i); }) : undefined}
                onDragLeave={mode==="manual" ? (() => setDragOver(null)) : undefined}
                onDrop={mode==="manual" ? (() => onDrop(i)) : undefined}
              >
                {/* Party name */}
                <div className="flex items-center justify-between mb-1" style={{gap:6}}>
                  {editingName === i ? (
                    <input className="form-input" style={{fontSize:13,padding:"3px 8px",flex:1}}
                      value={nameInput} autoFocus
                      onChange={e => setNameInput(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => e.key==="Enter" && commitRename()} />
                  ) : (
                    <div className="party-name" style={{marginBottom:0,flex:1,cursor:mode==="manual"?"pointer":"default"}}
                      onClick={() => mode==="manual" && startRename(i)}>
                      {name}
                      {mode==="manual" && <span className="text-xs text-muted" style={{marginLeft:6,fontFamily:"Rajdhani,sans-serif",fontWeight:400}}>✎</span>}
                    </div>
                  )}
                  {mode==="manual" && parties.length > 1 && (
                    <button className="btn btn-danger btn-sm btn-icon" style={{padding:"3px 6px"}} onClick={() => removeParty(i)}><Icon name="x" size={11}/></button>
                  )}
                </div>

                <div className="flex gap-2 mb-3">
                  <span className="text-xs" style={{color:"var(--accent2)"}}>{dpsC} DPS</span>
                  <span className="text-xs text-muted">·</span>
                  <span className="text-xs" style={{color:"var(--accent)"}}>{supC} Support</span>
                  <span className="text-xs text-muted">· {party.length}/5</span>
                </div>

                {party.map((m) => (
                  <div className="party-member" key={m.memberId}
                    draggable={mode==="manual"}
                    onDragStart={mode==="manual" ? () => onDragStart(m.memberId, i) : undefined}
                    onDragEnd={mode==="manual" ? onDragEnd : undefined}
                    style={{cursor:mode==="manual"?"grab":"default", opacity: dragging?.memberId===m.memberId ? 0.35 : 1}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13}}>{m.ign}</div>
                      <div style={{fontSize:11,color:"var(--text-muted)"}}>{m.class}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`badge ${m.role==="DPS"?"badge-dps":"badge-support"}`} style={{fontSize:9}}>
                        {m.role === "DPS" ? "DPS" : "SUP"}
                      </span>
                      {mode==="manual" && (
                        <button style={{background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer",padding:"2px",lineHeight:1,marginLeft:2}}
                          onClick={() => removeMemberFromParty(m.memberId, i)} title="Remove">
                          <Icon name="x" size={12}/>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Drop hint when empty in manual mode */}
                {mode==="manual" && party.length === 0 && (
                  <div className="text-xs text-muted" style={{textAlign:"center",padding:"12px 0",opacity:0.5}}>
                    Drop members here
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!hasParties && (
        <div className="card" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:200}}>
          <div className="empty-state">
            <div className="empty-state-icon">⭐</div>
            <div className="empty-state-text">
              {mode === "auto"
                ? 'Click "Generate" to auto-build balanced teams'
                : 'Click "Generate" to start, then drag to rearrange'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "members", label: "Members", icon: "members" },
  { id: "events", label: "Events", icon: "events" },
  { id: "absences", label: "Absences", icon: "absence" },
  { id: "leaderboard", label: "Leaderboard", icon: "leaderboard" },
  { id: "party", label: "Party Builder", icon: "party" },
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [toast, setToast] = useState(null);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Load data from Firebase on startup
  useEffect(() => {
    const loadData = async () => {
      try {
        const snap = await getDoc(doc(db, "guilddata", "main"));
        if (snap.exists()) {
          const data = snap.data();
          setMembers(data.members || INITIAL_MEMBERS);
          setEvents(data.events || INITIAL_EVENTS);
          setAttendance(data.attendance || INITIAL_ATTENDANCE);
          setPerformance(data.performance || INITIAL_PERFORMANCE);
          setAbsences(data.absences || []);
          setParties(data.parties || []);
        } else {
          // First time — save initial data to Firebase
          await setDoc(doc(db, "guilddata", "main"), {
            members: INITIAL_MEMBERS,
            events: INITIAL_EVENTS,
            attendance: INITIAL_ATTENDANCE,
            performance: INITIAL_PERFORMANCE,
            absences: [],
            parties: [],
          });
          setMembers(INITIAL_MEMBERS);
          setEvents(INITIAL_EVENTS);
          setAttendance(INITIAL_ATTENDANCE);
          setPerformance(INITIAL_PERFORMANCE);
        }
      } catch (err) {
        console.error("Firebase load error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ── Auto-save to Firebase whenever data changes
  useEffect(() => {
    if (loading) return;
    const saveData = async () => {
      try {
        await setDoc(doc(db, "guilddata", "main"), {
          members, events, attendance, performance, absences, parties
        });
      } catch (err) {
        console.error("Firebase save error:", err);
      }
    };
    const timeout = setTimeout(saveData, 1000);
    return () => clearTimeout(timeout);
  }, [members, events, attendance, performance, absences, parties, loading]);

  const showToast = (message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  };

  if (loading) return (
    <>
      <style>{styles}</style>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg-deepest)",flexDirection:"column",gap:16}}>
        <div style={{fontFamily:"Cinzel,serif",fontSize:24,color:"var(--accent)"}}>OBLIVION</div>
        <div style={{color:"var(--text-muted)",fontSize:13,letterSpacing:2}}>LOADING GUILD DATA...</div>
      </div>
    </>
  );

  return (
    <>
      <style>{styles}</style>
      <div className="app-root">
        {/* Sidebar */}
        <nav className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-title">OBLIVION</div>
            <div className="logo-sub">Guild Manager</div>
          </div>
          <div className="sidebar-nav">
            {NAV_ITEMS.map(item => (
              <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
                <Icon name={item.icon} size={16} />
                {item.label}
              </div>
            ))}
          </div>
          <div className="sidebar-footer">
            <div>⚔ Ragnarok Online</div>
            <div style={{marginTop:2}}>v1.0 · Guild System</div>
          </div>
        </nav>

        {/* Main */}
        <main className="main-content">
          {page === "dashboard" && <Dashboard members={members} events={events} attendance={attendance} performance={performance} />}
          {page === "members" && <MembersPage members={members} setMembers={setMembers} showToast={showToast} />}
          {page === "events" && <EventsPage members={members} events={events} setEvents={setEvents} attendance={attendance} setAttendance={setAttendance} performance={performance} setPerformance={setPerformance} absences={absences} showToast={showToast} />}
          {page === "absences" && <AbsencesPage members={members} absences={absences} setAbsences={setAbsences} showToast={showToast} />}
          {page === "leaderboard" && <LeaderboardPage members={members} events={events} attendance={attendance} performance={performance} />}
          {page === "party" && <PartyBuilder members={members} events={events} attendance={attendance} parties={parties} setParties={setParties} />}
        </main>

        {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
      </div>
    </>
  );
}