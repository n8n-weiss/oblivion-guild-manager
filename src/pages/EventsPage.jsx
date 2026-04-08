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
    showToast, isAdmin, currentUser, sendDiscordEmbed
  } = useGuild();
  const activeMembers = React.useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [postingDigest, setPostingDigest] = useState(false);
  const [finalizingDigest, setFinalizingDigest] = useState(false);

  const deleteEvent = (eventId) => {
    const ev = events.find(e => e.eventId === eventId);
    setEvents(prev => prev.filter(e => e.eventId !== eventId));
    setAttendance(prev => prev.filter(a => a.eventId !== eventId));
    setPerformance(prev => prev.filter(p => p.eventId !== eventId));
    if (selectedEvent?.eventId === eventId) setSelectedEvent(null);
    showToast("Event deleted", "success");
    setConfirmDelete(null);
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "event_delete", `Deleted event ${ev?.eventType} — ${ev?.eventDate}`);
  };
  const [form, setForm] = useState({ eventType: "Guild League", eventDate: new Date().toISOString().split("T")[0] });
  const [perfEdits, setPerfEdits] = useState({});

  const createEvent = async () => {
    const eventId = `EVT${Date.now()}`;
    const newEvent = { eventId, ...form };
    setEvents(prev => [...prev, newEvent]);

    // auto-load active members with absence-aware attendance
    const newAtt = activeMembers.map(m => {
      const hasAbsence = absences.find(a => a.memberId === m.memberId && (!a.eventType || a.eventType === form.eventType) && a.eventDate === form.eventDate);
      return { memberId: m.memberId, eventId, status: hasAbsence ? "loa" : "present" };
    });

    setAttendance(prev => [...prev, ...newAtt]);
    showToast("Event created with attendance loaded", "success");
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "event_create", `Created ${form.eventType} event — ${form.eventDate}`);
    
    // Discord Notification
    await sendDiscordEmbed(
      "📅 New Event Scheduled",
      `A new guild event has been scheduled! Please check your attendance.`,
      0x6382E6, // Blue
      [
        { name: "Event Type", value: form.eventType, inline: true },
        { name: "Date", value: form.eventDate, inline: true },
        { name: "Note", value: "Attendance auto-loaded based on your LOA filings." }
      ],
      "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png",
      "none",
      "events",
      "event_created",
      { type: form.eventType, date: form.eventDate }
    );

    setShowModal(false);
  };

  const toggleAtt = (memberId, eventId) => {
    const mId = (memberId || "").toLowerCase();
    const current = attendance.find(a => (a.memberId || "").toLowerCase() === mId && a.eventId === eventId);
    
    // Cycle: present -> absent -> loa -> present
    let newStatus = "present";
    if (current?.status === "present") newStatus = "absent";
    else if (current?.status === "absent") newStatus = "loa";
    else if (current?.status === "loa") newStatus = "present";

    const member = members.find(m => (m.memberId || "").toLowerCase() === mId);
    const ev = events.find(e => e.eventId === eventId);
    
    setAttendance(prev => {
      const exists = prev.some(a => (a.memberId || "").toLowerCase() === mId && a.eventId === eventId);
      if (exists) {
        return prev.map(a => (a.memberId || "").toLowerCase() === mId && a.eventId === eventId ? { ...a, status: newStatus } : a);
      }
      return [...prev, { memberId, eventId, status: newStatus }];
    });

    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "attendance_toggle", `Marked ${member?.ign} as ${newStatus} — ${ev?.eventType} ${ev?.eventDate}`);
  };

  const savePerformance = (memberId, eventId) => {
    const key = `${memberId}_${eventId}`;
    const mId = (memberId || "").toLowerCase();
    const edits = perfEdits[key] || {};
    setPerformance(prev => {
      const exists = prev.find(p => (p.memberId || "").toLowerCase() === mId && p.eventId === eventId);
      if (exists) return prev.map(p => (p.memberId || "").toLowerCase() === mId && p.eventId === eventId ? { ...p, ...edits } : p);
      return [...prev, { memberId, eventId, ctf1: 0, ctf2: 0, ctf3: 0, ctfPoints: 0, performancePoints: 0, ...edits }];
    });
    const member = members.find(m => (m.memberId || "").toLowerCase() === mId);
    const ev = events.find(e => e.eventId === eventId);
    showToast("Performance saved", "success");
    const ctfTot = (edits.ctf1 ?? 0) + (edits.ctf2 ?? 0) + (edits.ctf3 ?? 0);
    writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "score_save", `Saved scores for ${member?.ign} — CTF: ${edits.ctf1 ?? 0}+${edits.ctf2 ?? 0}+${edits.ctf3 ?? 0}=${ctfTot}, Perf: ${edits.performancePoints ?? 0} (${ev?.eventDate})`);
  };

  const evt = selectedEvent;
  const evtAtt = evt ? attendance.filter(a => a.eventId === evt.eventId) : [];
  const evtMembers = evt ? members.filter(m => {
    const mId = (m.memberId || "").toLowerCase();
    const hasAtt = attendance.some(a => a.eventId === evt.eventId && (a.memberId || "").toLowerCase() === mId);
    const isActive = (m.status || "active") === "active";
    return hasAtt || isActive;
  }).map(m => {
    const mId = (m.memberId || "").toLowerCase();
    return {
      ...m,
      att: evtAtt.find(a => (a.memberId || "").toLowerCase() === mId),
      perf: performance.find(p => (p.memberId || "").toLowerCase() === mId && p.eventId === evt.eventId)
    };
  }) : [];
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
      .slice(0, 5);
    const topSupport = withEventScore
      .filter(m => (m.role || "").toLowerCase().includes("support"))
      .sort((a, b) => b.eventScore - a.eventScore)
      .slice(0, 5);
    const topAttendance = [...leaderboardSnapshot]
      .sort((a, b) => b.attendancePct - a.attendancePct || b.totalScore - a.totalScore)
      .slice(0, 5);
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
          { name: "Top 5 DPS", value: rowText(digest.topDps), inline: false },
          { name: "Top 5 Support/Utility", value: rowText(digest.topSupport), inline: false },
          { name: "Top 5 Attendance", value: rowText(digest.topAttendance, "attendancePct", "%"), inline: false }
        ],
        "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png",
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
      setEvents(prev => prev.map(ev => (
        ev.eventId === selectedEvent.eventId
          ? { ...ev, digestMeta }
          : ev
      )));
      setSelectedEvent(prev => prev ? { ...prev, digestMeta } : prev);
      showToast(isFinalize ? "Finalized and posted event digest" : "Reposted updated digest", "success");
      writeAuditLog(
        currentUser?.email,
        currentUser?.displayName || currentUser?.email,
        isFinalize ? "event_digest_finalize" : "event_digest_repost",
        `${selectedEvent.eventType} ${selectedEvent.eventDate}`
      );
    } catch (err) {
      console.error(err);
      showToast("Failed to post event digest", "error");
    } finally {
      setPostingDigest(false);
      setFinalizingDigest(false);
    }
  };

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
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Icon name="plus" size={12} /> New</button>
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
                    <span className="font-cinzel" style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700 }}>{ev.eventDate}</span>
                    <span className={`badge ${ev.eventType === "Guild League" ? "badge-gl" : "badge-eo"}`} style={{ fontSize: 9 }}>
                      {ev.eventType === "Guild League" ? "GL" : "EO"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted">{present}/{evAtt.length} present</div>
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                    {confirmDelete === ev.eventId ? (
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-muted">Delete?</span>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteEvent(ev.eventId)}>Yes</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>No</button>
                      </div>
                    ) : (
                      isAdmin ? <button className="btn btn-danger btn-sm" style={{ width: "100%" }}
                        onClick={e => { e.stopPropagation(); setConfirmDelete(ev.eventId); }}>
                        <Icon name="trash" size={12} /> Delete
                      </button> : null
                    )}
                  </div>
                </div>
              );
            })}
            {events.length === 0 && <div className="text-muted text-sm" style={{ textAlign: "center", padding: "24px 0" }}>No events yet</div>}
          </div>
        </div>

        {/* Event Detail */}
        <div style={{ flex: 1 }}>
          {selectedEvent ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-cinzel" style={{ fontSize: 16, fontWeight: 700 }}>{selectedEvent.eventDate}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge ${selectedEvent.eventType === "Guild League" ? "badge-gl" : "badge-eo"}`}>{selectedEvent.eventType}</span>
                    <span className="text-xs text-muted">{evtAtt.filter(a => a.status === "present").length}/{evtAtt.length} present</span>
                    {digestAlreadyPosted && (
                      <span className={`badge ${digestIsUpdated ? "badge-casual" : "badge-active"}`} style={{ fontSize: 9 }}>
                        {digestIsUpdated ? "Digest Outdated" : "Digest Posted"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={() => postEventDigest("finalize")} disabled={postingDigest || finalizingDigest}>
                    <Icon name="check" size={12} /> {finalizingDigest ? "Finalizing..." : "Finalize & Post Top 5"}
                  </button>
                  {digestIsUpdated && (
                    <button className="btn btn-ghost btn-sm" onClick={() => postEventDigest("repost")} disabled={postingDigest || finalizingDigest}>
                      <Icon name="refresh" size={12} /> {postingDigest ? "Posting..." : "Repost Updated"}
                    </button>
                  )}
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Member</th><th>Class</th><th>Attendance</th>
                    {selectedEvent.eventType === "Guild League" && <><th>CTF 1</th><th>CTF 2</th><th>CTF 3</th><th>CTF Total</th><th>Perf Pts</th><th>Score</th><th></th></>}
                    {selectedEvent.eventType === "Emperium Overrun" && <th>EO Rating</th>}
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
                      const score = computeScore({ event: selectedEvent, att: m.att, perf: { ctf1, ctf2, ctf3, performancePoints: pp } });
                      return (
                        <tr key={m.memberId}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{m.ign}</div>
                            <div className="text-xs text-muted">{m.memberId}</div>
                          </td>
                          <td className="text-secondary" style={{ fontSize: 12 }}>{m.class}</td>
                          <td>
                            <button className={`att-toggle ${m.att?.status || "absent"}`} onClick={() => toggleAtt(m.memberId, selectedEvent.eventId)} title="Click to cycle status (Present > Absent > LOA)">
                              {m.att?.status === "present" ? <><Icon name="check" size={11} /> Present</> : 
                               m.att?.status === "loa" ? <><Icon name="shield" size={11} /> LOA</> : 
                               <><Icon name="x" size={11} /> Absent</>}
                            </button>
                          </td>

                          {selectedEvent.eventType === "Guild League" && (
                            <>
                              <td>
                                <input type="number" className="form-input" style={{ width: 56, padding: "4px 8px", fontSize: 13 }} min={0}
                                  value={ctf1}
                                  onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, ctf1: +e.target.value } }))}
                                  disabled={m.att?.status !== "present"} />
                              </td>
                              <td>
                                <input type="number" className="form-input" style={{ width: 56, padding: "4px 8px", fontSize: 13 }} min={0}
                                  value={ctf2}
                                  onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, ctf2: +e.target.value } }))}
                                  disabled={m.att?.status !== "present"} />
                              </td>
                              <td>
                                <input type="number" className="form-input" style={{ width: 56, padding: "4px 8px", fontSize: 13 }} min={0}
                                  value={ctf3}
                                  onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, ctf3: +e.target.value } }))}
                                  disabled={m.att?.status !== "present"} />
                              </td>
                              <td>
                                <span style={{
                                  fontFamily: "Cinzel,serif", fontSize: 14, fontWeight: 700,
                                  color: ctfTotal > 0 ? "var(--accent)" : "var(--text-muted)",
                                  background: "rgba(99,130,230,0.1)", padding: "3px 10px", borderRadius: 6
                                }}>
                                  {ctfTotal}
                                </span>
                              </td>
                              <td>
                                <input type="number" className="form-input" style={{ width: 64, padding: "4px 8px", fontSize: 13 }} min={0}
                                  value={pp}
                                  onChange={e => setPerfEdits(prev => ({ ...prev, [key]: { ...prev[key] || {}, performancePoints: +e.target.value } }))}
                                  disabled={m.att?.status !== "present"} />
                              </td>
                              <td>
                                <span style={{
                                  fontFamily: "Cinzel,serif", fontSize: 15, fontWeight: 700,
                                  color: score < 0 ? "var(--red)" : score >= 30 ? "var(--gold)" : score >= 15 ? "var(--green)" : "var(--accent)",
                                  textShadow: score < 0 ? "0 0 8px rgba(224,80,80,0.4)" : score >= 30 ? "0 0 8px rgba(240,192,64,0.4)" : "0 0 8px rgba(64,201,122,0.3)"
                                }}>
                                  {score > 0 ? `+${score}` : score}
                                </span>
                              </td>
                              <td>
                                <button className="btn btn-ghost btn-sm" onClick={() => savePerformance(m.memberId, selectedEvent.eventId)}><Icon name="save" size={12} /></button>
                              </td>
                            </>
                          )}
                          {selectedEvent.eventType === "Emperium Overrun" && (
                            <td>
                              {m.att?.status === "present" ? (
                                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                                  {[1, 2, 3, 4, 5].map(star => {
                                    const currentRating = eoRatings.find(r => r.memberId === m.memberId && r.eventId === selectedEvent.eventId)?.rating || 0;
                                    return (
                                      <span key={star}
                                        onClick={() => {
                                          const newRating = star === currentRating ? 0 : star;
                                          setEoRatings(prev => {
                                            const exists = prev.find(r => r.memberId === m.memberId && r.eventId === selectedEvent.eventId);
                                            if (exists) return prev.map(r => r.memberId === m.memberId && r.eventId === selectedEvent.eventId ? { ...r, rating: newRating } : r);
                                            return [...prev, { memberId: m.memberId, eventId: selectedEvent.eventId, rating: newRating }];
                                          });
                                          if (newRating > 0) writeAuditLog(currentUser?.email, currentUser?.displayName || currentUser?.email, "eo_rating", `Rated ${m.ign} ${newRating}/5 stars — EO ${selectedEvent.eventDate}`);
                                        }}
                                        style={{
                                          fontSize: 18, cursor: "pointer",
                                          color: star <= currentRating ? "var(--gold)" : "rgba(99,130,230,0.2)",
                                          textShadow: star <= currentRating ? "0 0 8px rgba(240,192,64,0.5)" : "none",
                                          transition: "all 0.15s"
                                        }}>★</span>
                                    );
                                  })}
                                  {(() => {
                                    const r = eoRatings.find(r => r.memberId === m.memberId && r.eventId === selectedEvent.eventId)?.rating || 0;
                                    return r > 0 ? <span style={{ fontSize: 11, color: "var(--gold)", marginLeft: 4, fontWeight: 700 }}>{r}/5</span> : null;
                                  })()}
                                </div>
                              ) : (
                                <span className="text-xs text-muted">— absent</span>
                              )}
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
          footer={<><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={createEvent}><Icon name="plus" size={14} /> Create Event</button></>}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Event Type</label>
              <select className="form-select" value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>
                <option>Guild League</option>
                <option>Emperium Overrun</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Event Date</label>
              <input type="date" className="form-input" value={form.eventDate} onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))} />
            </div>
          </div>
          <div className="text-xs text-muted mt-2" style={{ padding: "10px 14px", background: "rgba(99,130,230,0.05)", borderRadius: 8, border: "1px solid var(--border)" }}>
            ℹ️ All {activeMembers.length} active members will be auto-loaded as Present. Absence records will override to Absent.
          </div>
        </Modal>
      )}
    </div>
  );
}

export default EventsPage;
