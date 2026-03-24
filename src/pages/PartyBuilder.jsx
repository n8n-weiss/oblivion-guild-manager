import React, { useState, useMemo } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';

const PARTY_NAMES = ["Alpha Squad", "Bravo Force", "Charlie Wing", "Delta Strike", "Echo Vanguard", "Foxtrot Blade"];

function PartyBuilder() {
  const { members, events, attendance, parties, setParties } = useGuild();
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
        <h1 className="page-title">â­ Party Builder</h1>
        <p className="page-subtitle">Auto-balance or manually arrange teams â€” state persists across tabs</p>
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
                      {ev.eventDate} â€” {ev.eventType === "Guild League" ? "GL" : "EO"} ({count} present)
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
              {poolMembers.length} members Â· {poolMembers.filter(m=>m.role==="DPS").length} DPS Â· {poolMembers.filter(m=>m.role!=="DPS").length} Support
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
            <div className="card-title" style={{marginBottom:0}}>ðŸª‘ Bench ({bench.length} unassigned)</div>
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
                      {mode==="manual" && <span className="text-xs text-muted" style={{marginLeft:6,fontFamily:"Rajdhani,sans-serif",fontWeight:400}}>âœŽ</span>}
                    </div>
                  )}
                  {mode==="manual" && parties.length > 1 && (
                    <button className="btn btn-danger btn-sm btn-icon" style={{padding:"3px 6px"}} onClick={() => removeParty(i)}><Icon name="x" size={11}/></button>
                  )}
                </div>

                <div className="flex gap-2 mb-3">
                  <span className="text-xs" style={{color:"var(--accent2)"}}>{dpsC} DPS</span>
                  <span className="text-xs text-muted">Â·</span>
                  <span className="text-xs" style={{color:"var(--accent)"}}>{supC} Support</span>
                  <span className="text-xs text-muted">Â· {party.length}/5</span>
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
            <div className="empty-state-icon">â­</div>
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

export default PartyBuilder;
