import React, { useState, useMemo } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';

const PARTY_NAMES = ["Alpha Squad", "Bravo Force", "Charlie Wing", "Delta Strike", "Echo Vanguard", "Foxtrot Blade"];
const RAID_NAMES = ["Raid Alpha", "Raid Bravo", "Raid Charlie", "Raid Delta"];
const LEAGUE_MAIN_NAMES = ["Team 1", "Team 2", "Team 3", "Team 4", "Team 5", "Team 6", "Team 7", "Team 8"];
const LEAGUE_SUB_NAMES = ["Team 1", "Team 2", "Team 3", "Team 4", "Team 5", "Team 6", "Team 7", "Team 8"];
const RAID_CAPACITY = 40;

function PartyBuilder() {
  const {
    members, events, attendance,
    parties, setParties, partyNames, setPartyNames,
    raidParties, setRaidParties, raidPartyNames, setRaidPartyNames,
    leagueParties, setLeagueParties, leaguePartyNames, setLeaguePartyNames,
    partyOverrides, setPartyOverrides,
    showToast
  } = useGuild();

  const [builderType, setBuilderType] = useState("party");
  const [sourceMode, setSourceMode] = useState("all");
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [editingMember, setEditingMember] = useState(null);
  const [leagueSearch, setLeagueSearch] = useState("");

  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);

  const poolMembers = useMemo(() => {
    let baseMembers = [];
    if (sourceMode === "all") {
      baseMembers = activeMembers;
    } else {
      const eventId = sourceMode.replace("event:", "");
      const presentIds = new Set(
        activeMembers.filter(m => {
          const a = attendance.find(att => att.eventId === eventId && att.memberId === m.memberId);
          return (a?.status || "present") === "present";
        }).map(m => m.memberId)
      );
      baseMembers = members.filter(m => presentIds.has(m.memberId));
    }
    
    return baseMembers.map(m => {
      if (partyOverrides && partyOverrides[m.memberId]) {
        return { ...m, ...partyOverrides[m.memberId], isOverridden: true };
      }
      return m;
    });
  }, [sourceMode, activeMembers, members, attendance, partyOverrides]);

  // ── PARTY MODE ────────────────────────────────────────────────
  const assignedPartyIds = useMemo(() => new Set(parties.flatMap(p => p.map(m => m.memberId))), [parties]);
  const partyBench = useMemo(() => poolMembers.filter(m => !assignedPartyIds.has(m.memberId)), [poolMembers, assignedPartyIds]);
  const partyBenchDPS = useMemo(() => partyBench.filter(m => m.role === "DPS"), [partyBench]);
  const partyBenchSUP = useMemo(() => partyBench.filter(m => m.role !== "DPS"), [partyBench]);

  const addParty = () => setParties(prev => [...prev, []]);
  const removeParty = (idx) => setParties(prev => prev.filter((_, i) => i !== idx));
  const removeMemberFromParty = (memberId, partyIdx) =>
    setParties(prev => prev.map((p, i) => i === partyIdx ? p.filter(m => m.memberId !== memberId) : p));
  const addMemberToParty = (member, partyIdx) =>
    setParties(prev => {
      const cleaned = prev.map(p => p.filter(m => m.memberId !== member.memberId));
      return cleaned.map((p, i) => i === partyIdx ? [...p, member] : p);
    });
  const resetParties = () => setParties([]);

  // ── RAID MODE ─────────────────────────────────────────────────
  const assignedRaidIds = useMemo(() => new Set(raidParties.flatMap(r => r.map(m => m.memberId))), [raidParties]);
  const raidBench = useMemo(() => poolMembers.filter(m => !assignedRaidIds.has(m.memberId)), [poolMembers, assignedRaidIds]);
  const raidBenchDPS = useMemo(() => raidBench.filter(m => m.role === "DPS"), [raidBench]);
  const raidBenchSUP = useMemo(() => raidBench.filter(m => m.role !== "DPS"), [raidBench]);

  const addRaid = () => setRaidParties(prev => [...prev, []]);
  const removeRaid = (idx) => setRaidParties(prev => prev.filter((_, i) => i !== idx));

  const removeMemberFromRaid = (memberId, raidIdx) =>
    setRaidParties(prev => prev.map((r, i) => i === raidIdx ? r.filter(m => m.memberId !== memberId) : r));

  const addMemberToRaid = (member, raidIdx) => {
    if (raidParties[raidIdx] && raidParties[raidIdx].length >= RAID_CAPACITY) {
      showToast(`Raid is full! Maximum is ${RAID_CAPACITY} players per raid.`, "error");
      return;
    }
    setRaidParties(prev => {
      // Remove from all raid groups first
      const cleaned = prev.map(r => r.filter(m => m.memberId !== member.memberId));
      return cleaned.map((r, i) => i === raidIdx ? [...r, member] : r);
    });
  };

  const resetRaids = () => setRaidParties([]);

  // ── LEAGUE MODE ───────────────────────────────────────────────
  const assignedLeagueIds = useMemo(() => {
    const mainIds = (leagueParties.main || []).flatMap(p => p.map(m => m.memberId));
    const subIds = (leagueParties.sub || []).flatMap(p => p.map(m => m.memberId));
    return new Set([...mainIds, ...subIds]);
  }, [leagueParties]);
  
  const leagueBench = useMemo(() => poolMembers.filter(m => !assignedLeagueIds.has(m.memberId)), [poolMembers, assignedLeagueIds]);
  
  const filteredLeagueBench = useMemo(() => {
    if (!leagueSearch) return leagueBench;
    const term = leagueSearch.toLowerCase();
    return leagueBench.filter(m => 
      m.ign.toLowerCase().includes(term) || 
      m.class.toLowerCase().includes(term)
    );
  }, [leagueBench, leagueSearch]);

  const leagueBenchDPS = useMemo(() => filteredLeagueBench.filter(m => m.role === "DPS"), [filteredLeagueBench]);
  const leagueBenchSUP = useMemo(() => filteredLeagueBench.filter(m => m.role !== "DPS"), [filteredLeagueBench]);

  const removeMemberFromLeague = (memberId, field, partyIdx) => {
    setLeagueParties(prev => ({
      ...prev,
      [field]: (prev[field] || []).map((p, i) => i === partyIdx ? p.filter(m => m.memberId !== memberId) : p)
    }));
  };

  const addMemberToLeague = (member, field, partyIdx) => {
    setLeagueParties(prev => {
      // 1. Remove from ALL league parties first
      const nextMain = (prev.main || []).map(p => p.filter(m => m.memberId !== member.memberId));
      const nextSub = (prev.sub || []).map(p => p.filter(m => m.memberId !== member.memberId));
      
      const targetList = field === "main" ? nextMain : nextSub;
      
      // 2. Check capacity
      if (targetList[partyIdx] && targetList[partyIdx].length >= 5) {
        showToast("Party is full! (Max 5 members)", "error");
        return prev;
      }
      
      // 3. Add to target
      if (field === "main") {
        nextMain[partyIdx] = [...nextMain[partyIdx], member];
      } else {
        nextSub[partyIdx] = [...nextSub[partyIdx], member];
      }
      
      return { main: nextMain, sub: nextSub };
    });
  };

  const resetLeague = () => setLeagueParties({ main: Array(8).fill([]), sub: Array(8).fill([]) });

  // ── DRAG HANDLERS ─────────────────────────────────────────────
  const onDragStart = (memberId, from) => setDragging({ memberId, fromParty: from });
  const onDragEnd = () => { setDragging(null); setDragOver(null); };

  const onDrop = (toTarget) => {
    if (!dragging) return;
    const { memberId, fromParty } = dragging;
    const member = members.find(m => m.memberId === memberId);
    if (!member) return;

    if (builderType === "party") {
      if (toTarget === "bench") {
        if (fromParty !== "bench") removeMemberFromParty(memberId, fromParty);
      } else {
        addMemberToParty(member, toTarget);
      }
    } else if (builderType === "raid") {
      // raid mode — toTarget = "bench" | "raid:X"
      if (toTarget === "bench") {
        if (typeof fromParty === "string" && fromParty.startsWith("raid:")) {
          const raidIdx = parseInt(fromParty.split(":")[1]);
          removeMemberFromRaid(memberId, raidIdx);
        }
      } else if (typeof toTarget === "string" && toTarget.startsWith("raid:")) {
        const raidIdx = parseInt(toTarget.split(":")[1]);
        addMemberToRaid(member, raidIdx);
      }
    } else if (builderType === "league") {
      // league mode — toTarget = "bench" | "league:main:X" | "league:sub:X"
      if (toTarget === "bench") {
        if (typeof fromParty === "string" && fromParty.startsWith("league:")) {
          const parts = fromParty.split(":");
          const field = parts[1];
          const idx = parseInt(parts[2]);
          removeMemberFromLeague(memberId, field, idx);
        }
      } else if (typeof toTarget === "string" && toTarget.startsWith("league:")) {
        const parts = toTarget.split(":");
        const field = parts[1];
        const idx = parseInt(parts[2]);
        addMemberToLeague(member, field, idx);
      }
    }
    setDragging(null);
    setDragOver(null);
  };

  // ── RENAME HANDLERS ───────────────────────────────────────────
  const startRename = (i) => {
    if (builderType === "party") {
      setEditingName(i);
      setNameInput(partyNames[i] || PARTY_NAMES[i] || `Party ${i + 1}`);
    } else {
      setEditingName(`raid:${i}`);
      setNameInput(raidPartyNames[i] || RAID_NAMES[i] || `Raid ${i + 1}`);
    }
  };
  const commitRename = () => {
    if (typeof editingName === "string" && editingName.startsWith("raid:")) {
      const idx = parseInt(editingName.split(":")[1]);
      setRaidPartyNames(prev => { const n = [...prev]; n[idx] = nameInput || `Raid ${idx + 1}`; return n; });
    } else if (typeof editingName === "string" && editingName.startsWith("league:")) {
      const parts = editingName.split(":");
      const field = parts[1];
      const idx = parseInt(parts[2]);
      setLeaguePartyNames(prev => {
        const next = { ...prev };
        const list = [...(next[field] || Array(8).fill(""))];
        list[idx] = nameInput || `Party ${idx + 1}`;
        next[field] = list;
        return next;
      });
    } else {
      setPartyNames(prev => { const n = [...prev]; n[editingName] = nameInput || `Party ${editingName + 1}`; return n; });
    }
    setEditingName(null);
  };

  const hasParties = parties.length > 0;
  const hasRaids = raidParties.length > 0;
  const totalRaidMembers = raidParties.reduce((sum, r) => sum + r.length, 0);

  const dropTargetStyle = (idx) => ({
    outline: dragOver === idx ? "2px dashed var(--accent)" : "none",
    background: dragOver === idx ? "rgba(99,130,230,0.08)" : undefined,
    transition: "background 0.15s",
    minHeight: 48,
    borderRadius: 8,
  });

  const raidDropStyle = (raidKey) => ({
    outline: dragOver === raidKey ? "2px dashed var(--gold)" : "none",
    background: dragOver === raidKey ? "rgba(240,192,64,0.06)" : undefined,
    transition: "background 0.15s",
  });

  const switchBuilder = (type) => {
    setBuilderType(type);
    setDragging(null);
    setDragOver(null);
    setEditingName(null);
  };

  // ── BENCH RENDERER ────────────────────────────────────────────
  const renderBench = (bench, benchDPS, benchSUP, forRaid = false) => (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="card-title" style={{ marginBottom: 0 }}>🪑 Bench ({bench.length} unassigned)</div>
        <span className="text-xs text-muted">Drag members {forRaid ? "into raid groups below" : "between parties or back here"}</span>
      </div>
      <div
        style={{ ...dropTargetStyle("bench"), padding: 12 }}
        onDragOver={e => { e.preventDefault(); setDragOver("bench"); }}
        onDragLeave={() => setDragOver(null)}
        onDrop={() => onDrop("bench")}
      >
        {bench.length === 0 && <div className="text-xs text-muted" style={{ textAlign: "center", padding: "12px 0" }}>All members are assigned</div>}
        {bench.length > 0 && (
          <div className="grid-2 gap-6">
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--accent2)", marginBottom: 10, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8 }}>
                ⚔️ DPS UNITS ({benchDPS.length})
                <div style={{ flex: 1, height: 1, background: "rgba(224,92,138,0.15)" }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {benchDPS.map(m => (
                  <div key={m.memberId} draggable
                    onDragStart={() => onDragStart(m.memberId, "bench")}
                    onDragEnd={onDragEnd}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "var(--bg-card2)", border: m.isOverridden ? "1px solid var(--gold)" : "1px solid var(--border)", borderRadius: 8, cursor: "grab", userSelect: "none", fontSize: 12, fontWeight: 600, opacity: dragging?.memberId === m.memberId ? 0.4 : 1 }}>
                    <div onClick={(e) => { e.stopPropagation(); setEditingMember(m); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      {m.ign} <span style={{ opacity: 0.8, fontWeight: 400, fontSize: 10, color: m.isOverridden ? "var(--gold)" : "inherit" }}>({m.class}{m.isOverridden ? " *" : ""})</span>
                      <Icon name="edit" size={10} style={{ opacity: 0.4 }} />
                    </div>
                  </div>
                ))}
                {benchDPS.length === 0 && <div className="text-xs text-muted" style={{ fontStyle: "italic", fontSize: 10 }}>No DPS on bench</div>}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", marginBottom: 10, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8 }}>
                🛡️ SUPPORTS ({benchSUP.length})
                <div style={{ flex: 1, height: 1, background: "rgba(99,130,230,0.15)" }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {benchSUP.map(m => (
                  <div key={m.memberId} draggable
                    onDragStart={() => onDragStart(m.memberId, "bench")}
                    onDragEnd={onDragEnd}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "var(--bg-card2)", border: "1px solid var(--border)", borderRadius: 8, cursor: "grab", userSelect: "none", fontSize: 12, fontWeight: 600, opacity: dragging?.memberId === m.memberId ? 0.4 : 1 }}>
                    {m.ign} <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 10 }}>{m.class}</span>
                  </div>
                ))}
                {benchSUP.length === 0 && <div className="text-xs text-muted" style={{ fontStyle: "italic", fontSize: 10 }}>No Supports on bench</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">⭐ Party Builder</h1>
        <p className="page-subtitle">Manually arrange teams for guild events — state persists across tabs</p>
      </div>

      {/* Controls card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="flex gap-3 items-center" style={{ flexWrap: "wrap" }}>

            {/* Builder type toggle */}
            <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
              <label className="form-label">Builder Type</label>
              <div className="flex gap-1">
                <button
                  className={`btn btn-sm ${builderType === "party" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => switchBuilder("party")}
                >⭐ Party (5-man)</button>
                <button
                  className={`btn btn-sm ${builderType === "raid" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => switchBuilder("raid")}
                  style={builderType === "raid" ? { background: "linear-gradient(135deg,#c0392b,#e74c3c)", borderColor: "#c0392b" } : {}}
                >⚔️ Raid (40-man)</button>
                <button
                  className={`btn btn-sm ${builderType === "league" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => switchBuilder("league")}
                  style={builderType === "league" ? { background: "linear-gradient(135deg,var(--gold),#f39c12)", borderColor: "var(--gold)" } : {}}
                >🏆 Guild League</button>
              </div>
            </div>

            {/* Source selector */}
            <div className="form-group" style={{ gap: 4, marginBottom: 0 }}>
              <label className="form-label">Member Pool</label>
              <select className="form-select" style={{ width: "auto", fontSize: 13, padding: "6px 12px" }}
                value={sourceMode} onChange={e => {
                  if (e.target.value !== sourceMode) {
                    setSourceMode(e.target.value);
                    setParties([]); setRaidParties([]);
                  }
                }}>
                <option value="all">Active Members ({activeMembers.length})</option>
                {events.map(ev => {
                  const count = activeMembers.filter(m => {
                    const a = attendance.find(att => att.eventId === ev.eventId && att.memberId === m.memberId);
                    return (a?.status || "present") === "present";
                  }).length;
                  return (
                    <option key={ev.eventId} value={`event:${ev.eventId}`}>
                      {ev.eventDate} — {ev.eventType === "Guild League" ? "GL" : "EO"} ({count} present)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="text-xs text-muted" style={{ paddingTop: 18 }}>
              {poolMembers.length} members · {poolMembers.filter(m => m.role === "DPS").length} DPS · {poolMembers.filter(m => m.role !== "DPS").length} Support
              {builderType === "raid" && hasRaids && (
                <> · <span style={{ color: "var(--gold)", fontWeight: 700 }}>{totalRaidMembers} in {raidParties.length} raid{raidParties.length > 1 ? "s" : ""}</span></>
              )}
            </div>
          </div>

          <div className="flex gap-2" style={{ paddingTop: 18, flexWrap: "wrap" }}>
            {builderType === "party" ? (
              <>
                {hasParties && <button className="btn btn-ghost" onClick={resetParties}><Icon name="trash" size={14} /> Reset</button>}
                <button className="btn btn-primary" onClick={addParty}><Icon name="plus" size={14} /> Add Party</button>
              </>
            ) : builderType === "raid" ? (
              <>
                {hasRaids && <button className="btn btn-ghost" onClick={resetRaids}><Icon name="trash" size={14} /> Reset All</button>}
                <button className="btn btn-primary" onClick={addRaid} style={{ background: "linear-gradient(135deg,#c0392b,#e74c3c)", borderColor: "#c0392b" }}>
                  <Icon name="plus" size={14} /> Add Raid
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={resetLeague}><Icon name="trash" size={14} /> Reset League</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── PARTY MODE ── */}
      {builderType === "party" && (
        <>
          {hasParties && renderBench(partyBench, partyBenchDPS, partyBenchSUP, false)}

          {hasParties && (
            <div className="party-grid">
              {parties.map((party, i) => {
                const dpsC = party.filter(m => m.role === "DPS").length;
                const supC = party.filter(m => m.role !== "DPS").length;
                const name = partyNames[i] || `Party ${i + 1}`;
                return (
                  <div className="party-card" key={i}
                    style={dropTargetStyle(i)}
                    onDragOver={e => { e.preventDefault(); setDragOver(i); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => onDrop(i)}
                  >
                    <div className="flex items-center justify-between mb-1" style={{ gap: 6 }}>
                      {editingName === i ? (
                        <input className="form-input" style={{ fontSize: 13, padding: "3px 8px", flex: 1 }}
                          value={nameInput} autoFocus
                          onChange={e => setNameInput(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={e => e.key === "Enter" && commitRename()} />
                      ) : (
                        <div className="party-name" style={{ marginBottom: 0, flex: 1, cursor: "pointer" }}
                          onClick={() => startRename(i)}>
                          {name}
                          <span className="text-xs text-muted" style={{ marginLeft: 6, fontFamily: "Rajdhani,sans-serif", fontWeight: 400 }}>✎</span>
                        </div>
                      )}
                      {parties.length > 1 && (
                        <button className="btn btn-danger btn-sm btn-icon" style={{ padding: "3px 6px" }} onClick={() => removeParty(i)}><Icon name="x" size={11} /></button>
                      )}
                    </div>
                    <div className="flex gap-2 mb-3">
                      <span className="text-xs" style={{ color: "var(--accent2)" }}>{dpsC} DPS</span>
                      <span className="text-xs text-muted">·</span>
                      <span className="text-xs" style={{ color: "var(--accent)" }}>{supC} Support</span>
                      <span className="text-xs text-muted">· {party.length}/5</span>
                    </div>
                    {party.map((m) => (
                      <div className="party-member" key={m.memberId}
                        draggable
                        onDragStart={() => onDragStart(m.memberId, i)}
                        onDragEnd={onDragEnd}
                        style={{ cursor: "grab", opacity: dragging?.memberId === m.memberId ? 0.35 : 1 }}>
                        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setEditingMember(m); }} className="hover-highlight">
                          <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                            {m.ign}
                            <Icon name="edit" size={10} style={{ opacity: 0.3 }} />
                          </div>
                          <div style={{ fontSize: 11, color: m.isOverridden ? "var(--gold)" : "var(--text-muted)" }}>{m.class}{m.isOverridden ? " *" : ""}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 9 }}>
                            {m.role === "DPS" ? "DPS" : "SUP"}
                          </span>
                            <button style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", lineHeight: 1, marginLeft: 2 }}
                              onClick={() => removeMemberFromParty(m.memberId, i)} title="Remove">
                              <Icon name="x" size={12} />
                            </button>
                        </div>
                      </div>
                    ))}
                    {party.length === 0 && (
                      <div className="text-xs text-muted" style={{ textAlign: "center", padding: "12px 0", opacity: 0.5 }}>Drop members here</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!hasParties && (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
              <div className="empty-state">
                <div className="empty-state-icon">⭐</div>
                <div className="empty-state-text">
                  Add parties and drag members from the bench to start planning
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── RAID MODE ── */}
      {builderType === "raid" && (
        <>
          {/* Raid bench */}
          {hasRaids && renderBench(raidBench, raidBenchDPS, raidBenchSUP, true)}

          {/* Raid cards */}
          {hasRaids && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {raidParties.map((raid, ri) => {
                const raidKey = `raid:${ri}`;
                const dps = raid.filter(m => m.role === "DPS");
                const sup = raid.filter(m => m.role !== "DPS");
                const name = raidPartyNames[ri] || RAID_NAMES[ri] || `Raid ${ri + 1}`;
                const isEditing = editingName === `raid:${ri}`;

                return (
                  <div key={ri} className="card"
                    style={{
                      ...raidDropStyle(raidKey),
                      border: "1px solid rgba(192,57,43,0.35)",
                      boxShadow: "0 0 24px rgba(192,57,43,0.1)",
                    }}
                    onDragOver={e => { e.preventDefault(); setDragOver(raidKey); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => onDrop(raidKey)}
                  >
                    {/* Raid header */}
                    <div className="flex items-center justify-between mb-4">
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          {isEditing ? (
                            <input className="form-input" style={{ fontSize: 16, padding: "3px 8px", fontFamily: "Cinzel, serif", fontWeight: 900, maxWidth: 300 }}
                              value={nameInput} autoFocus
                              onChange={e => setNameInput(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={e => e.key === "Enter" && commitRename()} />
                          ) : (
                            <div style={{ fontFamily: "Cinzel, serif", fontWeight: 900, fontSize: 18, color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                              onClick={() => startRename(ri)}>
                              ⚔️ {name}
                              <span className="text-xs text-muted" style={{ fontFamily: "Rajdhani,sans-serif", fontWeight: 400 }}>✎</span>
                            </div>
                          )}
                          <span style={{
                            fontSize: 12, fontFamily: "Rajdhani, sans-serif", fontWeight: 700,
                            padding: "2px 10px", borderRadius: 20,
                            background: raid.length >= RAID_CAPACITY ? "rgba(192,57,43,0.25)" : "rgba(240,192,64,0.15)",
                            color: raid.length >= RAID_CAPACITY ? "#e74c3c" : "var(--gold)",
                            border: `1px solid ${raid.length >= RAID_CAPACITY ? "rgba(192,57,43,0.4)" : "rgba(240,192,64,0.3)"}`,
                          }}>
                            {raid.length} / {RAID_CAPACITY}
                          </span>
                          {raidParties.length > 1 && (
                            <button className="btn btn-danger btn-sm btn-icon" style={{ padding: "3px 6px", marginLeft: 4 }}
                              onClick={() => removeRaid(ri)} title="Remove this raid"><Icon name="x" size={11} /></button>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <span className="text-xs" style={{ color: "var(--accent2)" }}>{dps.length} DPS</span>
                          <span className="text-xs text-muted">·</span>
                          <span className="text-xs" style={{ color: "var(--accent)" }}>{sup.length} Support</span>
                        </div>
                      </div>
                      {/* Capacity bar */}
                      <div style={{ width: 140, textAlign: "right" }}>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
                          <div style={{
                            height: "100%", borderRadius: 4,
                            width: `${Math.min(100, (raid.length / RAID_CAPACITY) * 100)}%`,
                            background: raid.length >= RAID_CAPACITY
                              ? "linear-gradient(90deg,#c0392b,#e74c3c)"
                              : "linear-gradient(90deg,var(--gold),#f39c12)",
                            transition: "width 0.3s ease",
                          }} />
                        </div>
                        <div className="text-xs text-muted">{RAID_CAPACITY - raid.length} slots remaining</div>
                      </div>
                    </div>

                    {/* Raid empty state */}
                    {raid.length === 0 && (
                      <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-muted)", fontSize: 13 }}>
                        <div style={{ fontSize: 28, marginBottom: 6 }}>⚔️</div>
                        <div>Drag members here from the bench</div>
                      </div>
                    )}

                    {/* Raid members — two columns: DPS & Support */}
                    {raid.length > 0 && (
                      <div className="grid-2 gap-6">
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--accent2)", marginBottom: 10, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8 }}>
                            ⚔️ DPS ({dps.length})
                            <div style={{ flex: 1, height: 1, background: "rgba(224,92,138,0.2)" }} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {dps.map(m => (
                              <div key={m.memberId}
                                draggable
                                onDragStart={() => onDragStart(m.memberId, raidKey)}
                                onDragEnd={onDragEnd}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "space-between",
                                  padding: "6px 10px", background: "var(--bg-card2)",
                                  border: m.isOverridden ? "1px solid var(--gold)" : "1px solid var(--border)", borderRadius: 8,
                                  cursor: "grab", userSelect: "none",
                                  opacity: dragging?.memberId === m.memberId ? 0.35 : 1,
                                }}
                                onDoubleClick={() => setEditingMember(m)}>
                                <div style={{ cursor: "pointer", flex: 1 }} onClick={(e) => { e.stopPropagation(); setEditingMember(m); }} className="hover-highlight">
                                  <span style={{ fontWeight: 700, fontSize: 13 }}>{m.ign}</span>
                                  <span style={{ fontSize: 10, color: m.isOverridden ? "var(--gold)" : "var(--text-muted)", marginLeft: 8 }}>{m.class}{m.isOverridden ? " *" : ""}</span>
                                  <Icon name="edit" size={10} style={{ opacity: 0.3, marginLeft: 6 }} />
                                </div>
                                <button style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", lineHeight: 1 }}
                                  onClick={() => removeMemberFromRaid(m.memberId, ri)} title="Remove">
                                  <Icon name="x" size={12} />
                                </button>
                              </div>
                            ))}
                            {dps.length === 0 && <div className="text-xs text-muted" style={{ fontStyle: "italic" }}>No DPS in raid</div>}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", marginBottom: 10, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8 }}>
                            🛡️ SUPPORT ({sup.length})
                            <div style={{ flex: 1, height: 1, background: "rgba(99,130,230,0.2)" }} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {sup.map(m => (
                              <div key={m.memberId}
                                draggable
                                onDragStart={() => onDragStart(m.memberId, raidKey)}
                                onDragEnd={onDragEnd}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "space-between",
                                  padding: "6px 10px", background: "var(--bg-card2)",
                                  border: m.isOverridden ? "1px solid var(--gold)" : "1px solid var(--border)", borderRadius: 8,
                                  cursor: "grab", userSelect: "none",
                                  opacity: dragging?.memberId === m.memberId ? 0.35 : 1,
                                }}
                                onDoubleClick={() => setEditingMember(m)}>
                                <div style={{ cursor: "pointer", flex: 1 }} onClick={(e) => { e.stopPropagation(); setEditingMember(m); }} className="hover-highlight">
                                  <span style={{ fontWeight: 700, fontSize: 13 }}>{m.ign}</span>
                                  <span style={{ fontSize: 10, color: m.isOverridden ? "var(--gold)" : "var(--text-muted)", marginLeft: 8 }}>{m.class}{m.isOverridden ? " *" : ""}</span>
                                  <Icon name="edit" size={10} style={{ opacity: 0.3, marginLeft: 6 }} />
                                </div>
                                <button style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", lineHeight: 1 }}
                                  onClick={() => removeMemberFromRaid(m.memberId, ri)} title="Remove">
                                  <Icon name="x" size={12} />
                                </button>
                              </div>
                            ))}
                            {sup.length === 0 && <div className="text-xs text-muted" style={{ fontStyle: "italic" }}>No Supports in raid</div>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </>
      )}

      {/* ── LEAGUE MODE ── */}
      {builderType === "league" && (
        <>
          {/* League Search & Bench */}
          <div className="card" style={{ marginBottom: 24, border: "1px solid var(--border-bright)" }}>
            <div className="flex items-center justify-between mb-4" style={{ gap: 20 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>🔍 Quick Find Member</div>
              <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Search IGN or Class..." 
                  value={leagueSearch}
                  onChange={e => setLeagueSearch(e.target.value)}
                  style={{ paddingLeft: 36, borderRadius: 12, background: "var(--bg-deepest)" }}
                />
                <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>
                  <Icon name="search" size={16} />
                </div>
                {leagueSearch && (
                  <button 
                    onClick={() => setLeagueSearch("")}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                  >
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            </div>

            {renderBench(filteredLeagueBench, leagueBenchDPS, leagueBenchSUP, true)}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            
            {/* Main Field Partition */}
            <div style={{ background: "rgba(240,192,64,0.03)", borderRadius: 24, border: "1px solid rgba(240,192,64,0.15)", padding: "32px 24px" }}>
              <div style={{ textAlign: "center", marginBottom: 30 }}>
                <h2 style={{ margin: 0, fontFamily: "Cinzel, serif", fontSize: 28, color: "var(--gold)", letterSpacing: 3, fontWeight: 900 }}>MAIN ELITE TEAMS</h2>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, letterSpacing: 1 }}>
                  {(leagueParties.main || []).reduce((s, p) => s + p.length, 0)} / 40 MEMBERS ASSIGNED
                </div>
              </div>

              <div className="league-grid">
                {(leagueParties.main || []).map((party, i) => {
                  const dropKey = `league:main:${i}`;
                  const name = (leaguePartyNames.main && leaguePartyNames.main[i]) || LEAGUE_MAIN_NAMES[i];
                  return (
                    <div key={i} className="party-card"
                      style={{ ...dropTargetStyle(dropKey), border: "1px solid rgba(240,192,64,0.2)" }}
                      onDragOver={e => { e.preventDefault(); setDragOver(dropKey); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => onDrop(dropKey)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        {editingName === dropKey ? (
                          <input className="form-input" style={{ fontSize: 12, padding: "2px 6px" }}
                            value={nameInput} autoFocus
                            onChange={e => setNameInput(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={e => e.key === "Enter" && commitRename()} />
                        ) : (
                          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--gold)", cursor: "pointer" }} onClick={() => {
                            setEditingName(dropKey);
                            setNameInput(name);
                          }}>
                            {name} <span style={{ fontSize: 10, opacity: 0.5 }}>✎</span>
                          </div>
                        )}
                        <span style={{ fontSize: 11, opacity: 0.7 }}>{party.length}/5</span>
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {party.map(m => (
                          <div className="party-member" key={m.memberId}
                            draggable
                            onDragStart={() => onDragStart(m.memberId, dropKey)}
                            onDragEnd={onDragEnd}
                            style={{ cursor: "grab", opacity: dragging?.memberId === m.memberId ? 0.35 : 1 }}>
                            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setEditingMember(m); }} className="hover-highlight">
                              <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                                {m.ign}
                                <Icon name="edit" size={10} style={{ opacity: 0.3 }} />
                              </div>
                              <div style={{ fontSize: 11, color: m.isOverridden ? "var(--gold)" : "var(--text-muted)" }}>{m.class}{m.isOverridden ? " *" : ""}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 9 }}>
                                {m.role === "DPS" ? "DPS" : "SUP"}
                              </span>
                              <button style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", lineHeight: 1, marginLeft: 2 }}
                                onClick={() => removeMemberFromLeague(m.memberId, "main", i)} title="Remove">
                                <Icon name="x" size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {party.length === 0 && <div style={{ fontSize: 10, textAlign: "center", padding: "12px 0", opacity: 0.4, border: "1px dashed var(--border)", borderRadius: 6 }}>Empty Slot</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sub Field Partition */}
            <div style={{ background: "rgba(99,130,230,0.03)", borderRadius: 24, border: "1px solid rgba(99,130,230,0.15)", padding: "32px 24px" }}>
              <div style={{ textAlign: "center", marginBottom: 30 }}>
                <h2 style={{ margin: 0, fontFamily: "Cinzel, serif", fontSize: 28, color: "var(--accent)", letterSpacing: 3, fontWeight: 900 }}>SUB TEAMS</h2>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, letterSpacing: 1 }}>
                  {(leagueParties.sub || []).reduce((s, p) => s + p.length, 0)} / 40 MEMBERS ASSIGNED
                </div>
              </div>

              <div className="league-grid">
                {(leagueParties.sub || []).map((party, i) => {
                  const dropKey = `league:sub:${i}`;
                  const name = (leaguePartyNames.sub && leaguePartyNames.sub[i]) || LEAGUE_SUB_NAMES[i];
                  return (
                    <div key={i} className="party-card"
                      style={{ ...dropTargetStyle(dropKey), border: "1px solid rgba(99,130,230,0.2)" }}
                      onDragOver={e => { e.preventDefault(); setDragOver(dropKey); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => onDrop(dropKey)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        {editingName === dropKey ? (
                          <input className="form-input" style={{ fontSize: 12, padding: "2px 6px" }}
                            value={nameInput} autoFocus
                            onChange={e => setNameInput(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={e => e.key === "Enter" && commitRename()} />
                        ) : (
                          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent)", cursor: "pointer" }} onClick={() => {
                            setEditingName(dropKey);
                            setNameInput(name);
                          }}>
                            {name} <span style={{ fontSize: 10, opacity: 0.5 }}>✎</span>
                          </div>
                        )}
                        <span style={{ fontSize: 11, opacity: 0.7 }}>{party.length}/5</span>
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {party.map(m => (
                          <div className="party-member" key={m.memberId}
                            draggable
                            onDragStart={() => onDragStart(m.memberId, dropKey)}
                            onDragEnd={onDragEnd}
                            style={{ cursor: "grab", opacity: dragging?.memberId === m.memberId ? 0.35 : 1 }}>
                            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setEditingMember(m); }} className="hover-highlight">
                              <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                                {m.ign}
                                <Icon name="edit" size={10} style={{ opacity: 0.3 }} />
                              </div>
                              <div style={{ fontSize: 11, color: m.isOverridden ? "var(--gold)" : "var(--text-muted)" }}>{m.class}{m.isOverridden ? " *" : ""}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`} style={{ fontSize: 9 }}>
                                {m.role === "DPS" ? "DPS" : "SUP"}
                              </span>
                              <button style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", lineHeight: 1, marginLeft: 2 }}
                                onClick={() => removeMemberFromLeague(m.memberId, "sub", i)} title="Remove">
                                <Icon name="x" size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {party.length === 0 && <div style={{ fontSize: 10, textAlign: "center", padding: "12px 0", opacity: 0.4, border: "1px dashed var(--border)", borderRadius: 6 }}>Empty Slot</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
      {/* ── EDIT MEMBER MODAL ── */}
      {editingMember && (
        <div className="modal-overlay" onClick={() => setEditingMember(null)} style={{ zIndex: 1000 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 300, border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ margin: 0, fontFamily: "Cinzel, serif" }}>Edit Class</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditingMember(null)}><Icon name="x" size={14} /></button>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>{editingMember.ign}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{editingMember.isOverridden ? "Currently Overridden" : "Original Profile"}</div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Class Override</label>
              <input 
                type="text" 
                className="form-input" 
                id="editClassInput" 
                defaultValue={editingMember.class} 
                autoFocus
                onKeyDown={e => e.key === "Enter" && document.getElementById("saveOverrideBtn").click()}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Role Override</label>
              <select className="form-select" id="editRoleInput" defaultValue={editingMember.role}>
                <option value="DPS">DPS</option>
                <option value="Support">Support/Utility</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <button id="saveOverrideBtn" className="btn btn-primary w-full" onClick={() => {
                const cls = document.getElementById("editClassInput").value.trim();
                const rl = document.getElementById("editRoleInput").value;
                if (!cls) return showToast("Class cannot be empty", "error");
                
                setPartyOverrides(prev => ({
                  ...prev,
                  [editingMember.memberId]: { class: cls, role: rl }
                }));
                setEditingMember(null);
                showToast(`Override applied for ${editingMember.ign}`);
              }}>Apply Override</button>
              
              {editingMember.isOverridden && (
                <button className="btn btn-ghost w-full" style={{ color: "#e74c3c" }} onClick={() => {
                  setPartyOverrides(prev => {
                    const next = { ...prev };
                    delete next[editingMember.memberId];
                    return next;
                  });
                  setEditingMember(null);
                  showToast(`Override cleared for ${editingMember.ign}`);
                }}>Reset to Original</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PartyBuilder;
