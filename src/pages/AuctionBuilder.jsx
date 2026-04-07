import React, { useState } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';

function AuctionBuilder() {
  const {
    members, auctionSessions, setAuctionSessions,
    auctionTemplates, setAuctionTemplates, showToast,
    attendance, events
  } = useGuild();
  const [view, setView] = useState("sessions"); // "sessions" | "editor" | "history"
  const [activeSession, setActiveSession] = useState(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showHistoryGuide, setShowHistoryGuide] = useState(true);
  const activeMembers = React.useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);
  const [newSessionForm, setNewSessionForm] = useState({ name: "", date: new Date().toISOString().split("T")[0], templateId: "" });
  const [newTemplateName, setNewTemplateName] = useState("");
  const [editingCell, setEditingCell] = useState(null); // { memberId, colId }
  const [cellInput, setCellInput] = useState("");
  const [editingColId, setEditingColId] = useState(null);
  const [colNameInput, setColNameInput] = useState("");
  const [dragging, setDragging] = useState(null); // memberId
  const [dragOver, setDragOver] = useState(null); // "table" | "pool"
  const [poolSearch, setPoolSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all"); // "all" | "wins" | "outbids"

  // Aggregate ALL loot history
  const lootHistory = React.useMemo(() => {
    const history = [];
    auctionSessions.forEach(s => {
      if (!s.cells) return;
      Object.entries(s.cells).forEach(([key, tags]) => {
        if (!tags || tags.length === 0) return;
        
        // Robust parsing: Find which column ID matches the END of the key
        const col = s.columns?.find(c => key.endsWith(`_${c.id}`));
        if (!col) return;
        
        const mIdFromKey = key.substring(0, key.length - col.id.length - 1).trim().toLowerCase();
        const member = members.find(m => (m.memberId || "").trim().toLowerCase() === mIdFromKey);
        if (!member) return;
        
        tags.forEach(tag => {
          history.push({
            id: `${s.id}_${key}_${tag}`,
            sessionId: s.id,
            sessionName: s.name,
            date: s.date,
            memberId: member.memberId,
            ign: member.ign,
            colId: col.id,
            colName: col.name,
            tag: tag,
            isOutbid: tag.startsWith("!")
          });
        });
      });
    });
    return history.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [auctionSessions, members]);

  // Get active session data
  const session = auctionSessions.find(s => s.id === activeSession);

  // Pool = active members not in session
  const sessionMemberIds = new Set((session?.members || []).map(m => m.memberId));
  const pool = activeMembers
    .filter(m => !sessionMemberIds.has(m.memberId))
    .filter(m => !poolSearch || m.ign.toLowerCase().includes(poolSearch.toLowerCase()) || m.class.toLowerCase().includes(poolSearch.toLowerCase()));
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

  const toggleOutbid = (memberId, colId, tagIdx) => {
    const key = getCellKey(memberId, colId);
    updateSession(s => {
      const tags = [...(s.cells[key] || [])];
      if (tags[tagIdx]) {
        if (tags[tagIdx].startsWith("!")) {
          tags[tagIdx] = tags[tagIdx].substring(1);
        } else {
          tags[tagIdx] = "!" + tags[tagIdx];
        }
      }
      return { ...s, cells: { ...s.cells, [key]: tags } };
    });
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
    const isOutbid = tag.startsWith("!");
    const t = (isOutbid ? tag.substring(1) : tag).toLowerCase();
    
    if (isOutbid) return { 
      bg: "rgba(224,80,80,0.05)", 
      color: "rgba(255,255,255,0.4)", 
      border: "rgba(224,80,80,0.2)",
      textDecoration: "line-through",
      opacity: 0.6
    };

    if (t.includes("upto")) return { bg: "rgba(240,192,64,0.15)", color: "var(--gold)", border: "rgba(240,192,64,0.3)" };
    if (t.includes("rw")) return { bg: "rgba(224,92,138,0.15)", color: "var(--accent2)", border: "rgba(224,92,138,0.3)" };
    return { bg: "rgba(64,201,122,0.15)", color: "var(--green)", border: "rgba(64,201,122,0.3)" };
  };

  const AVATAR_COLORS_LOCAL = [
    { bg: "rgba(99,130,230,0.18)", color: "var(--accent)" },
    { bg: "rgba(224,92,138,0.18)", color: "var(--accent2)" },
    { bg: "rgba(64,201,122,0.18)", color: "var(--green)" },
    { bg: "rgba(240,192,64,0.18)", color: "var(--gold)" },
    { bg: "rgba(167,139,250,0.18)", color: "#a78bfa" },
    { bg: "rgba(56,189,248,0.18)", color: "#38bdf8" },
    { bg: "rgba(251,146,60,0.18)", color: "#fb923c" },
    { bg: "rgba(244,114,182,0.18)", color: "#f472b6" },
    { bg: "rgba(52,211,153,0.18)", color: "#34d399" },
    { bg: "rgba(251,191,36,0.18)", color: "#fbbf24" },
  ];

  const miniAvatar = (m, idx) => {
    const c = AVATAR_COLORS_LOCAL[idx % AVATAR_COLORS_LOCAL.length];
    return (
      <div style={{ width: 28, height: 28, borderRadius: 6, background: c.bg, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Cinzel,serif", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
        {m.ign.slice(0, 2).toUpperCase()}
      </div>
    );
  };

  // ── SESSIONS LIST VIEW
  if (view === "sessions") return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📜 Auction Builder</h1>
        <p className="page-subtitle">Distribute resources per member per session</p>
      </div>

      <div className="flex gap-2 mb-6" style={{ background: "rgba(0,0,0,0.2)", padding: 4, borderRadius: 10, width: "fit-content" }}>
        <button className={`btn btn-sm ${view === "sessions" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("sessions")}>Sessions</button>
        <button className={`btn btn-sm ${view === "history" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("history")}>Loot History</button>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Sessions */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="card-title" style={{ marginBottom: 0 }}>Sessions</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNewSession(true)}><Icon name="plus" size={12} /> New Session</button>
          </div>

          {showNewSession && (
            <div style={{ background: "rgba(99,130,230,0.05)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div className="form-grid form-grid-2" style={{ marginBottom: 10 }}>
                <div className="form-group">
                  <label className="form-label">Session Name</label>
                  <input className="form-input" placeholder="e.g. TSA GL Week 1" value={newSessionForm.name} onChange={e => setNewSessionForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={newSessionForm.date} onChange={e => setNewSessionForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Template (optional)</label>
                <select className="form-select" value={newSessionForm.templateId} onChange={e => setNewSessionForm(f => ({ ...f, templateId: e.target.value }))}>
                  <option value="">No template (start fresh)</option>
                  {auctionTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewSession(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={createSession}><Icon name="plus" size={12} /> Create</button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {auctionSessions.length === 0 && <div className="empty-state"><div className="empty-state-icon">📜</div><div className="empty-state-text">No sessions yet — create one!</div></div>}
            {auctionSessions.slice().reverse().map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-card2)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer" }}
                onClick={() => { setActiveSession(s.id); setView("editor"); }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                  <div className="text-xs text-muted">{s.date} · {s.members.length} members · {s.columns.length} resources</div>
                </div>
                <button className="btn btn-danger btn-sm btn-icon" onClick={e => { e.stopPropagation(); deleteSession(s.id); }}><Icon name="trash" size={12} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Templates */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="card-title" style={{ marginBottom: 0 }}>Templates</div>
          </div>
          <div className="flex flex-col gap-2">
            {auctionTemplates.length === 0 && <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-text">No templates yet — save one from a session!</div></div>}
            {auctionTemplates.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-card2)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                  <div className="text-xs text-muted">{t.columns.map(c => c.name).join(" · ")}</div>
                </div>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => { setAuctionTemplates(prev => prev.filter(x => x.id !== t.id)); showToast("Template deleted", "success"); }}><Icon name="trash" size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── HISTORY VIEW
  if (view === "history") {
    const filtered = lootHistory.filter(h => {
      const matchSearch = h.ign.toLowerCase().includes(historySearch.toLowerCase()) || h.sessionName.toLowerCase().includes(historySearch.toLowerCase());
      const matchFilter = historyFilter === "all" || (historyFilter === "wins" && !h.isOutbid) || (historyFilter === "outbids" && h.isOutbid);
      return matchSearch && matchFilter;
    });

    return (
      <div>
        <div className="page-header">
          <button className="btn btn-ghost mb-3" onClick={() => setView("sessions")}><Icon name="arrow-left" size={14} /> Back to Sessions</button>
          <h1 className="page-title">📊 Loot History Summary</h1>
          <p className="page-subtitle">Comprehensive record of all resource distribution</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between gap-4 mb-4" style={{ flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search member or session..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
              <div style={{ position: "absolute", left: 12, top: 10, opacity: 0.5 }}><Icon name="search" size={14} /></div>
            </div>
            <div className="flex gap-2">
              {["all", "wins", "outbids"].map(f => (
                <button key={f} className={`btn btn-sm ${historyFilter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setHistoryFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Date</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Session</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Member</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Resource</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Tag</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No matching history found</td></tr>}
                {filtered.map(h => {
                  const tc = tagColor(h.tag);
                  return (
                    <tr key={h.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="text-secondary" style={{ padding: "12px 16px", fontSize: 13 }}>{h.date}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{h.sessionName}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div className="flex items-center gap-2">
                          <MemberAvatar ign={h.ign} size={24} />
                          <span style={{ fontWeight: 700 }}>{h.ign}</span>
                        </div>
                      </td>
                      <td className="text-secondary" style={{ padding: "12px 16px" }}>{h.colName}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20, opacity: h.isOutbid ? 0.7 : 1 }}>
                          {h.isOutbid ? h.tag.substring(1) : h.tag}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className={`badge ${h.isOutbid ? "badge-loa" : "badge-active"}`}>
                          {h.isOutbid ? "Outbid" : "Won"}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── EDITOR VIEW
  if (!session) return null;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost" onClick={() => { setView("sessions"); setEditingCell(null); }}><Icon name="x" size={14} /> Back</button>
            <div>
              <h1 className="page-title">📜 {session.name}</h1>
              <p className="page-subtitle">{session.date} · {sessionMembers.length} members · {session.columns.length} resources</p>
            </div>
          </div>
          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
            <button className={`btn ${showHistoryGuide ? "btn-primary" : "btn-ghost"}`} onClick={() => setShowHistoryGuide(!showHistoryGuide)}>
              <Icon name="book" size={14} /> 
              {showHistoryGuide ? "Hide History Guide" : "Show History Guide"}
            </button>
            {showNewTemplate ? (
              <div className="flex gap-2 items-center">
                <input className="form-input" style={{ width: 180, padding: "6px 12px", fontSize: 13 }} placeholder="Template name..." value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} />
                <button className="btn btn-primary btn-sm" onClick={saveAsTemplate}><Icon name="save" size={12} /> Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewTemplate(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-ghost" onClick={() => setShowNewTemplate(true)}><Icon name="save" size={14} /> Save as Template</button>
            )}
            <button className="btn btn-primary" onClick={addColumn}><Icon name="plus" size={14} /> Add Column</button>
          </div>
        </div>
      </div>

      <div className="flex gap-4" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* Member Pool */}
        <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="flex items-center justify-between">
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Member Pool</div>
            {pool.length > 0 && (
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ fontSize: 10, padding: "2px 6px", height: 24 }}
                onClick={() => {
                  updateSession(s => ({
                    ...s, 
                    members: [...s.members, ...pool.map(m => ({ memberId: m.memberId }))]
                  }));
                  setPoolSearch("");
                }}
                title="Add all shown members to table"
              >
                Add All
              </button>
            )}
          </div>
          
          <div style={{ position: "relative" }}>
            <input 
              className="form-input" 
              placeholder="Search member..." 
              style={{ fontSize: 12, padding: "6px 12px 6px 28px", width: "100%", background: "var(--bg-card)", borderColor: "var(--border)" }}
              value={poolSearch} 
              onChange={e => setPoolSearch(e.target.value)} 
            />
            <div style={{ position: "absolute", left: 10, top: 8, opacity: 0.5 }}>
              <Icon name="search" size={12} />
            </div>
            {poolSearch && (
              <button 
                onClick={() => setPoolSearch("")}
                style={{ position: "absolute", right: 8, top: 8, opacity: 0.5, background: "none", border: "none", cursor: "pointer", padding: 2 }}
              >
                <Icon name="x" size={10} />
              </button>
            )}
          </div>

          <div style={{
            minHeight: 120, maxHeight: "calc(100vh - 280px)", overflowY: "auto", borderRadius: 10, 
            border: `2px dashed ${dragOver === "pool" ? "var(--accent)" : "var(--border)"}`,
            background: dragOver === "pool" ? "rgba(99,130,230,0.08)" : "var(--bg-card)",
            padding: 8, transition: "all 0.15s",
          }}
            className="custom-scrollbar"
            onDragOver={e => { e.preventDefault(); setDragOver("pool"); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={dropToPool}
          >
            {pool.length === 0 && (
              <div className="text-xs text-muted" style={{ textAlign: "center", padding: "20px 0" }}>
                {poolSearch ? "No matches" : "All members added"}
              </div>
            )}
            {pool.map((m, i) => (
              <div key={m.memberId}
                draggable
                onDragStart={() => onDragStart(m.memberId)}
                onDragEnd={onDragEnd}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, cursor: "grab",
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 6, boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  opacity: dragging === m.memberId ? 0.4 : 1, userSelect: "none", transition: "all 0.15s"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
              >
                {miniAvatar(m, members.indexOf(m))}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: 0.5 }}>{m.ign}</div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}>{m.role}</div>
                </div>
              </div>
            ))}
            {dragOver === "pool" && <div className="text-xs text-secondary" style={{ textAlign: "center", padding: "8px 0" }}>Drop to remove</div>}
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            minHeight: 80, borderRadius: 10,
            border: `2px dashed ${dragOver === "table" ? "var(--accent)" : "transparent"}`,
            background: dragOver === "table" ? "rgba(99,130,230,0.04)" : "transparent",
            transition: "all 0.15s", marginBottom: 4,
          }}
            onDragOver={e => { e.preventDefault(); setDragOver("table"); }}
            onDragLeave={() => { if (dragOver === "table") setDragOver(null); }}
            onDrop={dropToTable}
          >
            {sessionMembers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13, border: "2px dashed var(--border)", borderRadius: 10 }}>
                ← Drag members from the pool to add them
              </div>
            ) : (
              <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.05)", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "Cinzel,serif", fontSize: 11, letterSpacing: 1.5, color: "var(--text-primary)", fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", minWidth: 160, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>Member</th>
                      {session.columns.map(col => (
                        <th key={col.id} style={{ padding: "12px 16px", textAlign: "left", borderLeft: "1px solid rgba(255,255,255,0.1)", minWidth: 160 }}>
                          {editingColId === col.id ? (
                            <input className="form-input" style={{ padding: "3px 8px", fontSize: 12, width: "100%", background: "rgba(0,0,0,0.3)", color: "white" }} autoFocus
                              value={colNameInput}
                              onChange={e => setColNameInput(e.target.value)}
                              onBlur={() => renameColumn(col.id)}
                              onKeyDown={e => { if (e.key === "Enter") renameColumn(col.id); if (e.key === "Escape") setEditingColId(null); }} />
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                              <span style={{ fontFamily: "Cinzel,serif", fontSize: 11, letterSpacing: 1.5, color: "var(--text-primary)", fontWeight: 700, textTransform: "uppercase", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{col.name}</span>
                              <div style={{ display: "flex", gap: 4, opacity: 0.8 }}>
                                <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 12, padding: "0 2px" }}
                                  onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
                                  onMouseLeave={e => e.currentTarget.style.color = "var(--text-secondary)"}
                                  onClick={() => { setEditingColId(col.id); setColNameInput(col.name); }}>✎</button>
                                <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 14, padding: "0 2px" }}
                                  onClick={() => deleteColumn(col.id)}>×</button>
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
                        style={{
                          borderBottom: "1px solid var(--border)", 
                          background: rowIdx % 2 === 1 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.15)",
                          opacity: dragging === m.memberId ? 0.35 : 1, transition: "background 0.15s, opacity 0.15s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                        onMouseLeave={e => e.currentTarget.style.background = rowIdx % 2 === 1 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.15)"}
                      >
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "grab" }}>
                            {miniAvatar(m, members.indexOf(m))}
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 13, color: "#ffffff", letterSpacing: 0.5 }}>{m.ign}</div>
                              <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}>{m.class}</div>
                            </div>
                          </div>
                        </td>
                        {session.columns.map(col => {
                          const tags = getCellTags(m.memberId, col.id);
                          const isEditing = editingCell?.memberId === m.memberId && editingCell?.colId === col.id;
                          return (
                            <td key={col.id} style={{ padding: "10px 16px", borderLeft: "1px solid var(--border)", verticalAlign: "top" }}
                              onClick={() => { if (!isEditing) { setEditingCell({ memberId: m.memberId, colId: col.id }); setCellInput(""); } }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, cursor: "pointer", minHeight: 28, alignItems: "flex-start" }}>
                                {tags.map((tag, ti) => {
                                  const tc = tagColor(tag);
                                  return (
                                    <span key={ti} style={{
                                      background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
                                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                                      display: "inline-flex", alignItems: "center", gap: 4,
                                      textDecoration: tc.textDecoration || "none"
                                    }}>
                                      {tc.opacity ? tag.substring(1) : tag}
                                      <div className="flex items-center gap-1 ml-1" style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: 4 }}>
                                        <button style={{ background: "none", border: "none", cursor: "pointer", color: "white", opacity: 0.5, fontSize: 10, padding: 0 }}
                                          title="Toggle Outbid status"
                                          onClick={e => { e.stopPropagation(); toggleOutbid(m.memberId, col.id, ti); }}>🔄</button>
                                        <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", opacity: 0.7, fontSize: 13, lineHeight: 1, padding: 0 }}
                                          onClick={e => { e.stopPropagation(); removeTag(m.memberId, col.id, ti); }}>×</button>
                                      </div>
                                    </span>
                                  );
                                })}
                                {isEditing ? (
                                  <input autoFocus className="form-input"
                                    style={{ width: 80, padding: "2px 8px", fontSize: 12, display: "inline-block" }}
                                    placeholder="Pg1..."
                                    value={cellInput}
                                    onChange={e => setCellInput(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter" && cellInput.trim()) { addTag(m.memberId, col.id, cellInput); setCellInput(""); }
                                      if (e.key === "Escape") setEditingCell(null);
                                    }}
                                    onBlur={() => { if (cellInput.trim()) addTag(m.memberId, col.id, cellInput); setEditingCell(null); setCellInput(""); }}
                                  />
                                ) : (
                                  tags.length === 0 && <span style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.5 }}>Click to add...</span>
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
          {dragOver === "table" && sessionMembers.length > 0 && (
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--accent)", marginTop: 4 }}>Drop here to add member</div>
          )}
        </div>

        {/* Member History Guide Sidebar */}
        {showHistoryGuide && (
          <div style={{ width: 280, flexShrink: 0, position: "sticky", top: 20, maxHeight: "calc(100vh - 120px)", overflowY: "auto" }} className="custom-scrollbar">
            <div className="card" style={{ height: "100%", padding: 16 }}>
              <div className="card-title" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="book" size={14} /> Member History Guide
              </div>
              <p className="text-xs text-muted mb-4">Select a column or member cell to see their past resource winnings.</p>
              
              {editingCell ? (
                <div style={{ animation: "fade-in 0.3s" }}>
                  <div className="space-y-4">
                    {(() => {
                      const currentMember = members.find(m => (m.memberId || "").trim().toLowerCase() === (editingCell.memberId || "").trim().toLowerCase());
                      const allPastWins = lootHistory.filter(h => 
                        (h.memberId || "").trim().toLowerCase() === (editingCell.memberId || "").trim().toLowerCase() && 
                        !h.isOutbid && 
                        h.sessionId !== activeSession
                      );

                      if (allPastWins.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", marginBottom: 4 }}>{currentMember?.ign || "Unknown Member"}</div>
                            <div className="text-muted text-xs">No past resource history found.</div>
                          </div>
                        );
                      }

                      // Group by Column Name
                      const grouped = {};
                      allPastWins.forEach(w => {
                        if (!grouped[w.colName]) grouped[w.colName] = [];
                        grouped[w.colName].push(w);
                      });

                      return (
                        <>
                          <div style={{ padding: "14px", background: "rgba(99,130,230,0.1)", border: "1px solid rgba(99,130,230,0.2)", borderRadius: 12, marginBottom: 16 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "white", fontFamily: "Cinzel, serif" }}>{currentMember?.ign}</div>
                            <div style={{ fontSize: 10, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginTop: 4 }}>
                              Lifetime Winnings: {allPastWins.length}
                            </div>
                          </div>

                          {/* Quick Summary Grid */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                            {Object.entries(grouped).map(([category, items]) => (
                              <div key={category} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                                <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>{category}</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)" }}>{items.length}</div>
                              </div>
                            ))}
                          </div>

                          {/* Grouped History List */}
                          <div className="space-y-6">
                            {Object.entries(grouped).map(([category, items]) => (
                              <div key={category}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                                  <span>{category}</span>
                                  <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, var(--accent-light), transparent)" }} />
                                </div>
                                <div className="space-y-2">
                                  {items.map(w => (
                                    <div key={w.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 10px", transition: "all 0.2s" }}>
                                      <div className="flex items-center justify-between gap-2">
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.sessionName}</div>
                                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{w.date}</div>
                                        </div>
                                        <div style={{ background: "rgba(64,201,122,0.12)", color: "var(--green)", border: "1px solid rgba(64,201,122,0.2)", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, flexShrink: 0 }}>
                                          {w.tag}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 12 }}>
                  <Icon name="mouse-pointer" size={24} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <br />Click on a resource cell to view that member's past wins for that category.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuctionBuilder;
