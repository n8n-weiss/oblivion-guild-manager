import React, { useState } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';

function AuctionBuilder() {
  const { 
    members, auctionSessions, setAuctionSessions, 
    auctionTemplates, setAuctionTemplates, showToast 
  } = useGuild();
  const [view, setView] = useState("sessions"); // "sessions" | "editor"
  const [activeSession, setActiveSession] = useState(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newSessionForm, setNewSessionForm] = useState({ name: "", date: new Date().toISOString().split("T")[0], templateId: "" });
  const [newTemplateName, setNewTemplateName] = useState("");
  const [editingCell, setEditingCell] = useState(null); // { memberId, colId }
  const [cellInput, setCellInput] = useState("");
  const [editingColId, setEditingColId] = useState(null);
  const [colNameInput, setColNameInput] = useState("");
  const [dragging, setDragging] = useState(null); // memberId
  const [dragOver, setDragOver] = useState(null); // "table" | "pool"

  // Get active session data
  const session = auctionSessions.find(s => s.id === activeSession);

  // Pool = members not in session
  const sessionMemberIds = new Set((session?.members || []).map(m => m.memberId));
  const pool = members.filter(m => !sessionMemberIds.has(m.memberId));
  const sessionMembers = (session?.members || []).map(sm => members.find(m => m.memberId === sm.memberId)).filter(Boolean);

  const createSession = () => {
    if (!newSessionForm.name.trim()) { showToast("Enter session name", "error"); return; }
    const template = auctionTemplates.find(t => t.id === newSessionForm.templateId);
    const columns = template ? template.columns : [
      { id: `col_${Date.now()}_1`, name: "Resource 1" },
      { id: `col_${Date.now()}_2`, name: "Resource 2" },
    ];
    const newSession = {
      id: `AUC_${Date.now()}`,
      name: newSessionForm.name,
      date: newSessionForm.date,
      columns,
      members: [],
      cells: {}, // { memberId_colId: ["Pg1","Rw2"] }
    };
    setAuctionSessions(prev => [...prev, newSession]);
    setActiveSession(newSession.id);
    setView("editor");
    setShowNewSession(false);
    setNewSessionForm({ name: "", date: new Date().toISOString().split("T")[0], templateId: "" });
    showToast("Session created!", "success");
  };

  const deleteSession = (id) => {
    setAuctionSessions(prev => prev.filter(s => s.id !== id));
    if (activeSession === id) { setActiveSession(null); setView("sessions"); }
    showToast("Session deleted", "success");
  };

  const updateSession = (updater) => {
    setAuctionSessions(prev => prev.map(s => s.id === activeSession ? updater(s) : s));
  };

  const addColumn = () => {
    updateSession(s => ({ ...s, columns: [...s.columns, { id: `col_${Date.now()}`, name: "New Resource" }] }));
  };

  const renameColumn = (colId) => {
    if (!colNameInput.trim()) return;
    updateSession(s => ({ ...s, columns: s.columns.map(c => c.id === colId ? { ...c, name: colNameInput } : c) }));
    setEditingColId(null);
  };

  const deleteColumn = (colId) => {
    updateSession(s => {
      const cells = { ...s.cells };
      Object.keys(cells).forEach(k => { if (k.endsWith(`_${colId}`)) delete cells[k]; });
      return { ...s, columns: s.columns.filter(c => c.id !== colId), cells };
    });
  };

  const getCellKey = (memberId, colId) => `${memberId}_${colId}`;
  const getCellTags = (memberId, colId) => session?.cells?.[getCellKey(memberId, colId)] || [];

  const addTag = (memberId, colId, tag) => {
    if (!tag.trim()) return;
    const key = getCellKey(memberId, colId);
    updateSession(s => ({
      ...s,
      cells: { ...s.cells, [key]: [...(s.cells[key] || []), tag.trim()] }
    }));
  };

  const removeTag = (memberId, colId, tagIdx) => {
    const key = getCellKey(memberId, colId);
    updateSession(s => ({
      ...s,
      cells: { ...s.cells, [key]: (s.cells[key] || []).filter((_, i) => i !== tagIdx) }
    }));
  };

  // Drag handlers
  const onDragStart = (memberId) => setDragging(memberId);
  const onDragEnd = () => { setDragging(null); setDragOver(null); };

  const dropToTable = () => {
    if (!dragging) return;
    const member = members.find(m => m.memberId === dragging);
    if (!member || sessionMemberIds.has(dragging)) return;
    updateSession(s => ({ ...s, members: [...s.members, { memberId: dragging }] }));
    setDragging(null); setDragOver(null);
  };

  const dropToPool = () => {
    if (!dragging) return;
    if (!sessionMemberIds.has(dragging)) return;
    updateSession(s => {
      const cells = { ...s.cells };
      Object.keys(cells).forEach(k => { if (k.startsWith(`${dragging}_`)) delete cells[k]; });
      return { ...s, members: s.members.filter(m => m.memberId !== dragging), cells };
    });
    setDragging(null); setDragOver(null);
  };

  const saveAsTemplate = () => {
    if (!session) return;
    if (!newTemplateName.trim()) { showToast("Enter template name", "error"); return; }
    const template = { id: `TPL_${Date.now()}`, name: newTemplateName, columns: session.columns };
    setAuctionTemplates(prev => [...prev, template]);
    setNewTemplateName("");
    setShowNewTemplate(false);
    showToast("Template saved!", "success");
  };

  const tagColor = (tag) => {
    const t = tag.toLowerCase();
    if (t.includes("upto")) return { bg: "rgba(240,192,64,0.15)", color: "var(--gold)", border: "rgba(240,192,64,0.3)" };
    if (t.includes("rw")) return { bg: "rgba(224,92,138,0.15)", color: "var(--accent2)", border: "rgba(224,92,138,0.3)" };
    return { bg: "rgba(64,201,122,0.15)", color: "var(--green)", border: "rgba(64,201,122,0.3)" };
  };

  const AVATAR_COLORS_LOCAL = [
    {bg:"rgba(99,130,230,0.18)",color:"var(--accent)"},
    {bg:"rgba(224,92,138,0.18)",color:"var(--accent2)"},
    {bg:"rgba(64,201,122,0.18)",color:"var(--green)"},
    {bg:"rgba(240,192,64,0.18)",color:"var(--gold)"},
    {bg:"rgba(167,139,250,0.18)",color:"#a78bfa"},
    {bg:"rgba(56,189,248,0.18)",color:"#38bdf8"},
    {bg:"rgba(251,146,60,0.18)",color:"#fb923c"},
    {bg:"rgba(244,114,182,0.18)",color:"#f472b6"},
    {bg:"rgba(52,211,153,0.18)",color:"#34d399"},
    {bg:"rgba(251,191,36,0.18)",color:"#fbbf24"},
  ];

  const miniAvatar = (m, idx) => {
    const c = AVATAR_COLORS_LOCAL[idx % AVATAR_COLORS_LOCAL.length];
    return (
      <div style={{width:28,height:28,borderRadius:6,background:c.bg,color:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Cinzel,serif",fontSize:11,fontWeight:700,flexShrink:0}}>
        {m.ign.slice(0,2).toUpperCase()}
      </div>
    );
  };

  // â”€â”€ SESSIONS LIST VIEW
  if (view === "sessions") return (
    <div>
      <div className="page-header">
        <h1 className="page-title">ðŸ› Auction Builder</h1>
        <p className="page-subtitle">Distribute resources per member per session</p>
      </div>

      <div className="grid-2" style={{marginBottom:20}}>
        {/* Sessions */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="card-title" style={{marginBottom:0}}>Sessions</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNewSession(true)}><Icon name="plus" size={12}/> New Session</button>
          </div>

          {showNewSession && (
            <div style={{background:"rgba(99,130,230,0.05)",border:"1px solid var(--border)",borderRadius:10,padding:14,marginBottom:14}}>
              <div className="form-grid form-grid-2" style={{marginBottom:10}}>
                <div className="form-group">
                  <label className="form-label">Session Name</label>
                  <input className="form-input" placeholder="e.g. TSA GL Week 1" value={newSessionForm.name} onChange={e => setNewSessionForm(f=>({...f,name:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={newSessionForm.date} onChange={e => setNewSessionForm(f=>({...f,date:e.target.value}))} />
                </div>
              </div>
              <div className="form-group" style={{marginBottom:10}}>
                <label className="form-label">Template (optional)</label>
                <select className="form-select" value={newSessionForm.templateId} onChange={e => setNewSessionForm(f=>({...f,templateId:e.target.value}))}>
                  <option value="">No template (start fresh)</option>
                  {auctionTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewSession(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={createSession}><Icon name="plus" size={12}/> Create</button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {auctionSessions.length === 0 && <div className="empty-state"><div className="empty-state-icon">ðŸ›</div><div className="empty-state-text">No sessions yet â€” create one!</div></div>}
            {auctionSessions.slice().reverse().map(s => (
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"var(--bg-card2)",border:"1px solid var(--border)",borderRadius:10,cursor:"pointer"}}
                onClick={() => { setActiveSession(s.id); setView("editor"); }}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>{s.name}</div>
                  <div className="text-xs text-muted">{s.date} Â· {s.members.length} members Â· {s.columns.length} resources</div>
                </div>
                <button className="btn btn-danger btn-sm btn-icon" onClick={e => { e.stopPropagation(); deleteSession(s.id); }}><Icon name="trash" size={12}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* Templates */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="card-title" style={{marginBottom:0}}>Templates</div>
          </div>
          <div className="flex flex-col gap-2">
            {auctionTemplates.length === 0 && <div className="empty-state"><div className="empty-state-icon">ðŸ“‹</div><div className="empty-state-text">No templates yet â€” save one from a session!</div></div>}
            {auctionTemplates.map(t => (
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"var(--bg-card2)",border:"1px solid var(--border)",borderRadius:10}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>{t.name}</div>
                  <div className="text-xs text-muted">{t.columns.map(c=>c.name).join(" Â· ")}</div>
                </div>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => { setAuctionTemplates(prev => prev.filter(x=>x.id!==t.id)); showToast("Template deleted","success"); }}><Icon name="trash" size={12}/></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // â”€â”€ EDITOR VIEW
  if (!session) return null;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{flexWrap:"wrap",gap:12}}>
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost" onClick={() => { setView("sessions"); setEditingCell(null); }}><Icon name="x" size={14}/> Back</button>
            <div>
              <h1 className="page-title">ðŸ› {session.name}</h1>
              <p className="page-subtitle">{session.date} Â· {sessionMembers.length} members Â· {session.columns.length} resources</p>
            </div>
          </div>
          <div className="flex gap-2" style={{flexWrap:"wrap"}}>
            {showNewTemplate ? (
              <div className="flex gap-2 items-center">
                <input className="form-input" style={{width:180,padding:"6px 12px",fontSize:13}} placeholder="Template name..." value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} />
                <button className="btn btn-primary btn-sm" onClick={saveAsTemplate}><Icon name="save" size={12}/> Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewTemplate(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-ghost" onClick={() => setShowNewTemplate(true)}><Icon name="save" size={14}/> Save as Template</button>
            )}
            <button className="btn btn-primary" onClick={addColumn}><Icon name="plus" size={14}/> Add Column</button>
          </div>
        </div>
      </div>

      <div className="flex gap-4" style={{alignItems:"flex-start",flexWrap:"wrap"}}>

        {/* Member Pool */}
        <div style={{width:200,flexShrink:0}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"var(--text-muted)",fontWeight:700,marginBottom:10}}>Member Pool</div>
          <div style={{
            minHeight:120, borderRadius:10, border:`2px dashed ${dragOver==="pool"?"var(--accent)":"var(--border)"}`,
            background: dragOver==="pool"?"rgba(99,130,230,0.08)":"var(--bg-card)",
            padding:10, transition:"all 0.15s",
          }}
            onDragOver={e => { e.preventDefault(); setDragOver("pool"); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={dropToPool}
          >
            {pool.length === 0 && <div className="text-xs text-muted" style={{textAlign:"center",padding:"16px 0"}}>All members added</div>}
            {pool.map((m, i) => (
              <div key={m.memberId}
                draggable
                onDragStart={() => onDragStart(m.memberId)}
                onDragEnd={onDragEnd}
                style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:8,cursor:"grab",
                  background:"var(--bg-card2)",border:"1px solid var(--border)",marginBottom:6,
                  opacity:dragging===m.memberId?0.4:1,userSelect:"none",transition:"opacity 0.15s"}}>
                {miniAvatar(m, members.indexOf(m))}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.ign}</div>
                  <div style={{fontSize:10,color:"var(--text-muted)"}}>{m.role}</div>
                </div>
              </div>
            ))}
            {dragOver==="pool" && <div className="text-xs text-muted" style={{textAlign:"center",padding:"8px 0"}}>Drop to remove</div>}
          </div>
        </div>

        {/* Table */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{
            minHeight:80, borderRadius:10,
            border:`2px dashed ${dragOver==="table"?"var(--accent)":"transparent"}`,
            background: dragOver==="table"?"rgba(99,130,230,0.04)":"transparent",
            transition:"all 0.15s", marginBottom:4,
          }}
            onDragOver={e => { e.preventDefault(); setDragOver("table"); }}
            onDragLeave={() => { if(dragOver==="table") setDragOver(null); }}
            onDrop={dropToTable}
          >
            {sessionMembers.length === 0 ? (
              <div style={{textAlign:"center",padding:"24px 0",color:"var(--text-muted)",fontSize:13,border:"2px dashed var(--border)",borderRadius:10}}>
                â† Drag members from the pool to add them
              </div>
            ) : (
              <div style={{overflowX:"auto",borderRadius:10,border:"1px solid var(--border)"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{background:"rgba(99,130,230,0.06)",borderBottom:"1px solid var(--border)"}}>
                      <th style={{padding:"11px 16px",textAlign:"left",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1.5,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",whiteSpace:"nowrap",minWidth:160}}>Member</th>
                      {session.columns.map(col => (
                        <th key={col.id} style={{padding:"11px 16px",textAlign:"left",borderLeft:"1px solid var(--border)",minWidth:160}}>
                          {editingColId === col.id ? (
                            <input className="form-input" style={{padding:"3px 8px",fontSize:12,width:"100%"}} autoFocus
                              value={colNameInput}
                              onChange={e => setColNameInput(e.target.value)}
                              onBlur={() => renameColumn(col.id)}
                              onKeyDown={e => { if(e.key==="Enter") renameColumn(col.id); if(e.key==="Escape") setEditingColId(null); }} />
                          ) : (
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
                              <span style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1.5,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase"}}>{col.name}</span>
                              <div style={{display:"flex",gap:4,opacity:0.7}}>
                                <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:12,padding:"0 2px"}}
                                  onClick={() => { setEditingColId(col.id); setColNameInput(col.name); }}>âœŽ</button>
                                <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:13,padding:"0 2px"}}
                                  onClick={() => deleteColumn(col.id)}>Ã—</button>
                              </div>
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessionMembers.map((m, rowIdx) => (
                      <tr key={m.memberId}
                        draggable
                        onDragStart={() => onDragStart(m.memberId)}
                        onDragEnd={onDragEnd}
                        style={{borderBottom:"1px solid var(--border)",background:rowIdx%2===1?"rgba(99,130,230,0.02)":"transparent",
                          opacity:dragging===m.memberId?0.35:1,transition:"opacity 0.15s"}}>
                        <td style={{padding:"10px 16px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,cursor:"grab"}}>
                            {miniAvatar(m, members.indexOf(m))}
                            <div>
                              <div style={{fontWeight:700,fontSize:13}}>{m.ign}</div>
                              <div style={{fontSize:10,color:"var(--text-muted)"}}>{m.class}</div>
                            </div>
                          </div>
                        </td>
                        {session.columns.map(col => {
                          const tags = getCellTags(m.memberId, col.id);
                          const isEditing = editingCell?.memberId===m.memberId && editingCell?.colId===col.id;
                          return (
                            <td key={col.id} style={{padding:"10px 16px",borderLeft:"1px solid var(--border)",verticalAlign:"top"}}
                              onClick={() => { if(!isEditing) { setEditingCell({memberId:m.memberId,colId:col.id}); setCellInput(""); } }}>
                              <div style={{display:"flex",flexWrap:"wrap",gap:4,cursor:"pointer",minHeight:28,alignItems:"flex-start"}}>
                                {tags.map((tag,ti) => {
                                  const tc = tagColor(tag);
                                  return (
                                    <span key={ti} style={{background:tc.bg,color:tc.color,border:`1px solid ${tc.border}`,
                                      fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,
                                      display:"inline-flex",alignItems:"center",gap:4}}>
                                      {tag}
                                      <span style={{cursor:"pointer",opacity:0.7,fontSize:12,lineHeight:1}}
                                        onClick={e => { e.stopPropagation(); removeTag(m.memberId,col.id,ti); }}>Ã—</span>
                                    </span>
                                  );
                                })}
                                {isEditing ? (
                                  <input autoFocus className="form-input"
                                    style={{width:80,padding:"2px 8px",fontSize:12,display:"inline-block"}}
                                    placeholder="Pg1..."
                                    value={cellInput}
                                    onChange={e => setCellInput(e.target.value)}
                                    onKeyDown={e => {
                                      if(e.key==="Enter" && cellInput.trim()) { addTag(m.memberId,col.id,cellInput); setCellInput(""); }
                                      if(e.key==="Escape") setEditingCell(null);
                                    }}
                                    onBlur={() => { if(cellInput.trim()) addTag(m.memberId,col.id,cellInput); setEditingCell(null); setCellInput(""); }}
                                  />
                                ) : (
                                  tags.length===0 && <span style={{fontSize:11,color:"var(--text-muted)",opacity:0.5}}>Click to add...</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {dragOver==="table" && sessionMembers.length > 0 && (
            <div style={{textAlign:"center",fontSize:12,color:"var(--accent)",marginTop:4}}>Drop here to add member</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuctionBuilder;
