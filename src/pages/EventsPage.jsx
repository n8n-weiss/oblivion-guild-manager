import React, { useState } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import Modal from '../components/ui/Modal';
import { computeScore } from '../utils/scoring';
import { computeLeaderboard } from '../utils/scoring';
import { writeAuditLog } from "../utils/audit";

function EventsPage() {
  const {
    members, events, setEvents, attendance, setAttendance,
    performance, setPerformance, absences, eoRatings, setEoRatings,
    showToast, isAdmin, currentUser, sendDiscordEmbed, discordConfig
  } = useGuild();
  const activeMembers = React.useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);
  const officerPool = React.useMemo(() => {
    const officerRanks = new Set([
      "officer",
      "charisma baby",
      "baby charisma",
      "guild master",
      "vice guild master",
      "commander",
      "system architect",
      "system architect (creator)",
      "creator"
    ]);
    return members
      .filter(m => (m.status || "active") === "active")
      .filter(m => officerRanks.has(String(m.guildRank || "").toLowerCase()))
  }, [members]);

  // Special rotation for specific officers
  const rotationKey = "battlelog_audit_rotation";
  const fixedDuoOfficerPool = officerPool.filter(o => ["gildartsss", "cobzydr"].includes((o.ign || "").trim().toLowerCase()));

  const duoOfficerPool = React.useMemo(() => {
    const basePool = fixedDuoOfficerPool.length ? fixedDuoOfficerPool : officerPool;
    const pool = basePool.slice(0, 2);
    // Hardcode Discord IDs for rotational pings
    return pool.map(o => {
      const ign = (o.ign || "").trim().toLowerCase();
      if (ign === "gildartsss") return { ...o, discordId: "630443485891395606" };
      if (ign === "cobzydr") return { ...o, discordId: "1390527637016809573" };
      return o;
    });
  }, [fixedDuoOfficerPool, officerPool]);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    eventType: "Guild League",
    eventDate: new Date().toLocaleDateString('en-CA'),
    eventTime: "20:55",
    auditDueOffsetHours: 12
  });
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [postingDigest, setPostingDigest] = useState(false);
  const [finalizingDigest, setFinalizingDigest] = useState(false);
  const [escalationHours] = useState(12); // after dueAt
  const reminderInFlight = React.useRef(new Set());

  // Group events by Month and Week
  const groupedEvents = React.useMemo(() => {
    const groups = {};
    events.forEach(ev => {
      const d = new Date(ev.eventDate);
      const monthKey = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthKey]) groups[monthKey] = {};
      
      // Calculate week of month
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
      const weekNo = Math.ceil((d.getDate() + firstDay.getDay()) / 7);
      const weekKey = `Week ${weekNo}`;
      
      if (!groups[monthKey][weekKey]) groups[monthKey][weekKey] = [];
      groups[monthKey][weekKey].push(ev);
    });
    return groups;
  }, [events]);

  const monthKeys = Object.keys(groupedEvents).sort((a, b) => new Date(b) - new Date(a));

  const toggleMonth = (m) => setExpandedMonths(prev => ({ ...prev, [m]: !prev[m] }));
  const toggleWeek = (w) => setExpandedWeeks(prev => ({ ...prev, [w]: !prev[w] }));

  const deleteEvent = (id) => {
    setEvents(prev => prev.filter(ev => ev.eventId !== id));
    setAttendance(prev => prev.filter(a => a.eventId !== id));
    setPerformance(prev => prev.filter(p => p.eventId !== id));
    setEoRatings(prev => prev.filter(r => r.eventId !== id));
    if (selectedEvent?.eventId === id) setSelectedEvent(null);
    showToast("Event deleted", "success");
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "event_delete", `Deleted event ${id}`);
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editEventId, setEditEventId] = useState(null);
  const [perfEdits, setPerfEdits] = useState({});
  const getNextAuditor = React.useCallback(() => {
    if (!duoOfficerPool.length) return null;
    let idx = 0;
    try {
      idx = Number(localStorage.getItem(rotationKey) || "0");
    } catch {
      idx = 0;
    }
    const auditor = duoOfficerPool[Math.abs(idx) % duoOfficerPool.length];
    try {
      localStorage.setItem(rotationKey, String((Math.abs(idx) + 1) % duoOfficerPool.length));
    } catch (err) {
      console.warn("Failed to persist battlelog rotation pointer", err);
    }
    return auditor;
  }, [duoOfficerPool]);

  const handleSaveEvent = async () => {
    if (isEditing) {
      const updatedEvents = events.map(ev => {
        if (ev.eventId === editEventId) {
          const eventStart = new Date(`${form.eventDate}T${form.eventTime}:00`);
          const dueAt = new Date(eventStart.getTime() + Number(form.auditDueOffsetHours || 12) * 60 * 60 * 1000);
          return {
            ...ev,
            ...form,
            battlelogAudit: {
              ...(ev.battlelogAudit || {}),
              dueAt: dueAt.toISOString()
            }
          };
        }
        return ev;
      });
      setEvents(updatedEvents);
      showToast("Event updated", "success");
      writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "event_update", `Updated ${form.eventType} event — ${form.eventDate}`);
      
      if (selectedEvent?.eventId === editEventId) {
        setSelectedEvent(prev => ({
          ...prev,
          ...form,
          battlelogAudit: {
            ...(prev.battlelogAudit || {}),
            dueAt: new Date(new Date(`${form.eventDate}T${form.eventTime}:00`).getTime() + Number(form.auditDueOffsetHours || 12) * 60 * 60 * 1000).toISOString()
          }
        }));
      }
    } else {
      const eventId = `EVT${Date.now()}`;
      const assignedAuditor = getNextAuditor();
      const assignmentSource = "auto_duo";
      const eventStart = new Date(`${form.eventDate}T${form.eventTime}:00`);
      const dueAt = new Date(eventStart.getTime() + Number(form.auditDueOffsetHours || 12) * 60 * 60 * 1000);
      const newEvent = {
        eventId,
        ...form,
        battlelogAudit: {
          assignedMemberId: assignedAuditor?.memberId || null,
          assignedIgn: assignedAuditor?.ign || "Unassigned",
          assignedDiscordId: assignedAuditor?.discordId || null,
          status: "pending",
          dueAt: dueAt.toISOString(),
          reminderSentAt: null,
          postEventReminderSentAt: null,
          submittedAt: null,
          submittedBy: null,
          assignmentSource
        }
      };
      setEvents(prev => [...prev, newEvent]);

      const newAtt = members
        .filter(m => (m.status || "active") !== "left")
        .map(m => {
        const mId = (m.memberId || "").trim();
        const hasAbsence = absences.find(a => (a.memberId || "").trim().toLowerCase() === mId.toLowerCase() && (!a.eventType || a.eventType === form.eventType) && a.eventDate === form.eventDate);
        return { memberId: mId, eventId, status: hasAbsence ? "absent" : "present" };
      });

      setAttendance(prev => {
        const existingIds = new Set(prev.filter(a => a.eventId === eventId).map(a => (a.memberId || "").trim().toLowerCase()));
        const dedupedNew = newAtt.filter(a => !existingIds.has((a.memberId || "").trim().toLowerCase()));
        return [...prev, ...dedupedNew];
      });
      showToast("Event created with attendance loaded", "success");
      writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "event_create", `Created ${form.eventType} event — ${form.eventDate}`);
      
      await sendDiscordEmbed(
        "📅 New Event Scheduled",
        `A new guild event has been scheduled! Please check your attendance.`,
        0x6382E6,
        [
          { name: "Event Type", value: form.eventType, inline: true },
          { name: "Date", value: form.eventDate, inline: true },
          { name: "Event Time", value: discordConfig?.eventTimeText || "7:55 PM – 8:20 PM (GMT+7) Server Time\n8:55 PM – 9:20 PM (GMT+8) Manila Time", inline: false },
          { name: "Battlelog Auditor", value: assignedAuditor?.ign || "Not assigned", inline: true },
          { name: "Assignment", value: assignmentSource, inline: true },
          { name: "Note", value: "Attendance auto-loaded based on your LOA filings." }
        ],
        "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png",
        "events",
        "event_created",
        { type: form.eventType, date: form.eventDate }
      );
    }
    setShowModal(false);
    setIsEditing(false);
    setEditEventId(null);
  };

  const handleEditClick = (ev) => {
    setForm({
      eventType: ev.eventType,
      eventDate: ev.eventDate,
      eventTime: ev.eventTime || "20:55",
      auditDueOffsetHours: ev.auditDueOffsetHours || 12
    });
    setIsEditing(true);
    setEditEventId(ev.eventId);
    setShowModal(true);
  };

  const handleNewClick = () => {
    setForm({
      eventType: "Guild League",
      eventDate: new Date().toLocaleDateString('en-CA'),
      eventTime: "20:55",
      auditDueOffsetHours: 12
    });
    setIsEditing(false);
    setEditEventId(null);
    setShowModal(true);
  };

  React.useEffect(() => {
    if (!currentUser) return;
    const now = Date.now();

    const postEventReminders = events.filter(ev => {
      const audit = ev.battlelogAudit;
      if (!audit || audit.status === "submitted" || audit.postEventReminderSentAt) return false;
      const eventStart = new Date(`${ev.eventDate}T${ev.eventTime || "20:55"}:00`).getTime();
      const triggerTime = eventStart + (55 * 60 * 1000);
      return Number.isFinite(triggerTime) && now >= triggerTime;
    }).slice(0, 3);

    const overduePending = events.filter(ev => {
      const audit = ev.battlelogAudit;
      if (!audit || audit.status === "submitted" || audit.reminderSentAt) return false;
      let dueTime = audit.dueAt ? new Date(audit.dueAt).getTime() : new Date(`${ev.eventDate}T23:00:00`).getTime();
      const evStart = new Date(`${ev.eventDate}T00:00:00`).getTime();
      if (dueTime <= evStart + 23 * 60 * 60 * 1000 && !ev.eventTime) dueTime += 24 * 60 * 60 * 1000;
      return Number.isFinite(dueTime) && dueTime <= now;
    }).slice(0, 3);

    const escalationCandidates = events.filter(ev => {
      const audit = ev.battlelogAudit;
      if (!audit || audit.status === "submitted" || !audit.reminderSentAt || audit.escalatedAt) return false;
      let dueTime = audit.dueAt ? new Date(audit.dueAt).getTime() : new Date(`${ev.eventDate}T23:00:00`).getTime();
      const evStart = new Date(`${ev.eventDate}T00:00:00`).getTime();
      if (dueTime <= evStart + 23 * 60 * 60 * 1000 && !ev.eventTime) dueTime += 24 * 60 * 60 * 1000;
      return Number.isFinite(dueTime) && (now - dueTime) >= escalationHours * 60 * 60 * 1000;
    }).slice(0, 3);

    const runReminders = async () => {
      for (const ev of postEventReminders) {
        if (reminderInFlight.current.has(ev.eventId + "_soft")) continue;
        reminderInFlight.current.add(ev.eventId + "_soft");
        try {
          await sendDiscordEmbed(
            "🔔 Battlelog Soft Reminder",
            "The event has ended. Please remember to audit the battlelogs when you have the chance.",
            0x6382E6,
            [
              { name: "Event", value: `${ev.eventType} • ${ev.eventDate}`, inline: false },
              { name: "Assigned Auditor", value: ev.battlelogAudit?.assignedIgn || "Unassigned", inline: true }
            ],
            null,
            "battlelog_reminder",
            "battlelog_reminder",
            { type: ev.eventType, date: ev.eventDate, auditor: ev.battlelogAudit?.assignedIgn || "Unassigned" },
            ev.battlelogAudit?.assignedDiscordId
          );
          setEvents(prev => prev.map(x => x.eventId === ev.eventId ? {
            ...x,
            battlelogAudit: { ...(x.battlelogAudit || {}), postEventReminderSentAt: new Date().toISOString() }
          } : x));
        } catch (err) { console.error("Soft reminder failed:", err); }
        finally { reminderInFlight.current.delete(ev.eventId + "_soft"); }
      }

      for (const ev of overduePending) {
        if (reminderInFlight.current.has(ev.eventId + "_hard")) continue;
        reminderInFlight.current.add(ev.eventId + "_hard");
        try {
          await sendDiscordEmbed(
            "📘 Battlelog Overdue Alert",
            "Battlelog audit is now overdue. Please submit as soon as possible.",
            0xF0C040,
            [
              { name: "Event", value: `${ev.eventType} • ${ev.eventDate}`, inline: false },
              { name: "Assigned Auditor", value: ev.battlelogAudit?.assignedIgn || "Unassigned", inline: true }
            ],
            null,
            "battlelog_reminder",
            "battlelog_reminder",
            { type: ev.eventType, date: ev.eventDate, auditor: ev.battlelogAudit?.assignedIgn || "Unassigned" },
            ev.battlelogAudit?.assignedDiscordId
          );
          setEvents(prev => prev.map(x => x.eventId === ev.eventId ? {
            ...x,
            battlelogAudit: { ...(x.battlelogAudit || {}), reminderSentAt: new Date().toISOString(), status: "overdue" }
          } : x));
        } catch (err) { console.error("Hard reminder failed:", err); }
        finally { reminderInFlight.current.delete(ev.eventId + "_hard"); }
      }

      for (const ev of escalationCandidates) {
        if (reminderInFlight.current.has(ev.eventId + "_esc")) continue;
        reminderInFlight.current.add(ev.eventId + "_esc");
        try {
          await sendDiscordEmbed(
            "⏰ Battlelog Escalation",
            `Battlelog is still pending ${escalationHours}+ hours after due time.`,
            0xE05050,
            [
              { name: "Event", value: `${ev.eventType} • ${ev.eventDate}`, inline: false }
            ],
            null,
            "battlelog_reminder",
            "battlelog_reminder",
            { type: ev.eventType, date: ev.eventDate, auditor: ev.battlelogAudit?.assignedIgn || "Unassigned" },
            ev.battlelogAudit?.assignedDiscordId
          );
          setEvents(prev => prev.map(x => x.eventId === ev.eventId ? {
            ...x,
            battlelogAudit: { ...(x.battlelogAudit || {}), escalatedAt: new Date().toISOString() }
          } : x));
        } catch (err) { console.error("Escalation failed:", err); }
        finally { reminderInFlight.current.delete(ev.eventId + "_esc"); }
      }
    };

    runReminders();
  }, [events, sendDiscordEmbed, setEvents, currentUser]);

  const toggleAtt = (memberId, eventId) => {
    const mId = (memberId || "").trim().toLowerCase();
    const current = attendance.find(a => (a.memberId || "").trim().toLowerCase() === mId && a.eventId === eventId);
    
    const newStatus = (current?.status === "present") ? "absent" : "present";
    const member = members.find(m => (m.memberId || "").toLowerCase() === mId);
    const ev = events.find(e => e.eventId === eventId);
    
    setAttendance(prev => {
      const exists = prev.some(a => (a.memberId || "").trim().toLowerCase() === mId && a.eventId === eventId);
      if (exists) {
        return prev.map(a => (a.memberId || "").trim().toLowerCase() === mId && a.eventId === eventId ? { ...a, status: newStatus } : a);
      }
      return [...prev, { memberId: memberId.trim(), eventId, status: newStatus }];
    });
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "attendance_toggle", `Marked ${member?.ign} as ${newStatus} — ${ev?.eventType} ${ev?.eventDate}`);
  };

  const savePerformance = (memberId, eventId) => {
    const key = `${memberId}_${eventId}`;
    const mId = (memberId || "").trim().toLowerCase();
    const edits = perfEdits[key] || {};
    
    const currentAtt = attendance.find(a => (a.memberId || "").trim().toLowerCase() === mId && a.eventId === eventId);
    if (!currentAtt) {
      setAttendance(prev => [...prev, { memberId: memberId.trim(), eventId, status: "present" }]);
    }

    setPerformance(prev => {
      const exists = prev.find(p => (p.memberId || "").trim().toLowerCase() === mId && p.eventId === eventId);
      if (exists) return prev.map(p => (p.memberId || "").trim().toLowerCase() === mId && p.eventId === eventId ? { ...p, ...edits } : p);
      return [...prev, { memberId: memberId.trim(), eventId, ctf1: 0, ctf2: 0, ctf3: 0, ctfPoints: 0, performancePoints: 0, kills: 0, assists: 0, ...edits }];
    });
    const member = members.find(m => (m.memberId || "").trim().toLowerCase() === mId);
    const ev = events.find(e => e.eventId === eventId);
    showToast("Performance saved", "success");
    const ctfTot = (edits.ctf1 ?? 0) + (edits.ctf2 ?? 0) + (edits.ctf3 ?? 0);
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "score_save", `Saved scores for ${member?.ign} — CTF: ${edits.ctf1 ?? 0}+${edits.ctf2 ?? 0}+${edits.ctf3 ?? 0}=${ctfTot}, Perf: ${edits.performancePoints ?? 0}, Kills: ${edits.kills ?? 0}, Ast: ${edits.assists ?? 0} (${ev?.eventDate})`);
  };

  const leaderboardSnapshot = React.useMemo(
    () => computeLeaderboard(activeMembers, events, attendance, performance, eoRatings),
    [activeMembers, events, attendance, performance, eoRatings]
  );

  const buildDigestSnapshot = React.useCallback((eventObj) => {
    if (!eventObj) return null;
    const eventMembers = members.filter(m => {
      const mId = (m.memberId || "").toLowerCase();
      const hasAtt = attendance.some(a => a.eventId === eventObj.eventId && (a.memberId || "").toLowerCase() === mId);
      const isActive = (m.status || "active") === "active";
      return hasAtt || isActive;
    }).map(m => {
      const mId = (m.memberId || "").toLowerCase();
      return {
        ...m,
        att: attendance.find(a => a.eventId === eventObj.eventId && (a.memberId || "").toLowerCase() === mId),
        perf: performance.find(p => (p.memberId || "").toLowerCase() === mId && p.eventId === eventObj.eventId)
      };
    });
    const presentRows = eventMembers.filter(m => m.att?.status === "present");
    const withEventScore = presentRows.map(m => ({
      ...m,
      eventScore: computeScore({ event: eventObj, att: m.att, perf: m.perf })
    }));
    const topDps = withEventScore
      .filter(m => (m.role || "").toLowerCase() === "dps")
      .sort((a, b) => b.eventScore - a.eventScore)
      .slice(0, 10);
    const topSupport = withEventScore
      .filter(m => (m.role || "").toLowerCase().includes("support"))
      .sort((a, b) => b.eventScore - a.eventScore)
      .slice(0, 10);
    const topAttendance = [...leaderboardSnapshot]
      .sort((a, b) => b.attendancePct - a.attendancePct || b.totalScore - a.totalScore)
      .slice(0, 10);
    const hashPayload = {
      eventId: eventObj.eventId,
      eventType: eventObj.eventType,
      eventDate: eventObj.eventDate,
      topDps: topDps.map(m => [m.memberId, m.eventScore]),
      topSupport: topSupport.map(m => [m.memberId, m.eventScore]),
      topAttendance: topAttendance.map(m => [m.memberId, m.attendancePct])
    };
    return { topDps, topSupport, topAttendance, hash: JSON.stringify(hashPayload) };
  }, [attendance, leaderboardSnapshot, members, performance]);
  
  const currentDigest = React.useMemo(() => buildDigestSnapshot(selectedEvent), [buildDigestSnapshot, selectedEvent]);
  const digestAlreadyPosted = !!selectedEvent?.digestMeta?.hash;
  const digestIsUpdated = digestAlreadyPosted && selectedEvent?.digestMeta?.hash !== currentDigest?.hash;

  const postEventDigest = async (mode = "manual") => {
    if (!selectedEvent) return;
    const digest = buildDigestSnapshot(selectedEvent);
    if (!digest) return;
    const isFinalize = mode === "finalize";
    if (!isFinalize && selectedEvent?.digestMeta?.hash && selectedEvent.digestMeta.hash === digest.hash) {
      showToast("Digest unchanged. No repost needed.", "info");
      return;
    }
    if (isFinalize) setFinalizingDigest(true);
    else setPostingDigest(true);
    try {
      const rowText = (list, scoreKey = "eventScore", suffix = "pts") =>
        list.length ? list.map((m, i) => `${i + 1}. ${m.ign} — ${m[scoreKey]} ${suffix}`).join("\n") : "No data yet";

      await sendDiscordEmbed(
        "📊 Post-Event Digest",
        isFinalize ? "Finalized event digest from officer review." : "Updated event digest after score edits.",
        0xF0C040,
        [
          { name: "Event", value: `${selectedEvent.eventType} • ${selectedEvent.eventDate}`, inline: false },
          { name: "Top 10 DPS", value: rowText(digest.topDps), inline: false },
          { name: "Top 10 Support/Utility", value: rowText(digest.topSupport), inline: false },
          { name: "Top 10 Attendance", value: rowText(digest.topAttendance, "attendancePct", "%"), inline: false }
        ],
        "https://raw.githubusercontent.com/n8n-weiss/oblivion-logo.png",
        "event_digest",
        "event_digest",
        { type: selectedEvent.eventType, date: selectedEvent.eventDate }
      );

      const digestMeta = {
        hash: digest.hash,
        postedAt: new Date().toISOString(),
        postedBy: currentUser?.email || "unknown",
        finalized: isFinalize || !!selectedEvent?.digestMeta?.finalized
      };

      let updatedAudit = selectedEvent.battlelogAudit;
      if (isFinalize && updatedAudit && updatedAudit.status !== "submitted") {
        updatedAudit = {
          ...updatedAudit,
          status: "submitted",
          submittedAt: new Date().toISOString(),
          submittedBy: currentUser?.email || "unknown"
        };
      }

      setEvents(prev => prev.map(ev => {
        if (ev.eventId === selectedEvent.eventId) {
          const updatedEvent = { ...ev, digestMeta };
          if (isFinalize && updatedAudit) updatedEvent.battlelogAudit = updatedAudit;
          return updatedEvent;
        }
        return ev;
      }));
      setSelectedEvent(prev => {
        if (!prev) return prev;
        const updatedEvent = { ...prev, digestMeta };
        if (isFinalize && updatedAudit) updatedEvent.battlelogAudit = updatedAudit;
        return updatedEvent;
      });

      showToast(isFinalize ? "Finalized digest & submitted audit log" : "Reposted updated digest", "success");
      writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, isFinalize ? "event_digest_finalize" : "event_digest_repost", `${selectedEvent.eventType} ${selectedEvent.eventDate}`);
    } catch (err) {
      console.error(err);
      showToast("Failed to post event digest", "error");
    } finally {
      setPostingDigest(false);
      setFinalizingDigest(false);
    }
  };

  const getAuditStatus = (ev) => {
    if (!ev?.battlelogAudit) return null;
    if (ev.battlelogAudit.status === "submitted") return "submitted";
    let status = ev.battlelogAudit.status || "pending";
    if (status === "overdue" && ev.battlelogAudit.dueAt) {
      let d = new Date(ev.battlelogAudit.dueAt).getTime();
      const s = new Date(`${ev.eventDate}T00:00:00`).getTime();
      if (d <= s + 23 * 60 * 60 * 1000 && !ev.eventTime) d += 24 * 60 * 60 * 1000;
      if (d > Date.now()) status = "pending";
    }
    return status;
  };

  const evt = selectedEvent;
  const evtAtt = evt ? attendance.filter(a => a.eventId === evt.eventId) : [];
  const evtMembers = evt ? members.filter(m => {
    const mId = (m.memberId || "").trim().toLowerCase();
    const hasAtt = attendance.some(a => a.eventId === evt.eventId && (a.memberId || "").trim().toLowerCase() === mId);
    const isActive = (m.status || "active") === "active";
    return hasAtt || isActive;
  }).map(m => {
    const mId = (m.memberId || "").trim().toLowerCase();
    return {
      ...m,
      att: evtAtt.find(a => (a.memberId || "").trim().toLowerCase() === mId),
      perf: performance.find(p => (p.memberId || "").trim().toLowerCase() === mId && p.eventId === evt.eventId)
    };
  }) : [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📅 Events</h1>
        <p className="page-subtitle">Track Guild League and Emperium Overrun events</p>
      </div>

      <div className="events-layout-container">
        {!selectedEvent && (
          <div className="events-sidebar">
          <div className="flex items-center justify-between mb-3">
            <span className="font-cinzel text-xs text-muted" style={{ letterSpacing: 2, textTransform: "uppercase" }}>Events ({events.length})</span>
            <button className="btn btn-primary btn-sm" onClick={handleNewClick}><Icon name="plus" size={12} /> New</button>
          </div>
          <div className="flex flex-col gap-2">
            {events.length === 0 && <div className="text-muted text-sm" style={{ textAlign: "center", padding: "24px 0" }}>No events yet</div>}
            {monthKeys.map(month => {
              const weekGroups = groupedEvents[month];
              const isMonthExpanded = !!expandedMonths[month];
              const weekKeys = Object.keys(weekGroups);
              return (
                <div key={month} style={{ marginBottom: 6 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ 
                        width: "100%", justifyContent: "space-between", fontSize: 11, padding: "10px 12px", 
                        background: "var(--bg-card2)", border: "1px solid var(--border)", 
                        marginBottom: isMonthExpanded ? 8 : 0, borderRadius: 8
                      }}
                      onClick={() => toggleMonth(month)}
                    >
                    <span style={{ fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--accent)", fontSize: 10 }}>{isMonthExpanded ? "▼" : "▶"}</span> {month.toUpperCase()}
                    </span>
                    <span className="badge badge-casual" style={{ fontSize: 9 }}>{Object.values(weekGroups).flat().length}</span>
                  </button>
                  {isMonthExpanded && (
                    <div className="flex flex-col gap-1" style={{ paddingLeft: 8, borderLeft: "1px solid rgba(99,130,230,0.15)", marginLeft: 8, animation: "fade-in 0.2s" }}>
                      {weekKeys.map(weekKey => {
                        const weekEvents = weekGroups[weekKey];
                        const isWeekExpanded = !!expandedWeeks[weekKey];
                        return (
                          <div key={weekKey} style={{ marginBottom: 4 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ 
                                width: "100%", justifyContent: "flex-start", fontSize: 10, padding: "6px 10px", 
                                background: isWeekExpanded ? "var(--accent-light)" : "var(--bg-hover)", 
                                border: "1px solid var(--border)", 
                                borderRadius: 6, gap: 8, letterSpacing: 0.5, color: isWeekExpanded ? "var(--text-primary)" : "var(--text-muted)",
                                height: "auto"
                              }}
                              onClick={() => toggleWeek(weekKey)}
                            >
                              <span style={{ color: isWeekExpanded ? "var(--accent)" : "rgba(255,255,255,0.2)", fontSize: 8 }}>{isWeekExpanded ? "▼" : "▶"}</span>
                              <span style={{ fontWeight: 800 }}>{weekKey.toUpperCase()}</span>
                            </button>
                            {isWeekExpanded && (
                              <div className="flex flex-col gap-2 mt-2" style={{ animation: "fade-in 0.15s", paddingLeft: 4 }}>
                                {weekEvents.map(ev => {
                                  const evAtt = attendance.filter(a => a.eventId === ev.eventId);
                                  const present = evAtt.filter(a => (a.status || "present") === "present").length;
                                  const isActive = selectedEvent?.eventId === ev.eventId;
                                  return (
                                    <div key={ev.eventId} onClick={() => setSelectedEvent(ev)}
                                      className="card" style={{ cursor: "pointer", padding: "12px 14px", borderColor: isActive ? "var(--accent)" : "var(--border)", boxShadow: isActive ? "0 0 16px var(--accent-glow)" : "none", background: isActive ? "rgba(99,130,230,0.03)" : undefined }}>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-cinzel" style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 700 }}>{new Date(ev.eventDate).toLocaleDateString("en-US", { weekday: 'short', day: 'numeric' })}</span>
                                        <span className={`badge ${ev.eventType === "Guild League" ? "badge-gl" : "badge-eo"}`} style={{ fontSize: 8, padding: "1px 6px" }}>
                                          {ev.eventType === "Guild League" ? "GL" : "EO"}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="text-[10px] text-muted">{present}/{evAtt.length} present</div>
                                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                          {getAuditStatus(ev) === "submitted" && <span title="Audited" style={{ color: "var(--green)", fontSize: 10 }}>●</span>}
                                          {getAuditStatus(ev) === "overdue" && <span title="Overdue" style={{ color: "var(--red)", fontSize: 10 }}>●</span>}
                                        </div>
                                      </div>
                                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                                        {confirmDelete === ev.eventId ? (
                                          <div className="flex gap-2 items-center">
                                            <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); deleteEvent(ev.eventId); }}>Yes</button>
                                            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}>No</button>
                                          </div>
                                        ) : (
                                          isAdmin ? <button className="btn btn-danger btn-sm" style={{ width: "100%", padding: "4px" }}
                                            onClick={e => { e.stopPropagation(); setConfirmDelete(ev.eventId); }}>
                                            <Icon name="trash" size={10} /> Delete
                                          </button> : null
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}

        <div className="events-detail">
          {selectedEvent ? (
            <div className="card">
              <div className="section-header">
                <div>
                  <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12, paddingLeft: 0, opacity: 0.8 }} onClick={() => setSelectedEvent(null)}>
                    <Icon name="chevron-left" size={12} /> Back
                  </button>
                  <div className="font-cinzel" style={{ fontSize: 16, fontWeight: 700 }}>{selectedEvent.eventDate}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`badge ${selectedEvent.eventType === "Guild League" ? "badge-gl" : "badge-eo"}`}>{selectedEvent.eventType}</span>
                    <span className={`badge ${getAuditStatus(selectedEvent) === "submitted" ? "badge-active" : getAuditStatus(selectedEvent) === "overdue" ? "badge-atrisk" : "badge-casual"}`} style={{ fontSize: 9 }}>
                      Audit: {getAuditStatus(selectedEvent) || "pending"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEditClick(selectedEvent)}>
                    <Icon name="edit" size={12} /> Edit
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => postEventDigest("finalize")} disabled={postingDigest || finalizingDigest}>
                    <Icon name="check" size={12} /> {finalizingDigest ? "Finalizing..." : "Finalize"}
                  </button>
                </div>
              </div>
              <div className="table-responsive">
                <div className="text-xs text-muted" style={{ marginBottom: 16 }}>
                  Assigned Auditor: <strong>{selectedEvent.battlelogAudit?.assignedIgn || "Unassigned"}</strong>
                </div>
                <table className="sticky-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead><tr>
                    <th style={{ zIndex: 30 }}>Member</th><th>Class</th><th>Attendance</th>
                    {selectedEvent.eventType === "Guild League" && <><th>CTF 1</th><th>CTF 2</th><th>CTF 3</th><th>Total</th><th>Kills</th><th>Assists</th><th>Perf</th><th>Score</th><th></th></>}
                    {selectedEvent.eventType === "Emperium Overrun" && <th>Rating</th>}
                  </tr></thead>
                  <tbody>
                    {evtMembers.map(m => {
                      const key = `${m.memberId}_${selectedEvent.eventId}`;
                      const curPerf = perfEdits[key] || {};
                      const ctf1 = curPerf.ctf1 !== undefined ? curPerf.ctf1 : (m.perf?.ctf1 ?? m.perf?.ctfPoints ?? 0);
                      const ctf2 = curPerf.ctf2 !== undefined ? curPerf.ctf2 : (m.perf?.ctf2 ?? 0);
                      const ctf3 = curPerf.ctf3 !== undefined ? curPerf.ctf3 : (m.perf?.ctf3 ?? 0);
                      const ctfTotal = ctf1 + ctf2 + ctf3;
                      const pp = curPerf.performancePoints !== undefined ? curPerf.performancePoints : (m.perf?.performancePoints ?? 0);
                      const kills = curPerf.kills !== undefined ? curPerf.kills : (m.perf?.kills ?? 0);
                      const assists = curPerf.assists !== undefined ? curPerf.assists : (m.perf?.assists ?? 0);
                      const score = computeScore({ event: selectedEvent, att: m.att, perf: { ctf1, ctf2, ctf3, performancePoints: pp, kills, assists } });
                      return (
                         <tr key={m.memberId}>
                          <td className="sticky-col" style={{ padding: "12px 16px", background: "var(--bg-card2)", borderRight: "1px solid var(--border)" }}>
                            <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 13 }}>{m.ign}</div>
                          </td>
                          <td className="text-secondary" style={{ fontSize: 12 }}>{m.class}</td>
                          <td>
                            <button className={`att-toggle ${m.att?.status || "present"}`} onClick={() => toggleAtt(m.memberId, selectedEvent.eventId)}>
                              {(m.att?.status || "present") === "present" ? "Present" : "Absent"}
                            </button>
                          </td>
                          {selectedEvent.eventType === "Guild League" && (
                            <>
                              <td><input type="number" className="form-input" style={{ width: 50 }} value={ctf1} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, ctf1: +e.target.value } }))} /></td>
                              <td><input type="number" className="form-input" style={{ width: 50 }} value={ctf2} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, ctf2: +e.target.value } }))} /></td>
                              <td><input type="number" className="form-input" style={{ width: 50 }} value={ctf3} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, ctf3: +e.target.value } }))} /></td>
                              <td style={{ fontWeight: 700 }}>{ctfTotal}</td>
                              <td><input type="number" className="form-input" style={{ width: 50 }} value={kills} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, kills: +e.target.value } }))} /></td>
                              <td><input type="number" className="form-input" style={{ width: 50 }} value={assists} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, assists: +e.target.value } }))} /></td>
                              <td><input type="number" className="form-input" style={{ width: 50 }} value={pp} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, performancePoints: +e.target.value } }))} /></td>
                              <td style={{ fontWeight: 700, color: "var(--accent)" }}>{score}</td>
                              <td><button className="btn btn-ghost btn-sm" onClick={() => savePerformance(m.memberId, selectedEvent.eventId)}><Icon name="save" size={12} /></button></td>
                            </>
                          )}
                          {selectedEvent.eventType === "Emperium Overrun" && (
                            <td>
                              <div style={{ display: "flex", gap: 2 }}>
                                {[1, 2, 3, 4, 5].map(star => {
                                  const currentRating = eoRatings.find(r => r.memberId === m.memberId && r.eventId === selectedEvent.eventId)?.rating || 0;
                                  return (
                                    <span key={star} onClick={() => {
                                      const newRating = star === currentRating ? 0 : star;
                                      setEoRatings(prev => {
                                        const exists = prev.find(r => r.memberId === m.memberId && r.eventId === selectedEvent.eventId);
                                        if (exists) return prev.map(r => r.memberId === m.memberId && r.eventId === selectedEvent.eventId ? { ...r, rating: newRating } : r);
                                        return [...prev, { memberId: m.memberId, eventId: selectedEvent.eventId, rating: newRating }];
                                      });
                                    }} style={{ cursor: "pointer", color: star <= currentRating ? "var(--gold)" : "rgba(255,255,255,0.1)" }}>★</span>
                                  );
                                })}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
              <div className="text-muted">Select an event to view details</div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <Modal title={isEditing ? "Edit Event" : "Create New Event"} onClose={() => setShowModal(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSaveEvent}>{isEditing ? "Save" : "Create"}</button></>}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Event Type</label>
              <select className="form-select" value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>
                <option>Guild League</option>
                <option>Emperium Overrun</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={form.eventDate} onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default EventsPage;
