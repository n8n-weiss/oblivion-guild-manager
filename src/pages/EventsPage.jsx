import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import Modal from '../components/ui/Modal';
import { computeScore } from '../utils/scoring';
import { computeLeaderboard } from '../utils/scoring';
import { writeAuditLog } from "../utils/audit";

function EventsPage() {
  const {
    members, events, setEvents, deleteEvent: deleteEventFromDb, attendance, setAttendance,
    performance, setPerformance, absences, eoRatings, setEoRatings,
    showToast, isAdmin, currentUser, sendDiscordEmbed,
    hasMoreEvents, loadingHistory, fetchFullHistory, broadcastStateSync,
    officerActivities, broadcastActivity, myMemberId
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
    glMode: "vale",
    eventDate: new Date().toLocaleDateString('en-CA'),
    eventTime: "20:55",
    auditDueOffsetHours: 12
  });
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [postingDigest, setPostingDigest] = useState(false);
  const [finalizingDigest, setFinalizingDigest] = useState(false);

  // Helper to get Week Label (Monday to Sunday rule)
  const getWeekKey = (dateObj) => {
    const d = new Date(dateObj);
    const day = d.getDay(); // 0 (Sun) to 6 (Sat)
    // Find the Monday of this week
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return `${monday.toLocaleDateString("en-US", { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString("en-US", { month: 'short', day: 'numeric' })}`;
  };

  // Group events by Month and Week — sorted newest-first
  const groupedEvents = React.useMemo(() => {
    const groups = {};
    const sorted = [...events].sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));
    sorted.forEach(ev => {
      const d = new Date(ev.eventDate + 'T00:00:00'); 
      const monthKey = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthKey]) groups[monthKey] = {};

      const weekKey = getWeekKey(d);

      if (!groups[monthKey][weekKey]) groups[monthKey][weekKey] = [];
      groups[monthKey][weekKey].push(ev);
    });
    return groups;
  }, [events]);

  const monthKeys = Object.keys(groupedEvents).sort((a, b) => new Date(b) - new Date(a));

  const initialLoadRef = React.useRef(false);

  // Auto-select and auto-expand newest — only once on load
  React.useEffect(() => {
    if (events.length > 0 && !initialLoadRef.current) {
      const newest = [...events].sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate))[0];
      if (newest) {
        setSelectedEvent(newest);
        initialLoadRef.current = true;
        
        const d = new Date(newest.eventDate + 'T00:00:00');
        const monthKey = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        const weekKey = getWeekKey(d);
        
        setExpandedMonths(prev => ({ ...prev, [monthKey]: true }));
        setExpandedWeeks(prev => ({ ...prev, [weekKey]: true }));
      }
    }
  }, [events]);

  const toggleMonth = (m) => setExpandedMonths(prev => ({ ...prev, [m]: !prev[m] }));
  const toggleWeek = (w) => setExpandedWeeks(prev => ({ ...prev, [w]: !prev[w] }));

  const deleteEvent = async (id) => {
    const success = await deleteEventFromDb(id);
    if (success) {
      if (selectedEvent?.eventId === id) setSelectedEvent(null);
      writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "event_delete", `Deleted event ${id}`);
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editEventId, setEditEventId] = useState(null);
  const [perfEdits, setPerfEdits] = useState({});
  const [attEdits, setAttEdits] = useState({});
  const [autoSaveStatus, setAutoSaveStatus] = useState("synced"); // "synced", "dirty", "saving"
  const autoSaveTimerRef = useRef(null);

  // Auto-save logic
  useEffect(() => {
    const hasPerfPending = Object.keys(perfEdits).filter(k => k.endsWith(`_${selectedEvent?.eventId}`)).length > 0;
    const hasAttPending = Object.keys(attEdits).filter(k => k.endsWith(`_${selectedEvent?.eventId}`)).length > 0;

    if (hasPerfPending || hasAttPending) {
      setAutoSaveStatus("dirty");
      
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      
      autoSaveTimerRef.current = setTimeout(() => {
        setAutoSaveStatus("saving");
        if (hasPerfPending) saveAllPerformance();
        if (hasAttPending) saveAllAttendance();
        setTimeout(() => setAutoSaveStatus("synced"), 1000);
      }, 5000); 
    }

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [perfEdits, attEdits]);
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

  // Excel-Mode Keyboard Navigation
  const handleKeyDown = (e, rowIndex, colIndex) => {
    let targetRow = rowIndex;
    let targetCol = colIndex;

    if (e.key === 'ArrowUp') {
      targetRow = Math.max(0, rowIndex - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      targetRow = rowIndex + 1;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      targetCol = Math.max(0, colIndex - 1);
    } else if (e.key === 'ArrowRight') {
      targetCol = colIndex + 1;
    } else {
      return;
    }

    const nextId = `perf-${targetRow}-${targetCol}`;
    const nextEl = document.getElementById(nextId);
    if (nextEl) {
      nextEl.focus();
    }
  };

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
      setSelectedEvent(newEvent);

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
    }
    setShowModal(false);
    setIsEditing(false);
    setEditEventId(null);
  };

  const handleEditClick = (ev) => {
    setForm({
      eventType: ev.eventType,
      glMode: ev.glMode || 'vale',
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
      glMode: "vale",
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
  // Reminders are now handled by Server-Side Cron Job.
  }, [events, setEvents, currentUser]);

  // Broadcast auditing activity
  React.useEffect(() => {
    if (selectedEvent) {
      broadcastActivity({ action: "auditing_event", eventId: selectedEvent.eventId });
    } else {
      broadcastActivity({ action: "idle" });
    }
  }, [selectedEvent, broadcastActivity]);

  const toggleAtt = (memberId, eventId) => {
    const key = `${memberId}_${eventId}`;
    const currentStatus = attEdits[key] || attendance.find(a => a.eventId === eventId && (a.memberId || "").trim().toLowerCase() === memberId.trim().toLowerCase())?.status || "present";
    const newStatus = currentStatus === "present" ? "absent" : "present";
    setAttEdits(prev => ({ ...prev, [key]: newStatus }));
  };

  const markAllPresent = (eventId) => {
    const activeIds = activeMembers.map(m => (m.memberId || "").trim());
    const newEdits = {};
    activeIds.forEach(id => {
      newEdits[`${id}_${eventId}`] = "present";
    });
    setAttEdits(prev => ({ ...prev, ...newEdits }));
    showToast("All active members marked as present (pending save)", "success");
  };

  const saveAllAttendance = () => {
    const keys = Object.keys(attEdits).filter(k => k.endsWith(`_${selectedEvent?.eventId}`));
    if (keys.length === 0) return;

    setAttendance(prev => {
      let next = [...prev];
      keys.forEach(key => {
        const [mId] = key.split('_');
        const status = attEdits[key];
        const exists = next.some(a => (a.memberId || "").trim().toLowerCase() === mId.toLowerCase() && a.eventId === selectedEvent.eventId);
        if (exists) {
          next = next.map(a => (a.memberId || "").trim().toLowerCase() === mId.toLowerCase() && a.eventId === selectedEvent.eventId ? { ...a, status } : a);
        } else {
          next.push({ memberId: mId.trim(), eventId: selectedEvent.eventId, status });
        }
      });
      return next;
    });

    setAttEdits({});
    showToast(`Saved attendance batch for ${selectedEvent.eventType}`, "success");
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "attendance_bulk", `Batch saved attendance for ${selectedEvent.eventType} on ${selectedEvent.eventDate}`);
  };

  const savePerformance = (memberId, eventId) => {
    const key = `${memberId}_${eventId}`;
    const mId = (memberId || "").trim().toLowerCase();
    const edits = perfEdits[key] || {};
    const member = members.find(m => (m.memberId || "").trim().toLowerCase() === mId);
    const ev = events.find(e => e.eventId === eventId);
    
    const currentAtt = attendance.find(a => (a.memberId || "").trim().toLowerCase() === mId && a.eventId === eventId);
    if (!currentAtt) {
      setAttendance(prev => [...prev, { memberId: memberId.trim(), eventId, status: "present" }]);
    }

    setPerformance(prev => {
      const exists = prev.find(p => (p.memberId || "").trim().toLowerCase() === mId && p.eventId === eventId);
      let next;
      if (exists) {
        next = prev.map(p => (p.memberId || "").trim().toLowerCase() === mId && p.eventId === eventId ? { ...p, ...edits } : p);
      } else {
        const isStellar = ev?.glMode === 'stellar';
        const defaultFields = isStellar
          ? { glTeam: 'main', tabletsCapt: 0, monsters: 0, boss: 0, kills: 0, assists: 0, totalScore: 0 }
          : { ctf1: 0, ctf2: 0, ctf3: 0, ctfPoints: 0, performancePoints: 0, kills: 0, assists: 0 };
        next = [...prev, { memberId: memberId.trim(), eventId, ...defaultFields, ...edits }];
      }

      const updatedItem = next.find(p => (p.memberId || "").trim().toLowerCase() === mId && p.eventId === eventId);
      if (updatedItem && broadcastStateSync) {
        broadcastStateSync('performance', updatedItem);
      }
      return next;
    });
    showToast("Performance saved", "success");
    const ctfTot = (edits.ctf1 ?? 0) + (edits.ctf2 ?? 0) + (edits.ctf3 ?? 0);
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "score_save", `Saved scores for ${member?.ign} — CTF: ${edits.ctf1 ?? 0}+${edits.ctf2 ?? 0}+${edits.ctf3 ?? 0}=${ctfTot}, Perf: ${edits.performancePoints ?? 0}, Kills: ${edits.kills ?? 0}, Ast: ${edits.assists ?? 0} (${ev?.eventDate})`);
  };

  const saveAllPerformance = () => {
    const keys = Object.keys(perfEdits).filter(k => k.endsWith(`_${selectedEvent.eventId}`));
    if (keys.length === 0) {
      showToast("No changes to save", "info");
      return;
    }

    setPerformance(prev => {
      let next = [...prev];
      keys.forEach(key => {
        const [memberId] = key.split('_');
        const mId = memberId.trim().toLowerCase();
        const edits = perfEdits[key];
        const exists = next.find(p => (p.memberId || "").trim().toLowerCase() === mId && p.eventId === selectedEvent.eventId);
        if (exists) {
          next = next.map(p => (p.memberId || "").trim().toLowerCase() === mId && p.eventId === selectedEvent.eventId ? { ...p, ...edits } : p);
        } else {
          const isStellar = selectedEvent?.glMode === 'stellar';
          const defaultFields = isStellar
            ? { glTeam: 'main', tabletsCapt: 0, monsters: 0, boss: 0, kills: 0, assists: 0, totalScore: 0 }
            : { ctf1: 0, ctf2: 0, ctf3: 0, ctfPoints: 0, performancePoints: 0, kills: 0, assists: 0 };
          next.push({ memberId: memberId.trim(), eventId: selectedEvent.eventId, ...defaultFields, ...edits });
        }
        
        const updatedItem = next.find(p => (p.memberId || "").trim().toLowerCase() === mId && p.eventId === selectedEvent.eventId);
        if (updatedItem && broadcastStateSync) {
          broadcastStateSync('performance', updatedItem);
        }
      });
      return next;
    });

    setPerfEdits({}); 
    showToast(`Saved all changes for ${selectedEvent.eventType}`, "success");
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "bulk_score_save", `Bulk saved scores for ${selectedEvent.eventType} on ${selectedEvent.eventDate}`);
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
    return { withEventScore, topDps, topSupport, topAttendance, hash: JSON.stringify(hashPayload) };
  }, [attendance, leaderboardSnapshot, members, performance]);
  
  const postEventDigest = async (mode = "manual") => {
    if (!selectedEvent) return;
    const digest = buildDigestSnapshot(selectedEvent);
    if (!digest) return;
    const { withEventScore } = digest;
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

      const presentCount = withEventScore.length;
      const totalScore = withEventScore.reduce((acc, m) => acc + (m.eventScore || 0), 0);
      const avgScore = presentCount > 0 ? (totalScore / presentCount).toFixed(1) : 0;
      const totalActiveMembers = members.filter(m => (m.status || 'active') === 'active').length;
      const participationPct = totalActiveMembers > 0 ? ((presentCount / totalActiveMembers) * 100).toFixed(1) : 0;

      await sendDiscordEmbed(
        `🛡️  __**OBLIVION EVENT COMBAT RESULTS**__  🛡️`,
        isFinalize 
          ? `Finalized combat results for ${selectedEvent.eventType} on ${selectedEvent.eventDate}. Excellent performance, everyone!\n\u200B` 
          : `Updated combat results for ${selectedEvent.eventType} on ${selectedEvent.eventDate}.\n\u200B`,
        selectedEvent.glMode === 'stellar' ? 0x9333ea : 0x6382E6,
        [
          { name: "📊 GUILD SUMMARY", value: `👥 **Participation:** ${participationPct}% (${presentCount}/${totalActiveMembers})\n📈 **Average Score:** ${avgScore} pts`, inline: false },
          { name: "🏆 TOP 10 OVERALL", value: rowText(withEventScore.sort((a, b) => b.eventScore - a.eventScore).slice(0, 10)), inline: false },
          { name: "⚔️ TOP 10 DPS", value: rowText(digest.topDps), inline: true },
          { name: "🛡️ TOP 10 SUPPORT", value: rowText(digest.topSupport), inline: true },
          { name: "📋 TOP 10 ATTENDANCE (SNAPSHOT)", value: rowText(digest.topAttendance, "attendancePct", "%"), inline: false }
        ],
        "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png",
        "event_results",
        "event_results",
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
  }).map((m, idx) => {
    const mId = (m.memberId || "").trim().toLowerCase();
    return {
      ...m,
      rowIndex: idx,
      att: evtAtt.find(a => (a.memberId || "").trim().toLowerCase() === mId),
      perf: performance.find(p => (p.memberId || "").trim().toLowerCase() === mId && p.eventId === evt.eventId),
      eoRating: eoRatings.find(r => (r.memberId || "").trim().toLowerCase() === mId && r.eventId === evt.eventId)?.rating || 0
    };
  }) : [];

  // Color-coded input style helper for battle log columns
  const inputStyle = (accentColor) => ({
    width: 60,
    textAlign: "center",
    padding: "4px 2px",
    fontSize: 13,
    borderColor: `${accentColor}55`,
    boxShadow: "none",
    background: `${accentColor}08`
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📅 Events</h1>
        <p className="page-subtitle">Track Guild League and Emperium Overrun events</p>
      </div>

      <div className="events-layout-container">
          <div className="events-sidebar">
          <div className="flex items-center justify-between mb-3">
            <span className="font-cinzel text-xs text-muted" style={{ letterSpacing: 2, textTransform: "uppercase" }}>Events ({events.length})</span>
            <button className="btn btn-primary btn-sm" onClick={handleNewClick}><Icon name="plus" size={12} /> New</button>
          </div>
          <div className="flex flex-col gap-2" style={{ maxHeight: "600px", overflowY: "auto", overflowX: "hidden", paddingRight: 4, paddingBottom: 10 }}>
            {events.length === 0 && <div className="text-muted text-sm" style={{ textAlign: "center", padding: "24px 0" }}>No events yet</div>}
            {monthKeys.map(month => {
              const weekGroups = groupedEvents[month];
              const isMonthExpanded = !!expandedMonths[month];
              // Sort weeks newest-first (Week 4 → Week 3 → …)
              const weekKeys = Object.keys(weekGroups).sort((a, b) => {
                const dateA = new Date(weekGroups[a][0].eventDate);
                const dateB = new Date(weekGroups[b][0].eventDate);
                return dateB - dateA;
              });
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
                              {weekKey === getWeekKey(new Date()) && (
                                <span className="badge badge-gl" style={{ fontSize: 7, marginLeft: 'auto', padding: '1px 4px' }}>CURRENT</span>
                              )}
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
                                        <span className="font-cinzel" style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 700 }}>
                                          {new Date(ev.eventDate + 'T00:00:00').toLocaleDateString("en-US", { weekday: 'short', day: 'numeric' })}
                                        </span>
                                        <span className={`badge ${ev.eventType === "Guild League" ? "badge-gl" : "badge-eo"}`} style={{ fontSize: 8, padding: "1px 6px" }}>
                                          {ev.eventType === "Guild League" ? "GL" : "EO"}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="text-[10px] text-muted">{present}/{evAtt.length} present</div>
                                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                          {/* Auditors Indicator */}
                                          {Object.values(officerActivities || {})
                                            .filter(a => a.memberId !== myMemberId && a.action === 'auditing_event' && a.eventId === ev.eventId && (Date.now() - (a.lastSeen || 0) < 30000))
                                            .map(a => (
                                              <span key={a.memberId} title={`${a.ign} is auditing...`} 
                                                style={{ fontSize: 10, animation: "pulse 2s infinite", filter: "drop-shadow(0 0 2px var(--accent))" }}>
                                                👁️
                                              </span>
                                            ))
                                          }
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

            {hasMoreEvents && (
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ width: "100%", marginTop: 12, fontSize: 10, border: "1px dashed var(--border)", color: "var(--accent)" }}
                onClick={fetchFullHistory}
                disabled={loadingHistory}
              >
                {loadingHistory ? (
                  <span className="flex items-center gap-2"><div className="spinner" style={{ width: 10, height: 10 }} /> LOADING...</span>
                ) : (
                  <><Icon name="rotate-cw" size={12} /> LOAD PREVIOUS HISTORY</>
                )}
              </button>
            )}
          </div>
        </div>

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
                    {selectedEvent.eventType === "Guild League" && (
                      <span className="badge" style={{ fontSize: 9, background: selectedEvent.glMode === 'stellar' ? 'rgba(168,85,247,0.2)' : 'rgba(99,130,230,0.2)', color: selectedEvent.glMode === 'stellar' ? '#a855f7' : '#6382E6', border: `1px solid ${selectedEvent.glMode === 'stellar' ? 'rgba(168,85,247,0.4)' : 'rgba(99,130,230,0.4)'}` }}>
                        {selectedEvent.glMode === 'stellar' ? '✨ Stellar Clash' : '⚔ Vale of Clash'}
                      </span>
                    )}
                    <span className={`badge ${getAuditStatus(selectedEvent) === "submitted" ? "badge-active" : getAuditStatus(selectedEvent) === "overdue" ? "badge-atrisk" : "badge-casual"}`} style={{ fontSize: 9 }}>
                      Audit: {getAuditStatus(selectedEvent) || "pending"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {autoSaveStatus !== "synced" && (
                    <div style={{ 
                      display: "flex", alignItems: "center", gap: 10, padding: "6px 16px", borderRadius: 12, 
                      background: autoSaveStatus === "dirty" ? "rgba(240,192,64,0.15)" : "rgba(99,130,230,0.15)",
                      border: `1px solid ${autoSaveStatus === "dirty" ? "rgba(240,192,64,0.3)" : "rgba(99,130,230,0.3)"}`,
                      animation: autoSaveStatus === "saving" ? "pulse 2s infinite" : "none"
                    }}>
                      <div style={{ 
                        width: 8, height: 8, borderRadius: "50%", 
                        background: autoSaveStatus === "dirty" ? "var(--gold)" : "#6382E6",
                        boxShadow: `0 0 8px ${autoSaveStatus === "dirty" ? "var(--gold)" : "#6382E6"}`
                      }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: autoSaveStatus === "dirty" ? "var(--gold)" : "#6382E6" }}>
                        {autoSaveStatus === "dirty" ? "UNSAVED CHANGES" : "AUTO-SAVING..."}
                      </span>
                    </div>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEditClick(selectedEvent)}>
                    <Icon name="edit" size={12} /> Edit
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => postEventDigest("finalize")} disabled={postingDigest || finalizingDigest}>
                    <Icon name="check" size={12} /> {finalizingDigest ? "Finalizing..." : "Finalize"}
                  </button>
                  {Object.keys(perfEdits).some(k => k.endsWith(`_${selectedEvent.eventId}`)) && (
                    <button 
                      className="btn btn-primary btn-sm" 
                      style={{ padding: "6px 12px", borderRadius: 8, background: "var(--green)", borderColor: "var(--green)", boxShadow: "0 4px 12px rgba(34,197,94,0.3)" }}
                      onClick={saveAllPerformance}
                    >
                      <Icon name="save" size={12} /> Save Now
                    </button>
                  )}
                </div>
              </div>
              <div className="table-responsive">
                <div className="text-xs text-muted" style={{ marginBottom: 16 }}>
                  Assigned Auditor: <strong>{selectedEvent.battlelogAudit?.assignedIgn || "Unassigned"}</strong>
                </div>
                <div className="table-wrap" style={{ maxHeight: "600px", overflowY: "auto", borderBottom: "1px solid var(--border)" }}>
                  <table className="sticky-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, position: "relative" }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 40, background: "var(--bg-card)", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                    {/* Group label row - Vale of Clash */}
                    {selectedEvent.eventType === "Guild League" && selectedEvent.glMode !== 'stellar' && (
                      <tr style={{ fontSize: 9, letterSpacing: 1 }}>
                        <th colSpan={3} style={{ zIndex: 30, background: "transparent", border: "none", paddingBottom: 2 }}></th>
                        <th colSpan={4} style={{ background: "rgba(99,130,230,0.08)", color: "#6382E6", borderBottom: "2px solid rgba(99,130,230,0.35)", textAlign: "center", paddingBottom: 4, textTransform: "uppercase" }}>CTF</th>
                        <th colSpan={2} style={{ background: "rgba(239,68,68,0.07)", color: "#ef4444", borderBottom: "2px solid rgba(239,68,68,0.3)", textAlign: "center", paddingBottom: 4, textTransform: "uppercase" }}>Combat</th>
                        <th colSpan={1} style={{ background: "rgba(168,85,247,0.07)", color: "#a855f7", borderBottom: "2px solid rgba(168,85,247,0.3)", textAlign: "center", paddingBottom: 4, textTransform: "uppercase" }}>Perf</th>
                        <th colSpan={2} style={{ background: "transparent", border: "none", paddingBottom: 2 }}></th>
                      </tr>
                    )}
                    {/* Group label row - Stellar Clash */}
                    {selectedEvent.eventType === "Guild League" && selectedEvent.glMode === 'stellar' && (
                      <tr style={{ fontSize: 9, letterSpacing: 1 }}>
                        <th colSpan={3} style={{ zIndex: 30, background: "transparent", border: "none", paddingBottom: 2 }}></th>
                        <th colSpan={1} style={{ background: "rgba(99,130,230,0.08)", color: "#6382E6", borderBottom: "2px solid rgba(99,130,230,0.35)", textAlign: "center", paddingBottom: 4, textTransform: "uppercase" }}>Team</th>
                        <th colSpan={3} style={{ background: "rgba(168,85,247,0.07)", color: "#a855f7", borderBottom: "2px solid rgba(168,85,247,0.3)", textAlign: "center", paddingBottom: 4, textTransform: "uppercase" }}>Field</th>
                        <th colSpan={2} style={{ background: "rgba(239,68,68,0.07)", color: "#ef4444", borderBottom: "2px solid rgba(239,68,68,0.3)", textAlign: "center", paddingBottom: 4, textTransform: "uppercase" }}>Combat</th>
                        <th colSpan={3} style={{ background: "transparent", border: "none", paddingBottom: 2 }}></th>
                      </tr>
                    )}
                    <tr>
                      <th style={{ zIndex: 30 }}>Member</th><th>Class</th>
                      <th>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          Attendance
                          <button 
                            className="btn btn-ghost btn-sm" 
                            style={{ padding: '2px 6px', fontSize: 9, color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)' }}
                            onClick={() => markAllPresent(selectedEvent.eventId)}
                          >
                            <Icon name="check" size={10} /> Mark All Present
                          </button>
                        </div>
                      </th>
                      {selectedEvent.eventType === "Guild League" && selectedEvent.glMode !== 'stellar' && <>
                        <th style={{ color: "#6382E6", fontSize: 11 }}>CTF 1</th>
                        <th style={{ color: "#6382E6", fontSize: 11 }}>CTF 2</th>
                        <th style={{ color: "#6382E6", fontSize: 11 }}>CTF 3</th>
                        <th style={{ color: "#6382E6", fontSize: 11 }}>Total</th>
                        <th style={{ color: "#ef4444", fontSize: 11 }}>Kills</th>
                        <th style={{ color: "#f59e0b", fontSize: 11 }}>Assists</th>
                        <th style={{ color: "#a855f7", fontSize: 11 }}>Perf</th>
                        <th style={{ color: "var(--accent)", fontSize: 11 }}>Score</th>
                        <th></th>
                      </>}
                      {selectedEvent.eventType === "Guild League" && selectedEvent.glMode === 'stellar' && <>
                        <th style={{ color: "#6382E6", fontSize: 11 }}>Team</th>
                        <th style={{ color: "#a855f7", fontSize: 11 }}>Tablets</th>
                        <th style={{ color: "#a855f7", fontSize: 11 }}>Monsters</th>
                        <th style={{ color: "#a855f7", fontSize: 11 }}>Boss</th>
                        <th style={{ color: "#ef4444", fontSize: 11 }}>Kills</th>
                        <th style={{ color: "#f59e0b", fontSize: 11 }}>Assists</th>
                        <th style={{ color: "#22c55e", fontSize: 11 }}>Total Score</th>
                        <th style={{ color: "var(--accent)", fontSize: 11 }}>Score</th>
                        <th></th>
                      </>}
                      {selectedEvent.eventType === "Emperium Overrun" && <>
                        <th></th>
                      </>}
                    </tr>
                  </thead>
                  <tbody>
                    {evtMembers.map(m => {
                      const key = `${m.memberId}_${selectedEvent.eventId}`;
                      const isDirty = !!perfEdits[key];
                      const isAttDirty = !!attEdits[key];
                      const attStatus = attEdits[key] || m.att?.status || "present";
                      const curPerf = perfEdits[key] || {};
                      const ctf1 = curPerf.ctf1 !== undefined ? curPerf.ctf1 : (m.perf?.ctf1 ?? m.perf?.ctfPoints ?? 0);
                      const ctf2 = curPerf.ctf2 !== undefined ? curPerf.ctf2 : (m.perf?.ctf2 ?? 0);
                      const ctf3 = curPerf.ctf3 !== undefined ? curPerf.ctf3 : (m.perf?.ctf3 ?? 0);
                      const ctfTotal = ctf1 + ctf2 + ctf3;
                      const pp = curPerf.performancePoints !== undefined ? curPerf.performancePoints : (m.perf?.performancePoints ?? 0);
                      const kills = curPerf.kills !== undefined ? curPerf.kills : (m.perf?.kills ?? 0);
                      const assists = curPerf.assists !== undefined ? curPerf.assists : (m.perf?.assists ?? 0);
                      const score = computeScore({ event: selectedEvent, att: { ...m.att, status: attStatus }, perf: { ctf1, ctf2, ctf3, performancePoints: pp, kills, assists } });
                      return (
                         <tr key={m.memberId} style={{ background: isDirty ? "rgba(240,192,64,0.03)" : undefined }}>
                          <td className="sticky-col" style={{ padding: "12px 16px", background: isDirty ? "rgba(240,192,64,0.05)" : "var(--bg-card2)", borderRight: "1px solid var(--border)" }}>
                            <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 13 }}>{m.ign}</div>
                          </td>
                          <td className="text-secondary" style={{ fontSize: 12 }}>{m.class}</td>
                          <td>
                            <button className={`att-toggle ${m.att?.status || "present"}`} onClick={() => toggleAtt(m.memberId, selectedEvent.eventId)}>
                              {(m.att?.status || "present") === "present" ? "Present" : "Absent"}
                            </button>
                          </td>
                          {selectedEvent.eventType === "Guild League" && selectedEvent.glMode !== 'stellar' && (
                            <>
                              {/* ── CTF inputs (blue) ── */}
                              <td><input id={`perf-${m.rowIndex}-${0}`} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, m.rowIndex, 0)} type="number" min={0} className="form-input" style={inputStyle("#6382E6")} value={ctf1} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, ctf1: +e.target.value } }))} /></td>
                              <td><input id={`perf-${m.rowIndex}-${1}`} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, m.rowIndex, 1)} type="number" min={0} className="form-input" style={inputStyle("#6382E6")} value={ctf2} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, ctf2: +e.target.value } }))} /></td>
                              <td><input id={`perf-${m.rowIndex}-${2}`} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, m.rowIndex, 2)} type="number" min={0} className="form-input" style={inputStyle("#6382E6")} value={ctf3} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, ctf3: +e.target.value } }))} /></td>
                              {/* CTF Total pill */}
                              <td><span style={{ display: "inline-block", minWidth: 36, textAlign: "center", fontWeight: 800, fontSize: 13, color: "#6382E6", background: "rgba(99,130,230,0.12)", borderRadius: 6, padding: "3px 8px" }}>{ctfTotal}</span></td>
                              {/* ── Combat inputs ── */}
                              <td><input id={`perf-${m.rowIndex}-${3}`} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, m.rowIndex, 3)} type="number" min={0} className="form-input" style={inputStyle("#ef4444")} value={kills} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, kills: +e.target.value } }))} /></td>
                              <td><input id={`perf-${m.rowIndex}-${4}`} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, m.rowIndex, 4)} type="number" min={0} className="form-input" style={inputStyle("#f59e0b")} value={assists} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, assists: +e.target.value } }))} /></td>
                              {/* ── Perf input (purple) ── */}
                              <td><input id={`perf-${m.rowIndex}-${5}`} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, m.rowIndex, 5)} type="number" min={0} className="form-input" style={inputStyle("#a855f7")} value={pp} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, performancePoints: +e.target.value } }))} /></td>
                              {/* Score pill */}
                              <td><span style={{ display: "inline-block", minWidth: 40, textAlign: "center", fontWeight: 800, fontSize: 13, color: "var(--accent)", background: "rgba(99,130,230,0.1)", borderRadius: 6, padding: "3px 8px" }}>{score}</span></td>
                              <td>
                                {isDirty && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gold)", margin: "0 auto", boxShadow: "0 0 8px var(--gold)" }} title="Unsaved changes" />}
                              </td>
                            </>
                          )}
                          {selectedEvent.eventType === "Guild League" && selectedEvent.glMode === 'stellar' && (() => {
                            const glTeam = curPerf.glTeam !== undefined ? curPerf.glTeam : (m.perf?.glTeam || 'main');
                            const isMain = glTeam === 'main';
                            const tablets = curPerf.tabletsCapt !== undefined ? curPerf.tabletsCapt : (m.perf?.tabletsCapt ?? 0);
                            const monsters = curPerf.monsters !== undefined ? curPerf.monsters : (m.perf?.monsters ?? 0);
                            const boss = curPerf.boss !== undefined ? curPerf.boss : (m.perf?.boss ?? 0);
                            const sKills = curPerf.kills !== undefined ? curPerf.kills : (m.perf?.kills ?? 0);
                            const sAssists = curPerf.assists !== undefined ? curPerf.assists : (m.perf?.assists ?? 0);
                            const sTotal = curPerf.totalScore !== undefined ? curPerf.totalScore : (m.perf?.totalScore ?? 0);
                            const sScore = computeScore({ event: selectedEvent, att: m.att, perf: { glTeam, tabletsCapt: tablets, monsters, boss, kills: sKills, assists: sAssists, totalScore: sTotal } });
                            return (
                              <>
                                {/* Team toggle */}
                                <td>
                                  <button
                                    onClick={() => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, glTeam: isMain ? 'sub' : 'main' } }))}
                                    style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: `1px solid ${isMain ? 'rgba(99,130,230,0.5)' : 'rgba(34,197,94,0.5)'}`, background: isMain ? 'rgba(99,130,230,0.12)' : 'rgba(34,197,94,0.12)', color: isMain ? '#6382E6' : '#22c55e', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 700 }}
                                  >
                                    {isMain ? '🔵 Main' : '🟢 Sub'}
                                  </button>
                                </td>
                                {/* Tablets (Main only) */}
                                <td><input id={`perf-${m.rowIndex}-${0}`} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, m.rowIndex, 0)} type="number" min={0} className="form-input" style={{ ...inputStyle("#a855f7"), opacity: isMain ? 1 : 0.3 }} value={isMain ? tablets : ''} placeholder={isMain ? "" : "-"} disabled={!isMain} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, tabletsCapt: +e.target.value } }))} /></td>
                                {/* Monsters (both) */}
                                <td><input id={`perf-${m.rowIndex}-${1}`} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, m.rowIndex, 1)} type="number" min={0} className="form-input" style={inputStyle("#a855f7")} value={monsters} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, monsters: +e.target.value } }))} /></td>
                                {/* Boss (Sub only) */}
                                <td><input id={`perf-${m.rowIndex}-${2}`} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, m.rowIndex, 2)} type="number" min={0} className="form-input" style={{ ...inputStyle("#a855f7"), opacity: !isMain ? 1 : 0.3 }} value={!isMain ? boss : ''} placeholder={!isMain ? "" : "-"} disabled={isMain} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, boss: +e.target.value } }))} /></td>
                                {/* Kills */}
                                <td><input id={`perf-${m.rowIndex}-${3}`} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, m.rowIndex, 3)} type="number" min={0} className="form-input" style={inputStyle("#ef4444")} value={sKills} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, kills: +e.target.value } }))} /></td>
                                {/* Assists */}
                                <td><input id={`perf-${m.rowIndex}-${4}`} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, m.rowIndex, 4)} type="number" min={0} className="form-input" style={inputStyle("#f59e0b")} value={sAssists} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, assists: +e.target.value } }))} /></td>
                                {/* Total Score */}
                                <td><input id={`perf-${m.rowIndex}-${5}`} onFocus={e => e.target.select()} onKeyDown={e => handleKeyDown(e, m.rowIndex, 5)} type="number" min={0} className="form-input" style={inputStyle("#22c55e")} value={sTotal} onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, totalScore: +e.target.value } }))} /></td>
                                {/* Computed Score pill */}
                                <td><span style={{ display: "inline-block", minWidth: 40, textAlign: "center", fontWeight: 800, fontSize: 13, color: "var(--accent)", background: "rgba(99,130,230,0.1)", borderRadius: 6, padding: "3px 8px" }}>{sScore}</span></td>
                                <td>
                                  {isDirty && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gold)", margin: "0 auto", boxShadow: "0 0 8px var(--gold)" }} title="Unsaved changes" />}
                                </td>
                              </>
                            );
                          })()}
                          {selectedEvent.eventType === "Emperium Overrun" && (
                            <>
                              <td colSpan={2}>
                                <div className="text-muted" style={{ fontSize: 11, fontStyle: 'italic' }}>Pure attendance mode</div>
                              </td>
                              <td>
                                {isAttDirty && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gold)", margin: "0 auto", boxShadow: "0 0 8px var(--gold)" }} title="Unsaved changes" />}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
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
              <select className="form-select" value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value, glMode: e.target.value === 'Guild League' ? (f.glMode || 'vale') : undefined }))}>
                <option>Guild League</option>
                <option>Emperium Overrun</option>
              </select>
            </div>
            {form.eventType === "Guild League" && (
              <div className="form-group">
                <label className="form-label">GL Mode</label>
                <select className="form-select" value={form.glMode || 'vale'} onChange={e => setForm(f => ({ ...f, glMode: e.target.value }))}>
                  <option value="vale">⚔ Vale of Clash</option>
                  <option value="stellar">✨ Stellar Clash</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={form.eventDate} onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}

      {/* Floating Action Bar for Bulk Saves */}
      {Object.keys(perfEdits).length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
          <div className="premium-pill glass-panel shadow-2xl" style={{ padding: '12px 24px', gap: 20, border: '1px solid var(--accent)', display: 'flex', alignItems: 'center' }}>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-accent uppercase tracking-widest" style={{ color: 'var(--accent)', fontWeight: 800 }}>Unsaved Changes</span>
              <span className="text-[10px] text-muted" style={{ opacity: 0.7 }}>{Object.keys(perfEdits).length} performance records modified</span>
            </div>
            <div className="flex gap-3" style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPerfEdits({})}>Discard</button>
              <button className="btn btn-primary btn-sm px-6" onClick={saveAllPerformance} style={{ padding: '6px 20px', borderRadius: 8 }}>
                <Icon name="save" size={12} /> Save All Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventsPage;
