import React, { useState } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import { MemberAvatar } from '../components/common/MemberAvatar';
import html2canvas from 'html2canvas';
import Modal from '../components/ui/Modal';
import ConfirmDangerModal from '../components/common/ConfirmDangerModal';
import ConfirmTwiceButton from '../components/common/ConfirmTwiceButton';
import StatePanel from '../components/common/StatePanel';

const AuctionMapSidebar = React.memo(function AuctionMapSidebar({
  session,
  sidebarTab,
  selectedMapColId,
  setSelectedMapColId,
  currentSessionGrid,
  maxVisiblePage,
  selectedMapPage,
  setSelectedMapPage,
  setMaxVisiblePage,
  selectedPageAnalysis,
  handleDropdownAssignment,
  sessionMembers,
  handleDeleteMapPage,
  draggedOverSlot,
  setDraggedOverSlot,
  dragging,
  mapSummary,
  mapPageStats,
  mapFocusMode,
  setMapFocusMode
}) {
  if (sidebarTab !== "map") return null;

  const highestTaggedPage = Math.max(0, ...Object.keys(currentSessionGrid).map(k => parseInt(k.substring(1).split("R")[0], 10)));
  const totalPages = Math.max(maxVisiblePage, highestTaggedPage);
  const pageList = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="card custom-scrollbar" style={{ padding: 14, overflowY: "auto", flex: 1, background: "rgba(10,12,18,0.7)", animation: "fade-in 0.3s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
        <div className="card-title" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, margin: 0, whiteSpace: "nowrap" }}>
          <Icon name="grid" size={14} color="var(--accent)" /> Resource Map
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
          <select
            value={selectedMapColId || (session?.columns?.[0]?.id || "")}
            onChange={e => setSelectedMapColId(e.target.value)}
            style={{ fontSize: 10, background: "rgba(30,35,50,0.8)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--accent)", borderRadius: 4, padding: "2px 4px", width: "100%", outline: "none" }}
          >
            {session?.columns?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            {(!session?.columns || session.columns.length === 0) && <option disabled>No Columns</option>}
          </select>
        </div>
        <button
          className={`btn btn-sm ${mapFocusMode ? "btn-primary" : "btn-ghost"}`}
          style={{ fontSize: 10, padding: "3px 8px", whiteSpace: "nowrap" }}
          onClick={() => setMapFocusMode(v => !v)}
          title="Zoom selected page slots for easier assignment"
        >
          {mapFocusMode ? "Focus On" : "Focus Off"}
        </button>
      </div>
      <div style={{ position: "sticky", top: 0, zIndex: 3, marginBottom: 10, background: "rgba(10,12,18,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 8 }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>
          Map Overview
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 6 }}>
          <div style={{ fontSize: 10, padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.03)", textAlign: "center" }}>Pages<br /><strong>{mapSummary.pages}</strong></div>
          <div style={{ fontSize: 10, padding: 6, borderRadius: 8, background: "rgba(42,191,107,0.08)", textAlign: "center", color: "var(--green)" }}>Assigned<br /><strong>{mapSummary.assignedSlots}</strong></div>
          <div style={{ fontSize: 10, padding: 6, borderRadius: 8, background: "rgba(240,192,64,0.08)", textAlign: "center", color: "var(--gold)" }}>Unassigned<br /><strong>{mapSummary.unassignedSlots}</strong></div>
          <div style={{ fontSize: 10, padding: 6, borderRadius: 8, background: "rgba(224,80,80,0.08)", textAlign: "center", color: "var(--red)" }}>Conflicts<br /><strong>{mapSummary.conflictSlots}</strong></div>
        </div>
      </div>

      <div className="space-y-4">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {pageList.map(p => {
            const isSelected = selectedMapPage === p;
            let status = "empty";
            const pageSlots = [1, 2, 3, 4].map(r => `P${p}R${r}`);
            const assignments = pageSlots.map(s => currentSessionGrid[s] || []);
            if (assignments.some(a => a.length > 1)) status = "conflict";
            else if (assignments.every(a => a.length === 1)) status = "full";
            else if (assignments.some(a => a.length > 0)) status = "partial";
            const heat = mapPageStats[p]?.score || 0;

            return (
              <button key={p} onMouseDown={e => e.preventDefault()} onClick={() => setSelectedMapPage(p)}
                style={{
                  position: "relative", width: 32, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 900,
                  background: isSelected ? "var(--accent)" : "rgba(255,255,255,0.03)",
                  color: isSelected ? "white" : "var(--text-muted)",
                  border: `1px solid ${isSelected ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)", cursor: "pointer",
                  boxShadow: isSelected ? "0 0 15px rgba(99,130,230,0.4)" : "none"
                }}
                onMouseEnter={e => !isSelected && (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => !isSelected && (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
              >
                {p}
                {heat >= 5 && <span style={{ position: "absolute", left: -2, bottom: -2, fontSize: 9 }}>🔥</span>}
                {status !== "empty" && (
                  <div style={{
                    position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: "50%",
                    background: status === "conflict" ? "var(--red)" : status === "full" ? "var(--green)" : "var(--gold)",
                    border: "2px solid #080a0f",
                    boxShadow: `0 0 8px ${status === "conflict" ? "var(--red)" : status === "full" ? "var(--green)" : "var(--gold)"}`
                  }} />
                )}
              </button>
            );
          })}
          <button className="btn btn-ghost" style={{ width: 28, height: 28, padding: 0, fontSize: 14 }} onMouseDown={e => e.preventDefault()} onClick={() => { const nx = totalPages + 1; setMaxVisiblePage(nx); setSelectedMapPage(nx); }}>+</button>
        </div>

        <div key={selectedMapPage} style={{ animation: "fade-in 0.2s" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: "var(--accent)", textTransform: "uppercase" }}>Page {selectedMapPage}</div>
                {selectedPageAnalysis.fullPageOwnerName && (
                  <span style={{
                    fontSize: 8, background: "rgba(42, 191, 107, 0.15)", color: "var(--green)",
                    padding: "2px 6px", borderRadius: 4, fontWeight: 900, border: "1px solid rgba(42, 191, 107, 0.3)",
                    letterSpacing: 0.5, animation: "fade-in 0.3s"
                  }}>
                    FULL PAGE: {selectedPageAnalysis.fullPageOwnerName}
                  </span>
                )}
              </div>
              <select
                value={selectedPageAnalysis.fullPageValue}
                onChange={e => handleDropdownAssignment(selectedMapPage, null, e.target.value)}
                style={{
                  fontSize: 9, background: "rgba(255,255,255,0.1)", border: "1px solid var(--accent)", color: "white",
                  borderRadius: 4, padding: "2px 6px", outline: "none", cursor: "pointer",
                  borderColor: selectedPageAnalysis.fullPageBorderColor
                }}
              >
                <option value="none" style={{ background: "#1a1e2e" }}>Clear Full Page Assignment</option>
                {sessionMembers.map(m => (
                  <option key={m.memberId} value={m.memberId} style={{ background: "#1a1e2e" }}>{m.ign}</option>
                ))}
              </select>
              <button
                className="btn btn-ghost"
                style={{ padding: "2px", color: "var(--red)", fontSize: 13, height: "auto", marginLeft: 4 }}
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleDeleteMapPage(selectedMapPage)}
                title="Delete this page"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: mapFocusMode ? 10 : 8 }}>
              {[1, 2, 3, 4].map(row => {
                const key = `P${selectedMapPage}R${row}`;
                const hasConflict = !!selectedPageAnalysis.rowHasConflict[row];
                const currentMemId = selectedPageAnalysis.rowCurrentMemberIds[row] || "none";
                const isDragTarget = draggedOverSlot === key;
                const slotOwners = currentSessionGrid[key] || [];
                const fallbackName = currentMemId !== "none" ? (sessionMembers.find(m => m.memberId === currentMemId)?.ign || "") : "";
                const ownerNames = slotOwners.length > 0 ? slotOwners : (fallbackName ? [fallbackName] : []);
                const ownerInitials = ownerNames.slice(0, 3).map((name) =>
                  String(name || "")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(part => part[0])
                    .join("")
                    .toUpperCase()
                );
                return (
                  <div
                    key={row}
                    onDragOver={e => { if (dragging) { e.preventDefault(); setDraggedOverSlot(key); } }}
                    onDragLeave={() => setDraggedOverSlot(null)}
                    onDrop={e => { if (dragging) { e.preventDefault(); handleDropdownAssignment(selectedMapPage, row, dragging); setDraggedOverSlot(null); } }}
                    style={{
                      padding: mapFocusMode ? "12px 12px" : "8px 10px", borderRadius: 10,
                      background: isDragTarget ? "rgba(99,130,230,0.18)" : (hasConflict ? "rgba(224,80,80,0.12)" : currentMemId !== "none" ? "rgba(42, 191, 107, 0.08)" : "rgba(255,255,255,0.02)"),
                      border: `1px solid ${isDragTarget ? "var(--accent)" : (hasConflict ? "rgba(224,80,80,0.4)" : currentMemId !== "none" ? "rgba(42, 191, 107, 0.4)" : "rgba(255,255,255,0.06)")}`,
                      position: "relative",
                      boxShadow: isDragTarget ? "0 0 18px rgba(99,130,230,0.35)" : (currentMemId !== "none" && !hasConflict ? "inset 0 0 15px rgba(42, 191, 107, 0.03)" : "none"),
                      backdropFilter: "blur(8px)",
                      transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                      animation: hasConflict ? "pulse-red 2s infinite" : (currentMemId !== "none" && !isDragTarget ? "pulse-green 4s infinite" : "none"),
                      minHeight: mapFocusMode ? 84 : 52,
                      display: "flex", flexDirection: "column", justifyContent: "center",
                      transform: isDragTarget ? "scale(1.03)" : "scale(1)",
                      cursor: dragging ? "copy" : "default"
                    }}
                  >
                    <div style={{ opacity: 0.6, fontWeight: 900, fontSize: 8, marginBottom: 4, color: isDragTarget ? "var(--accent)" : (currentMemId !== "none" ? "var(--green)" : "inherit"), letterSpacing: 1 }}>
                      {isDragTarget ? "✦ DROP HERE" : `SLOT ${row}`}
                    </div>
                    <div style={{ position: "relative" }}>
                      <select
                        value={currentMemId}
                        onChange={e => handleDropdownAssignment(selectedMapPage, row, e.target.value)}
                        style={{
                          width: "100%", background: "none", border: "none", color: hasConflict ? "var(--red)" : currentMemId !== "none" ? "white" : "rgba(255,255,255,0.3)",
                          fontSize: 12, fontWeight: 800, outline: "none", cursor: "pointer", appearance: "none", paddingRight: 12
                        }}
                      >
                        <option value="none" style={{ background: "#0a0e18" }}>-- UNASSIGNED --</option>
                        {sessionMembers.map(m => (
                          <option key={m.memberId} value={m.memberId} style={{ background: "#0a0e18" }}>{m.ign}</option>
                        ))}
                      </select>
                      <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none", fontSize: 10 }}>▼</div>
                    </div>
                    {ownerInitials.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                        {ownerInitials.map((ini, idx) => (
                          <span
                            key={`${key}_chip_${idx}`}
                            title={`Slot ${row} • ${ownerNames[idx]}`}
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              letterSpacing: 0.4,
                              padding: "2px 6px",
                              borderRadius: 999,
                              background: hasConflict ? "rgba(224,80,80,0.2)" : "rgba(99,130,230,0.16)",
                              color: hasConflict ? "var(--red)" : "var(--accent)",
                              border: `1px solid ${hasConflict ? "rgba(224,80,80,0.4)" : "rgba(99,130,230,0.35)"}`
                            }}
                          >
                            {ini}
                          </span>
                        ))}
                        {ownerNames.length > 3 && (
                          <span
                            title={ownerNames.slice(3).join(", ")}
                            style={{ fontSize: 9, color: "var(--text-muted)", cursor: "help" }}
                          >
                            +{ownerNames.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    {hasConflict && <div style={{ fontSize: 8, color: "#ff4d4d", marginTop: 2, fontWeight: 900, textShadow: "0 0 8px rgba(255,77,77,0.5)" }}>DUPLICATE!</div>}
                    {hasConflict && (
                      <div style={{ fontSize: 8, color: "rgba(255,77,77,0.8)", marginTop: 1 }}>
                        Choose one owner to resolve
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.sidebarTab === next.sidebarTab &&
    prev.session === next.session &&
    prev.selectedMapColId === next.selectedMapColId &&
    prev.currentSessionGrid === next.currentSessionGrid &&
    prev.maxVisiblePage === next.maxVisiblePage &&
    prev.selectedMapPage === next.selectedMapPage &&
    prev.selectedPageAnalysis === next.selectedPageAnalysis &&
    prev.sessionMembers === next.sessionMembers &&
    prev.draggedOverSlot === next.draggedOverSlot &&
    prev.dragging === next.dragging &&
    prev.mapSummary === next.mapSummary &&
    prev.mapPageStats === next.mapPageStats &&
    prev.mapFocusMode === next.mapFocusMode &&
    prev.handleDropdownAssignment === next.handleDropdownAssignment &&
    prev.handleDeleteMapPage === next.handleDeleteMapPage &&
    prev.setMapFocusMode === next.setMapFocusMode
  );
});

const TrackerMemberRow = React.memo(function TrackerMemberRow({
  memberId,
  ign,
  total,
  sessions,
  isExpanded,
  absoluteIdx,
  dominance,
  badgeColor,
  badgeBg,
  badgeBorder,
  onToggle,
  compact = false,
  anomalies = {}
}) {
  const seshArray = React.useMemo(
    () => Object.values(sessions || {}).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [sessions]
  );
  return (
    <div style={{
      background: isExpanded ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
      borderRadius: 12,
      border: isExpanded ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.04)",
      marginBottom: 8, overflow: "hidden", display: "flex", flexDirection: "column",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      boxShadow: isExpanded ? "0 8px 24px rgba(0,0,0,0.3)" : "none"
    }}>
      <div
        onClick={() => onToggle(memberId)}
        style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 10, padding: compact ? "8px 10px" : "12px", cursor: "pointer", position: "relative" }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <MemberAvatar ign={ign} size={compact ? 24 : (isExpanded ? 36 : 28)} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text-primary)", letterSpacing: 0.5 }}>{ign}</div>
            {absoluteIdx === 0 && <span title="Imperial Sovereign" style={{ fontSize: 14 }}>👑</span>}
            {absoluteIdx === 1 && <span title="Apex Vanguard" style={{ fontSize: 13 }}>🥈</span>}
            {absoluteIdx === 2 && <span title="Elite Guardian" style={{ fontSize: 12 }}>🥉</span>}
            {anomalies.drop && <span title="Sudden drop vs previous session" style={{ fontSize: 11, color: "var(--red)" }}>▼</span>}
            {anomalies.spike && <span title="Sudden spike vs previous session" style={{ fontSize: 11, color: "var(--green)" }}>▲</span>}
            {anomalies.missingLast && <span title="Missing latest session" style={{ fontSize: 11, color: "var(--gold)" }}>⏱</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
            <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${dominance}%`, height: "100%", background: badgeColor, borderRadius: 2, boxShadow: `0 0 5px ${badgeColor}` }} />
            </div>
            <div style={{ fontSize: 8, color: "var(--text-muted)", fontWeight: 700, width: 25 }}>{Math.round(dominance)}%</div>
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: compact ? 13 : 16, fontWeight: 900, color: badgeColor, textShadow: `0 0 10px ${badgeColor}40` }}>{total}</div>
          <div style={{ fontSize: 8, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Units</div>
        </div>
      </div>

      {isExpanded && (
        <div style={{ padding: "0 10px 10px 10px", display: "flex", flexDirection: "column", gap: 6, animation: "fade-in 0.2s" }}>
          {seshArray.map(sesh => (
            <div key={sesh.id} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "8px", borderLeft: `3px solid ${badgeBorder}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 6, color: "var(--text-secondary)" }}>
                <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>{String(sesh.name).toUpperCase()}</span>
                <span style={{ opacity: 0.6 }}>{new Date(sesh.date).toLocaleDateString()}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {sesh.items.map((item, i2) => (
                  <span key={i2} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: badgeBg, color: badgeColor, fontWeight: 700 }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

function AuctionBuilder() {
  const {
    auctionTemplates, setAuctionTemplates, showToast,
    resourceCategories, setResourceCategories,
    sendDiscordImage, pendingAuctionConflict, resolveAuctionConflict, myMemberId, discordConfig,
    memberLootStats, auctionWishlist,
    members, auctionSessions, setAuctionSessions
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
  const [editingColId, setEditingColId] = useState(null);
  const [dragging, setDragging] = useState(null); // memberId
  const [dragOver, setDragOver] = useState(null); // "table" | "pool"
  const [poolSearch, setPoolSearch] = useState(() => localStorage.getItem("auction_poolSearch") || "");
  const [historySearch, setHistorySearch] = useState(() => localStorage.getItem("auction_historySearch") || "");
  const [historyFilter, setHistoryFilter] = useState(() => localStorage.getItem("auction_historyFilter") || "all"); // "all" | "wins" | "outbids"
  const [cardSearch, setCardSearch] = useState(() => localStorage.getItem("auction_cardSearch") || "");
  const [maxVisiblePage, setMaxVisiblePage] = useState(1);
  const [selectedMapPage, setSelectedMapPage] = useState(1);
  const [selectedMapColId, setSelectedMapColId] = useState(null);
  const [trackerTab, setTrackerTab] = useState("Card Album"); // Default initial tab
  const [sidebarTab, setSidebarTab] = useState("map"); // "map" | "tracker"
  const [expandedTrackerMembers, setExpandedTrackerMembers] = useState({});
  const [lastDeletedColumn, setLastDeletedColumn] = useState(null); // { column, cellData, sessionId }
  const [draggedOverSlot, setDraggedOverSlot] = useState(null); // key of the slot being hovered
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileShowPool, setMobileShowPool] = useState(window.innerWidth >= 768);
  const [mobileShowSidebar, setMobileShowSidebar] = useState(window.innerWidth >= 768);
  const AUCTION_DRAFT_KEY = "draft_auction_forms_v1";
  const DELETE_TOKEN = "DELETE";
  const [confirmDeleteMapPage, setConfirmDeleteMapPage] = useState(null);
  const [showDiscordPreview, setShowDiscordPreview] = useState(false);
  const [discordPreview, setDiscordPreview] = useState(null); // { blob, fileName, placeholders, previewUrl, message }
  const [postingDiscord, setPostingDiscord] = useState(false);
  const [lastDiscordAttempt, setLastDiscordAttempt] = useState(null);
  const mapSidebarPerfRef = React.useRef({ commits: 0, totalActualDuration: 0 });
  const trackerListRef = React.useRef(null);
  const [trackerCompactMode, setTrackerCompactMode] = useState(() => localStorage.getItem("auction_trackerCompactMode") === "1");
  const [trackerGroupCollapsed, setTrackerGroupCollapsed] = useState({});
  const [mapFocusMode, setMapFocusMode] = useState(() => localStorage.getItem("auction_mapFocusMode") === "1");

  const [expandedSessionMonths, setExpandedSessionMonths] = useState({});
  const [expandedSessionWeeks, setExpandedSessionWeeks] = useState({});

  const groupedSessions = React.useMemo(() => {
    const groups = {};
    auctionSessions.slice().reverse().forEach(s => {
      if (!s.date) return;
      const dateObj = new Date(s.date);
      if (isNaN(dateObj)) {
        if (!groups["Unknown Date"]) groups["Unknown Date"] = { "Sessions": [] };
        if (!groups["Unknown Date"]["Sessions"]) groups["Unknown Date"]["Sessions"] = [];
        groups["Unknown Date"]["Sessions"].push(s);
        return;
      }

      const monthYear = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!groups[monthYear]) groups[monthYear] = {};
      
      // Weekly grouping
      const dom = dateObj.getDate();
      const weekNum = Math.ceil(dom / 7);
      const startDay = (weekNum - 1) * 7 + 1;
      const endDay = Math.min(new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate(), weekNum * 7);
      const mName = dateObj.toLocaleDateString("en-US", { month: "short" });
      const weekKey = `Week ${weekNum} • ${mName} ${startDay} – ${mName} ${endDay}`;
      
      if (!groups[monthYear][weekKey]) groups[monthYear][weekKey] = [];
      groups[monthYear][weekKey].push(s);
    });
    return groups;
  }, [auctionSessions]);

  const sessionMonthKeys = React.useMemo(() => Object.keys(groupedSessions), [groupedSessions]);

  const toggleSessionWeek = (weekKey) => {
    setExpandedSessionWeeks(prev => ({ ...prev, [weekKey]: !prev[weekKey] }));
  };

  React.useEffect(() => {
    if (sessionMonthKeys.length > 0 && Object.keys(expandedSessionMonths).length === 0) {
      setExpandedSessionMonths({ [sessionMonthKeys[0]]: true });
    }
  }, [sessionMonthKeys, expandedSessionMonths]);

  const toggleSessionMonth = (month) => {
    setExpandedSessionMonths(prev => ({ ...prev, [month]: !prev[month] }));
  };

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(AUCTION_DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.newSessionForm) setNewSessionForm(parsed.newSessionForm);
      if (typeof parsed?.newTemplateName === "string") setNewTemplateName(parsed.newTemplateName);
    } catch {
      localStorage.removeItem(AUCTION_DRAFT_KEY);
    }
  }, []);

  React.useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileShowPool(true);
        setMobileShowSidebar(true);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  React.useEffect(() => { localStorage.setItem("auction_poolSearch", poolSearch); }, [poolSearch]);
  React.useEffect(() => { localStorage.setItem("auction_historySearch", historySearch); }, [historySearch]);
  React.useEffect(() => { localStorage.setItem("auction_historyFilter", historyFilter); }, [historyFilter]);
  React.useEffect(() => { localStorage.setItem("auction_cardSearch", cardSearch); }, [cardSearch]);
  React.useEffect(() => { localStorage.setItem("auction_trackerCompactMode", trackerCompactMode ? "1" : "0"); }, [trackerCompactMode]);
  React.useEffect(() => { localStorage.setItem("auction_mapFocusMode", mapFocusMode ? "1" : "0"); }, [mapFocusMode]);
  React.useEffect(() => {
    localStorage.setItem(AUCTION_DRAFT_KEY, JSON.stringify({ newSessionForm, newTemplateName, ts: Date.now() }));
  }, [newSessionForm, newTemplateName]);
  React.useEffect(() => {
    if (trackerListRef.current) trackerListRef.current.scrollTop = 0;
  }, [trackerTab, cardSearch]);
  React.useEffect(() => {
    return () => {
      if (discordPreview?.previewUrl) URL.revokeObjectURL(discordPreview.previewUrl);
    };
  }, [discordPreview]);

  // Aggregate ALL loot history
  const lootHistory = React.useMemo(() => {
    const history = [];
    auctionSessions.forEach(s => {
      if (!s.cells) return;
      Object.entries(s.cells).forEach(([key, tags]) => {
        if (!tags || tags.length === 0) return;
        
        // Robust parsing: Try matching by Column ID first (new system), then by Column Name (old system)
        let col = s.columns?.find(c => key.endsWith(`_${c.id}`));
        let mIdFromKey = "";
        
        if (col) {
          mIdFromKey = key.substring(0, key.length - col.id.length - 1).trim().toLowerCase();
        } else {
          // Fallback: Check if it ends with the name (older session format)
          col = s.columns?.find(c => key.endsWith(`_${c.name}`));
          if (!col) return;
          mIdFromKey = key.substring(0, key.length - col.name.length - 1).trim().toLowerCase();
        }
        
        const member = members.find(m => (m.memberId || "").trim().toLowerCase() === mIdFromKey);
        if (!member) return;
        
        tags.forEach(tag => {
          history.push({
            id: `${s.id}_${key}_${tag}`,
            sessionId: s.id,
            sessionName: s.name,
            date: s.date,
            memberId: member.memberId, // Official casing
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
  const conflictSummary = pendingAuctionConflict?.summary || null;
  const membersById = React.useMemo(() => {
    const map = new Map();
    members.forEach(m => map.set(m.memberId, m));
    return map;
  }, [members]);
  const selectedSessionCol = React.useMemo(
    () => session?.columns?.find(c => c.id === (selectedMapColId || session?.columns?.[0]?.id)) || null,
    [session, selectedMapColId]
  );

  // Pool = active members not in session
  const sessionMemberIds = new Set((session?.members || []).map(m => m.memberId));
  const pool = activeMembers
    .filter(m => !sessionMemberIds.has(m.memberId))
    .filter(m => !poolSearch || m.ign.toLowerCase().includes(poolSearch.toLowerCase()) || m.class.toLowerCase().includes(poolSearch.toLowerCase()));
  const sessionMembers = React.useMemo(
    () => (session?.members || []).map(sm => membersById.get(sm.memberId)).filter(Boolean),
    [session, membersById]
  );

  const exportTableToImage = async () => {
    const element = document.getElementById('auction-table-export');
    if (!element) return;
    
    showToast("Generating image...", "info");
    
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#080a0f', // Match app background
        scale: 2, // Higher resolution
        logging: false,
        useCORS: true,
        onclone: (clonedDoc) => {
          // Adjust cloned element if needed (e.g. ensure scroll containers are expanded or hidden)
          const el = clonedDoc.getElementById('auction-table-export');
          if (el) el.style.maxHeight = 'none'; // Ensure everything is visible
        }
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Oblivion_Loot_${session.name}_${session.date}.png`;
      link.href = dataUrl;
      link.click();
      showToast("Table exported successfully!", "success");
    } catch (err) {
      console.error("Export failed:", err);
      showToast("Failed to export image", "error");
    }
  };

  const buildAuctionDiscordMessage = React.useCallback((placeholders = {}) => {
    const category = "auction_results";
    const catTemplate = discordConfig?.templates?.[category] || {};
    const fallback = `Loot session results for **${placeholders?.name || session?.name || "Session"}** have been finalized! 🏛️💎\n\n📖 **Legend:**\n• **P1** = Full Page 1 (Bulk Win)\n• **P1R1** = Page 1, Row 1 (Individual Slot)`;
    let msg = catTemplate.description || fallback;
    Object.entries(placeholders).forEach(([key, val]) => {
      msg = msg.replace(new RegExp(`{${key}}`, "g"), String(val ?? ""));
    });
    return msg;
  }, [discordConfig, session?.name]);

  const buildAuctionBlob = React.useCallback(async () => {
    const element = document.getElementById('auction-table-export');
    if (!element) return null;
    const canvas = await html2canvas(element, {
      backgroundColor: '#080a0f',
      scale: 2,
      logging: false,
      useCORS: true,
      onclone: (clonedDoc) => {
        const el = clonedDoc.getElementById('auction-table-export');
        if (el) el.style.maxHeight = 'none';
      }
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob;
  }, []);

  const sendPreviewToDiscord = React.useCallback(async (payload) => {
    if (!payload?.blob) return;
    setPostingDiscord(true);
    try {
      await sendDiscordImage(
        payload.blob,
        payload.fileName,
        payload.message,
        "auction_results",
        payload.placeholders
      );
      setLastDiscordAttempt({
        blob: payload.blob,
        fileName: payload.fileName,
        message: payload.message,
        placeholders: payload.placeholders
      });
      setShowDiscordPreview(false);
      showToast("Auction result posted to Discord", "success");
    } catch (err) {
      console.error("Discord post failed:", err);
      showToast("Failed to post to Discord", "error");
    } finally {
      setPostingDiscord(false);
    }
  }, [sendDiscordImage, showToast]);

  const postTableToDiscord = async () => {
    if (!session) return;
    showToast("Preparing Discord preview...", "info");
    try {
      const blob = await buildAuctionBlob();
      if (!blob) {
        showToast("Failed to generate image blob", "error");
        return;
      }
      const placeholders = { name: session.name };
      const message = buildAuctionDiscordMessage(placeholders);
      const previewUrl = URL.createObjectURL(blob);
      if (discordPreview?.previewUrl) URL.revokeObjectURL(discordPreview.previewUrl);
      setDiscordPreview({
        blob,
        fileName: `Loot_${session.name}.png`,
        placeholders,
        previewUrl,
        message
      });
      setShowDiscordPreview(true);
    } catch (err) {
      console.error("Discord preview failed:", err);
      showToast("Failed to prepare Discord preview", "error");
    }
  };
  const retryLastDiscordPost = async () => {
    if (!lastDiscordAttempt?.blob) {
      showToast("No previous Discord post to retry", "info");
      return;
    }
    await sendPreviewToDiscord(lastDiscordAttempt);
  };

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
    localStorage.removeItem(AUCTION_DRAFT_KEY);
    showToast("Session created!", "success");
  };

  const deleteSession = (id) => {
    setAuctionSessions(prev => prev.filter(s => s.id !== id));
    if (activeSession === id) { setActiveSession(null); setView("sessions"); }
    showToast("Session deleted", "success");
  };

  const updateSession = React.useCallback((updater) => {
    setAuctionSessions(prev => prev.map(s => s.id === activeSession ? updater(s) : s));
  }, [activeSession, setAuctionSessions]);

  const availableCategories = resourceCategories || ["Card Album", "Light & Dark"];
  const addColumn = () => {
    updateSession(s => ({ ...s, columns: [...s.columns, { id: `col_${Date.now()}`, name: availableCategories[0] }] }));
  };

  const handleColumnRename = (colId, value) => {
    if (value === "__new__") {
      const custom = window.prompt("Enter new resource name:");
      if (custom && custom.trim() !== "") {
        const title = custom.trim();
        if (!availableCategories.includes(title)) {
          setResourceCategories(prev => [...prev, title]);
        }
        updateSession(s => ({ ...s, columns: s.columns.map(c => c.id === colId ? { ...c, name: title } : c) }));
      }
    } else if (value.trim()) {
      updateSession(s => ({ ...s, columns: s.columns.map(c => c.id === colId ? { ...c, name: value } : c) }));
    }
    setEditingColId(null);
  };

  // Sync selectedMapColId when activeSession changes
  React.useEffect(() => {
    if (activeSession) {
      const sess = auctionSessions.find(s => s.id === activeSession);
      if (sess && sess.columns?.length > 0) {
        // Only switch if current colId isn't in new session
        if (!sess.columns.some(c => c.id === selectedMapColId)) {
          setSelectedMapColId(sess.columns[0].id);
        }
      }
    }
  }, [activeSession, auctionSessions, selectedMapColId]);

  const deleteColumn = (colId) => {
    const session = auctionSessions.find(s => s.id === activeSession);
    if (!session) return;
    const col = session.columns?.find(c => c.id === colId);
    if (!col) return;

    // Capture column and related cell data for UNDO
    const relatedCells = {};
    Object.entries(session.cells || {}).forEach(([k, v]) => {
      if (k.endsWith(`_${colId}`)) relatedCells[k] = v;
    });

    setLastDeletedColumn({
      column: col,
      cells: relatedCells,
      sessionId: activeSession
    });

    updateSession(s => {
      const cells = { ...s.cells };
      Object.keys(cells).forEach(k => { if (k.endsWith(`_${colId}`)) delete cells[k]; });
      return { ...s, columns: s.columns.filter(c => c.id !== colId), cells };
    });

    showToast(`Column "${col.name}" deleted`, "warning", {
      label: "Undo",
      onClick: () => undoDeleteColumn()
    });
  };

  const undoDeleteColumn = () => {
    if (!lastDeletedColumn) return;
    const { column, cells, sessionId } = lastDeletedColumn;

    setAuctionSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      // Check if column already exists to prevent duplicates
      if (s.columns.some(c => c.id === column.id)) return s;

      return {
        ...s,
        columns: [...s.columns, column],
        cells: { ...s.cells, ...cells }
      };
    }));

    setLastDeletedColumn(null);
    showToast(`Restored column "${column.name}"`, "success");
  };

  const getCellKey = (memberId, colId) => `${memberId}_${colId}`;
  const getCellTags = (memberId, colId) => session?.cells?.[getCellKey(memberId, colId)] || [];

  const isCellForColumn = (ck, col) => col && (ck.endsWith(`_${col.id}`) || ck.endsWith(`_${col.name}`));

  const removeTag = (memberId, colId, tagIdx) => {
    const key = getCellKey(memberId, colId);
    updateSession(s => ({
      ...s,
      cells: { ...s.cells, [key]: (s.cells[key] || []).filter((_, i) => i !== tagIdx) }
    }));
  };

  const isCardColumn = (colName = "") => (colName || "").toLowerCase().includes("card album");
  const isLDColumn = (colName = "") => (colName || "").toLowerCase().includes("light") || (colName || "").toLowerCase().includes("dark");

  const parseCoordinate = (tag) => {
    // Regex for P1R1 or P1
    const match = tag.match(/^[Pp](?:g)?(\d+)(?:[Rr](?:w)?(\d+))?$/i);
    if (match) return { page: parseInt(match[1]), row: match[2] ? parseInt(match[2]) : null };
    return null;
  };

  const currentSessionGrid = React.useMemo(() => {
    const grid = {};
    const session = auctionSessions.find(s => s.id === activeSession);
    if (!session || !session.cells) return grid;

    const targetColId = selectedMapColId || session.columns?.[0]?.id;

    Object.entries(session.cells).forEach(([key, tags]) => {
      const col = session.columns?.find(c => key.endsWith(`_${c.id}`));
      if (!col) return;
      if (col.id !== targetColId) return;
      
      const memberId = key.substring(0, key.length - col.id.length - 1);

      tags.forEach(tag => {
        const coord = parseCoordinate(tag);
        if (coord) {
          const m = membersById.get(memberId);
          if (!m) return;

          if (coord.row) {
            // Specific Row
            const slotKey = `P${coord.page}R${coord.row}`;
            if (!grid[slotKey]) grid[slotKey] = [];
            if (!grid[slotKey].includes(m.ign)) grid[slotKey].push(m.ign);
          } else {
            // Full Page (R1-R4)
            for (let r = 1; r <= 4; r++) {
              const slotKey = `P${coord.page}R${r}`;
              if (!grid[slotKey]) grid[slotKey] = [];
              if (!grid[slotKey].includes(m.ign)) grid[slotKey].push(m.ign);
            }
          }
        }
      });
    });
    return grid;
  }, [activeSession, auctionSessions, membersById, selectedMapColId]);
  const selectedPageAnalysis = React.useMemo(() => {
    const result = {
      fullPageValue: "none",
      fullPageBorderColor: "var(--accent)",
      fullPageOwnerName: null,
      rowCurrentMemberIds: { 1: "none", 2: "none", 3: "none", 4: "none" },
      rowHasConflict: { 1: false, 2: false, 3: false, 4: false }
    };
    if (!session || !selectedSessionCol) return result;

    const pageTag = `P${selectedMapPage}`;
    const ownersByRow = { 1: [], 2: [], 3: [], 4: [] };
    Object.entries(session.cells || {}).forEach(([cKey, tags]) => {
      if (!isCellForColumn(cKey, selectedSessionCol)) return;
      let ownerId = "";
      if (cKey.endsWith(`_${selectedSessionCol.id}`)) ownerId = cKey.substring(0, cKey.length - selectedSessionCol.id.length - 1);
      else ownerId = cKey.substring(0, cKey.length - selectedSessionCol.name.length - 1);
      const normalizedOwner = ownerId.trim();
      if (!normalizedOwner) return;

      [1, 2, 3, 4].forEach((row) => {
        const slotKey = `P${selectedMapPage}R${row}`;
        const isAssigned = (tags || []).some(t => t === slotKey || t === pageTag);
        if (isAssigned) ownersByRow[row].push(normalizedOwner);
      });
    });

    const flattenedOwners = [];
    [1, 2, 3, 4].forEach((row) => {
      const uniqueOwners = [...new Set(ownersByRow[row])];
      result.rowHasConflict[row] = uniqueOwners.length > 1;
      result.rowCurrentMemberIds[row] = uniqueOwners.length === 1 ? uniqueOwners[0] : "none";
      if (uniqueOwners[0]) flattenedOwners.push(uniqueOwners[0]);
    });

    if (flattenedOwners.length === 4 && new Set(flattenedOwners).size === 1) {
      result.fullPageValue = flattenedOwners[0];
      result.fullPageBorderColor = "var(--green)";
      result.fullPageOwnerName = membersById.get(flattenedOwners[0])?.ign || flattenedOwners[0];
    }
    return result;
  }, [session, selectedSessionCol, selectedMapPage, membersById]);
  const mapPageStats = React.useMemo(() => {
    const stats = {};
    const highestTaggedPage = Math.max(0, ...Object.keys(currentSessionGrid).map(k => parseInt(k.substring(1).split("R")[0], 10)));
    const totalPages = Math.max(maxVisiblePage, highestTaggedPage);
    for (let p = 1; p <= totalPages; p += 1) {
      let assignedSlots = 0;
      let conflictSlots = 0;
      let unassignedSlots = 0;
      let hasMine = false;
      for (let r = 1; r <= 4; r += 1) {
        const slot = `P${p}R${r}`;
        const owners = currentSessionGrid[slot] || [];
        if (owners.length === 0) unassignedSlots += 1;
        else if (owners.length === 1) assignedSlots += 1;
        else conflictSlots += 1;
        if (!hasMine && myMemberId) {
          const mineIgn = membersById.get(myMemberId)?.ign;
          if (mineIgn && owners.includes(mineIgn)) hasMine = true;
        }
      }
      stats[p] = { assignedSlots, conflictSlots, unassignedSlots, hasMine, score: assignedSlots + conflictSlots * 2 };
    }
    return stats;
  }, [currentSessionGrid, maxVisiblePage, myMemberId, membersById]);
  const mapSummary = React.useMemo(() => {
    const values = Object.values(mapPageStats);
    return {
      pages: values.length,
      assignedSlots: values.reduce((s, v) => s + v.assignedSlots, 0),
      unassignedSlots: values.reduce((s, v) => s + v.unassignedSlots, 0),
      conflictSlots: values.reduce((s, v) => s + v.conflictSlots, 0)
    };
  }, [mapPageStats]);

  // Aggregated Resource History Grouped by Session
  const resourceHistory = React.useMemo(() => {
    const data = {};
    const cats = resourceCategories || ["Card Album", "Light & Dark"];
    
    // Use a normalization map to handle casing duplicates
    const normMap = {}; 
    cats.forEach(c => {
      const lower = c.toLowerCase().trim();
      if (!normMap[lower]) {
        normMap[lower] = c;
        data[c] = {};
      }
    });

    const session = auctionSessions.find(s => s.id === activeSession);

    const expandTags = (tags) => {
      return tags.flatMap(tag => {
        const parsed = parseCoordinate(tag);
        if (parsed && !parsed.row) {
          return [`P${parsed.page}R1`, `P${parsed.page}R2`, `P${parsed.page}R3`, `P${parsed.page}R4`];
        }
        return tag;
      });
    };

    // 1. Process Past Sessions
    lootHistory.filter(h => !h.isOutbid && h.sessionId !== activeSession).forEach(h => {
      const lowerCat = h.colName.toLowerCase().trim();
      const cat = normMap[lowerCat] || h.colName;
      const normMemberId = (h.memberId || "").trim().toLowerCase();
      
      if (!data[cat]) data[cat] = {};
      if (!data[cat][normMemberId]) data[cat][normMemberId] = { total: 0, allTags: [], sessions: {} };
      
      const expanded = expandTags([h.tag]);
      data[cat][normMemberId].allTags.push(...expanded);
      data[cat][normMemberId].total += expanded.length;

      const sId = h.sessionId;
      if (!data[cat][normMemberId].sessions[sId]) {
         const pastSesh = auctionSessions.find(s => s.id === sId) || {};
         data[cat][normMemberId].sessions[sId] = {
           id: sId,
           name: pastSesh.name || "Past Session",
           date: pastSesh.date || h.date,
           items: []
         };
      }
      data[cat][normMemberId].sessions[sId].items.push(...expanded);
    });

    // 2. Process Current Active Session
    if (session?.cells) {
      Object.entries(session.cells).forEach(([key, tags]) => {
        const col = session.columns?.find(c => isCellForColumn(key, c));
        if (!col) return;
        
        let mIdExtraction = "";
        if (key.endsWith(`_${col.id}`)) mIdExtraction = key.substring(0, key.length - col.id.length - 1);
        else mIdExtraction = key.substring(0, key.length - col.name.length - 1);
        
        const normMemberId = mIdExtraction.trim().toLowerCase();
        
        const lowerCat = col.name.toLowerCase().trim();
        const cat = normMap[lowerCat] || col.name;
        const validTags = (tags || []).filter(t => !t.startsWith("!"));
        
        if (!data[cat]) data[cat] = {};
        if (!data[cat][normMemberId]) data[cat][normMemberId] = { total: 0, allTags: [], sessions: {} };
        
        const expanded = expandTags(validTags);
        data[cat][normMemberId].allTags.push(...expanded);
        data[cat][normMemberId].total += expanded.length;

        const sId = activeSession;
        if (!data[cat][normMemberId].sessions[sId]) {
            data[cat][normMemberId].sessions[sId] = {
                id: activeSession,
                name: session.name || "Current Session",
                date: session.date || new Date().toISOString(),
                items: []
            };
        }
        data[cat][normMemberId].sessions[sId].items.push(...expanded);
      });
    }
    return data;
  }, [activeSession, auctionSessions, lootHistory, resourceCategories]);

  const handleDropdownAssignment = React.useCallback((page, row, memberId) => {
    const sess = auctionSessions.find(s => s.id === activeSession);
    let targetColId = selectedMapColId;
    let targetCol = sess?.columns?.find(c => c.id === targetColId);
    
    // Fallback if no col selected or selected col not in this session
    if (!targetCol) {
      targetCol = sess?.columns?.find(c => (c.name || "").toLowerCase().includes("card album")) || sess?.columns?.[0];
      targetColId = targetCol?.id;
    }

    if (!targetColId) { showToast("No resource column found", "error"); return; }
    
    const tag = row ? `P${page}R${row}` : `P${page}`;
    const key = getCellKey(memberId, targetColId);

    updateSession(s => {
      const newCells = { ...s.cells };
      const pageTag = `P${page}`;
      const pageRowTags = [1, 2, 3, 4].map(r => `P${page}R${r}`);
      
      // 1. Remove conflicting tags from this specific column.
      // - Row assignment: remove that row tag and broad page tag from everyone.
      // - Full-page assignment: clear all page rows and broad page tag from everyone.
      Object.keys(newCells).forEach(ck => {
        if (isCellForColumn(ck, targetCol)) {
          const existing = newCells[ck] || [];
          newCells[ck] = existing.filter(t => {
            if (!row) return t !== pageTag && !pageRowTags.includes(t);
            return t !== tag && t !== pageTag;
          });
        }
      });

      // 2. Add tag(s) to selected member, if any.
      if (memberId !== "none") {
        const existing = newCells[key] || [];
        if (!row) {
          // Full-page owner gets a single canonical page tag.
          newCells[key] = [...existing.filter(t => !pageRowTags.includes(t) && t !== pageTag), pageTag];
        } else {
          // Row owner gets only the row tag; avoid duplicates.
          newCells[key] = existing.includes(tag) ? existing : [...existing, tag];
        }
      }

      return { ...s, cells: newCells };
    });
    showToast(`Page ${page} assigned successfully!`, "success");
  }, [auctionSessions, activeSession, selectedMapColId, updateSession, showToast]);

  const handleDeleteMapPage = React.useCallback((page) => {
    setConfirmDeleteMapPage(page);
  }, []);
  const toggleTrackerMember = React.useCallback((memberId) => {
    setExpandedTrackerMembers(p => ({ ...p, [memberId]: !p[memberId] }));
  }, []);
  const onMapSidebarProfileRender = React.useCallback((id, phase, actualDuration) => {
    if (!import.meta.env.DEV) return;
    const perf = mapSidebarPerfRef.current;
    perf.commits += 1;
    perf.totalActualDuration += actualDuration;
    if (perf.commits % 10 === 0 || actualDuration > 16) {
      const avg = perf.totalActualDuration / perf.commits;
      console.debug(`[perf] ${id} ${phase}: last=${actualDuration.toFixed(2)}ms avg=${avg.toFixed(2)}ms commits=${perf.commits}`);
    }
  }, []);

  const executeDeleteMapPage = (page) => {
    if (!page) return;

    const session = auctionSessions.find(s => s.id === activeSession);
    const targetColId = selectedMapColId || session?.columns?.find(c => isCardColumn(c.name))?.id;

    updateSession(s => {
      const newCells = { ...s.cells };
      const pagePrefix = `P${page}`;
      
      // 1. Clear tags for this page
      Object.keys(newCells).forEach(k => {
        if (k.endsWith(`_${targetColId}`)) {
          newCells[k] = (newCells[k] || []).filter(t => !t.startsWith(pagePrefix));
        }
      });

      return { ...s, cells: newCells };
    });

    setMaxVisiblePage(prev => Math.max(1, prev - 1));
    if (selectedMapPage > 1) setSelectedMapPage(prev => prev - 1);
    showToast(`Page ${page} removed.`, "success");
    setConfirmDeleteMapPage(null);
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
    const member = membersById.get(dragging);
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
    const safeName = newTemplateName.trim().toLowerCase().replace(/\s+/g, "_");
    const template = { id: `TPL_${session.id}_${safeName}`, name: newTemplateName, columns: session.columns };
    setAuctionTemplates(prev => [...prev, template]);
    setNewTemplateName("");
    setShowNewTemplate(false);
    localStorage.removeItem(AUCTION_DRAFT_KEY);
    showToast("Template saved!", "success");
  };

  const tagColor = (tag, colName = "") => {
    const isOutbid = tag.startsWith("!");
    const t = (isOutbid ? tag.substring(1) : tag).toLowerCase();
    const isCard = isCardColumn(colName);
    
    if (isOutbid) return { 
      bg: "rgba(224,80,80,0.05)", 
      color: "rgba(255,255,255,0.4)", 
      border: "rgba(224,80,80,0.2)",
      textDecoration: "line-through",
      opacity: 0.6
    };

    if (isCard) return { bg: "rgba(240,192,64,0.18)", color: "var(--gold)", border: "var(--gold)", glow: "0 0 10px rgba(240,192,64,0.3)" };
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

      <div className="flex gap-2 mb-6 sticky-actions" style={{ background: "rgba(0,0,0,0.2)", padding: 4, borderRadius: 10, width: "fit-content" }}>
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
            {auctionSessions.length === 0 && (
              <StatePanel
                icon="📜"
                title="No sessions yet"
                description="Create your first auction session to start assigning members and loot."
              />
            )}
            {sessionMonthKeys.map(month => {
              const weekGroups = groupedSessions[month];
              const isMonthExpanded = !!expandedSessionMonths[month];
              const weekKeys = Object.keys(weekGroups);
              
              return (
                <div key={month} style={{ marginBottom: 6 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ 
                      width: "100%", justifyContent: "space-between", fontSize: 11, padding: "10px 12px", 
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", 
                      marginBottom: isMonthExpanded ? 8 : 0, borderRadius: 8
                    }}
                    onClick={() => toggleSessionMonth(month)}
                  >
                    <span style={{ fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--accent)", fontSize: 10 }}>{isMonthExpanded ? "▼" : "▶"}</span> {month.toUpperCase()}
                    </span>
                    <span className="badge badge-casual" style={{ fontSize: 9 }}>{Object.values(weekGroups).flat().length}</span>
                  </button>

                  {isMonthExpanded && (
                    <div className="flex flex-col gap-1" style={{ paddingLeft: 8, borderLeft: "1px solid rgba(99,130,230,0.15)", marginLeft: 8, animation: "fade-in 0.2s" }}>
                      {weekKeys.map(weekKey => {
                        const weekSessions = weekGroups[weekKey];
                        const isWeekExpanded = expandedSessionWeeks[weekKey] !== false; // Default expanded
                        return (
                          <div key={weekKey} style={{ marginBottom: 4 }}>
                            <div 
                              onClick={() => toggleSessionWeek(weekKey)}
                              style={{ 
                                display: "flex", alignItems: "center", justifySpace: "between", cursor: "pointer", 
                                padding: "4px 8px", fontSize: 10, color: "var(--text-muted)", fontWeight: 700, 
                                opacity: 0.8, letterSpacing: 0.5 
                              }}>
                              <span style={{ marginRight: 6, fontSize: 8 }}>{isWeekExpanded ? "▼" : "▶"}</span>
                              {weekKey.toUpperCase()}
                              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)", marginLeft: 8 }} />
                            </div>
                            
                            {isWeekExpanded && (
                              <div className="flex flex-col gap-2 mt-2" style={{ animation: "fade-in 0.15s" }}>
                                {weekSessions.map(s => (
                                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-card2)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", borderColor: activeSession === s.id ? "var(--accent)" : "var(--border)" }}
                                    onClick={() => { setActiveSession(s.id); setView("editor"); }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                                      <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>{new Date(s.date).toLocaleDateString("en-US", { weekday: 'short', day: 'numeric' })} · {s.members.length} members</div>
                                    </div>
                                    <ConfirmTwiceButton
                                      className="btn btn-danger btn-sm btn-icon"
                                      onClick={(e) => e.stopPropagation()}
                                      onConfirm={() => deleteSession(s.id)}
                                      icon={<Icon name="trash" size={12} />}
                                      iconOnly
                                      title="Delete session"
                                    />
                                  </div>
                                ))}
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

        {/* Templates */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="card-title" style={{ marginBottom: 0 }}>Templates</div>
          </div>
          <div className="flex flex-col gap-2">
            {auctionTemplates.length === 0 && (
              <StatePanel
                icon="📋"
                title="No templates yet"
                description="Save a session as template to speed up future runs."
              />
            )}
            {auctionTemplates.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-card2)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                  <div className="text-xs text-muted">{t.columns.map(c => c.name).join(" · ")}</div>
                </div>
                <ConfirmTwiceButton
                  className="btn btn-danger btn-sm btn-icon"
                  onConfirm={() => { setAuctionTemplates(prev => prev.filter(x => x.id !== t.id)); showToast("Template deleted", "success"); }}
                  icon={<Icon name="trash" size={12} />}
                  iconOnly
                  title="Delete template"
                />
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
        <div className="page-header sticky-actions">
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
    <>
    <div>
      <div className="page-header sticky-actions">
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
            <button className="btn btn-primary" onClick={exportTableToImage} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Icon name="camera" size={14} /> 📸 Export Image
            </button>
            <button className="btn btn-primary" onClick={postTableToDiscord} style={{ background: "rgba(88,101,242,0.15)", color: "#5865F2", border: "1px solid rgba(88,101,242,0.3)" }}>
              <Icon name="discord" size={14} /> 🚀 Post to Discord
            </button>
            <button className="btn btn-ghost" onClick={retryLastDiscordPost} disabled={postingDiscord || !lastDiscordAttempt} title="Retry the last posted auction result payload">
              <Icon name="refresh" size={14} /> {postingDiscord ? "Retrying..." : "Retry Last Post"}
            </button>
            <button className="btn btn-primary" onClick={addColumn}><Icon name="plus" size={14} /> Add Column</button>
          </div>
        </div>
      </div>

      <div className="flex gap-4" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        {isMobile && (
          <div style={{ width: "100%", display: "flex", gap: 8, marginBottom: 8 }}>
            <button className={`btn btn-sm ${mobileShowPool ? "btn-primary" : "btn-ghost"}`} onClick={() => setMobileShowPool(v => !v)}>
              {mobileShowPool ? "Hide Pool" : "Show Pool"}
            </button>
            <button className={`btn btn-sm ${mobileShowSidebar ? "btn-primary" : "btn-ghost"}`} onClick={() => setMobileShowSidebar(v => !v)}>
              {mobileShowSidebar ? "Hide Guide" : "Show Guide"}
            </button>
          </div>
        )}

        {/* Member Pool */}
        {(!isMobile || mobileShowPool) && (
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
            {pool.map((m) => (
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: 0.5 }}>{m.ign}</div>
                    {(() => {
                      const wishEntry = auctionWishlist.find(b => b.id === m.memberId);
                      const albumWish = wishEntry?.bids?.find(bi => bi.type === "Card Album");
                      const manualCount = albumWish?.currentCount;
                      
                      const albums = manualCount !== undefined ? manualCount : (memberLootStats[m.memberId]?.cardAlbums || 0);
                      const progress = albums % 10;
                      if (progress === 0 && albums === 0) return null;
                      return (
                        <span title={`${progress}/10 Card Progress (${albums} total)`} style={{ fontSize: 9, fontWeight: 900, color: progress >= 9 ? "var(--red)" : "var(--accent)", background: "rgba(0,0,0,0.3)", padding: "1px 4px", borderRadius: 4 }}>
                          {progress}/10
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}>{m.role}</div>
                    {auctionWishlist.find(b => b.id === m.memberId)?.bids?.length > 0 && (
                      <span title="Has active Loot Wishlist" style={{ fontSize: 10 }}>⭐</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {dragOver === "pool" && <div className="text-xs text-secondary" style={{ textAlign: "center", padding: "8px 0" }}>Drop to remove</div>}
          </div>
        </div>
        )}

        {/* Table Wrap for Image Capture */}
        <div id="auction-table-export" style={{ flex: 1, minWidth: 0, padding: 12, background: "var(--bg-dark)", borderRadius: 16 }}>
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
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, animation: "fade-in 0.2s" }}>
                              {availableCategories.map(rc => (
                                <button key={rc}
                                  onClick={() => handleColumnRename(col.id, rc)}
                                  style={{ 
                                    padding: "4px 8px", fontSize: 10, borderRadius: 6, cursor: "pointer", fontWeight: 900,
                                    background: col.name === rc ? "var(--accent)" : "rgba(255,255,255,0.05)",
                                    color: col.name === rc ? "white" : "var(--text-muted)",
                                    border: `1px solid ${col.name === rc ? "var(--accent)" : "rgba(255,255,255,0.1)"}`,
                                    transition: "all 0.2s"
                                  }}
                                  onMouseEnter={e => { if (col.name !== rc) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                                  onMouseLeave={e => { if (col.name !== rc) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                                >
                                  {rc}
                                </button>
                              ))}
                              <button 
                                onClick={() => handleColumnRename(col.id, "__new__")}
                                style={{ 
                                  padding: "4px 8px", fontSize: 10, borderRadius: 6, cursor: "pointer", fontWeight: 900,
                                  background: "rgba(99,130,230,0.1)", color: "var(--accent)", border: "1px solid rgba(99,130,230,0.3)"
                                }}
                              >
                                🖋 Custom
                              </button>
                              <button 
                                onClick={() => setEditingColId(null)}
                                style={{ 
                                  padding: "4px 8px", fontSize: 10, borderRadius: 6, cursor: "pointer",
                                  background: "rgba(255,77,77,0.1)", color: "var(--red)", border: "1px solid rgba(255,77,77,0.3)"
                                }}
                                title="Cancel"
                              >
                                ❌
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                              <span style={{ fontFamily: "Cinzel,serif", fontSize: 11, letterSpacing: 1.5, color: "var(--text-primary)", fontWeight: 700, textTransform: "uppercase", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{col.name}</span>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button 
                                  style={{ 
                                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", 
                                    color: "var(--text-secondary)", fontSize: 13, padding: "4px 6px", borderRadius: 6, transition: "all 0.2s"
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "white"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                                  onClick={() => { setEditingColId(col.id); }}
                                  title="Edit column name"
                                >
                                  ✎
                                </button>
                                <ConfirmTwiceButton
                                  icon={<span style={{ lineHeight: 1 }}>×</span>}
                                  iconOnly
                                  style={{
                                    background: "rgba(255,77,77,0.05)", border: "1px solid rgba(255,77,77,0.1)", cursor: "pointer",
                                    color: "var(--red)", fontSize: 16, padding: "4px 6px", borderRadius: 6, transition: "all 0.2s", lineHeight: 1
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,77,77,0.15)"; e.currentTarget.style.borderColor = "var(--red)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,77,77,0.05)"; e.currentTarget.style.borderColor = "rgba(255,77,77,0.1)"; }}
                                  onConfirm={() => deleteColumn(col.id)}
                                  title="Delete column (click twice)"
                                />
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
                            <td key={col.id} style={{ 
                                padding: "10px 16px", borderLeft: "1px solid var(--border)", verticalAlign: "top",
                                background: isEditing ? "rgba(64,201,122,0.05)" : "transparent",
                                border: isEditing ? "2px solid rgba(64,201,122,0.4)" : "none",
                                boxShadow: isEditing ? "inset 0 0 10px rgba(64,201,122,0.1)" : "none",
                                transition: "all 0.2s"
                              }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, cursor: "default", minHeight: 28, alignItems: "flex-start" }}>
                                  {tags.map((tag, ti) => {
                                    const tc = tagColor(tag, col.name);
                                    return (
                                      <span key={ti} style={{
                                        background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
                                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                                        display: "inline-flex", alignItems: "center", gap: 4,
                                        textDecoration: tc.textDecoration || "none",
                                        boxShadow: tc.glow || "none"
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
                                {tags.length === 0 && <span style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.4 }}>Use Map to Assign</span>}
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
        {showHistoryGuide && (!isMobile || mobileShowSidebar) && (
          <div style={{ width: 330, flexShrink: 0, position: "sticky", top: 20, maxHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column", gap: 10 }}>
            
            {/* Sidebar Tab Switcher */}
            <div style={{ 
              display: "flex", background: "rgba(0,0,0,0.4)", padding: 4, borderRadius: 12, gap: 4, 
              border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" 
            }}>
              <button 
                onClick={() => setSidebarTab("map")}
                style={{ 
                  flex: 1, padding: "10px", borderRadius: 10, fontSize: 10, fontWeight: 900, letterSpacing: 1.5, cursor: "pointer", border: "none", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  background: sidebarTab === "map" ? "var(--accent)" : "transparent",
                  color: sidebarTab === "map" ? "white" : "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: sidebarTab === "map" ? "0 4px 15px rgba(99,130,230,0.3)" : "none",
                  transform: sidebarTab === "map" ? "scale(1.02)" : "scale(1)"
                }}
              >
                <Icon name="grid" size={14} /> MAP
              </button>
              <button 
                onClick={() => setSidebarTab("tracker")}
                style={{ 
                  flex: 1, padding: "10px", borderRadius: 10, fontSize: 10, fontWeight: 900, letterSpacing: 1.5, cursor: "pointer", border: "none", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  background: sidebarTab === "tracker" ? "var(--gold)" : "transparent",
                  color: sidebarTab === "tracker" ? "white" : "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: sidebarTab === "tracker" ? "0 4px 15px rgba(240,192,64,0.3)" : "none",
                  transform: sidebarTab === "tracker" ? "scale(1.02)" : "scale(1)"
                }}
              >
                <Icon name="shield" size={14} /> TRACKER
              </button>
              <button 
                onClick={() => setSidebarTab("wishlist")}
                style={{ 
                  flex: 1, padding: "10px", borderRadius: 10, fontSize: 10, fontWeight: 900, letterSpacing: 1.5, cursor: "pointer", border: "none", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  background: sidebarTab === "wishlist" ? "var(--red)" : "transparent",
                  color: sidebarTab === "wishlist" ? "white" : "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: sidebarTab === "wishlist" ? "0 4px 15px rgba(224,80,80,0.3)" : "none",
                  transform: sidebarTab === "wishlist" ? "scale(1.02)" : "scale(1)"
                }}
              >
                <Icon name="star" size={14} /> WISHLIST
              </button>
            </div>

            {/* 1. Resource Map Tab */}
            <React.Profiler id="AuctionMapSidebar" onRender={onMapSidebarProfileRender}>
              <AuctionMapSidebar
                session={session}
                sidebarTab={sidebarTab}
                selectedMapColId={selectedMapColId}
                setSelectedMapColId={setSelectedMapColId}
                currentSessionGrid={currentSessionGrid}
                maxVisiblePage={maxVisiblePage}
                selectedMapPage={selectedMapPage}
                setSelectedMapPage={setSelectedMapPage}
                setMaxVisiblePage={setMaxVisiblePage}
                selectedPageAnalysis={selectedPageAnalysis}
                handleDropdownAssignment={handleDropdownAssignment}
                sessionMembers={sessionMembers}
                handleDeleteMapPage={handleDeleteMapPage}
                draggedOverSlot={draggedOverSlot}
                setDraggedOverSlot={setDraggedOverSlot}
                dragging={dragging}
                mapSummary={mapSummary}
                mapPageStats={mapPageStats}
                mapFocusMode={mapFocusMode}
                setMapFocusMode={setMapFocusMode}
              />
            </React.Profiler>

            {/* 2. Wishlist Tab */}
            {sidebarTab === "wishlist" && (
              <div className="card custom-scrollbar animate-fade-in" style={{ flex: 1, padding: 14, overflowY: "auto", background: "rgba(10,12,18,0.7)", display: "flex", flexDirection: "column" }}>
                <div className="card-title" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Icon name="star" size={14} color="var(--gold)" /> Active Loot Wishlist
                </div>
                <div className="flex flex-col gap-2">
                  {auctionWishlist.filter(b => (b.bids || []).length > 0).length === 0 && (
                    <div className="text-center p-6 text-muted text-xs">No active wishlist items from members.</div>
                  )}
                  {auctionWishlist.filter(b => (b.bids || []).length > 0).map(wishEntry => {
                    const m = members.find(mx => mx.memberId === wishEntry.id);
                    if (!m) return null;
                    return (
                      <div key={wishEntry.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10 }}>
                        <div className="flex items-center gap-2 mb-2">
                          <MemberAvatar ign={m.ign} size={24} />
                          <div style={{ fontSize: 12, fontWeight: 800 }}>{m.ign}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(wishEntry.bids || []).map((b, bi) => {
                            const isAlbum = b.type === "Card Album";
                            const manualCount = b.currentCount;
                            const cardWins = manualCount !== undefined ? manualCount : (memberLootStats[wishEntry.id]?.cardAlbums || 0);
                            const need = isAlbum ? (10 - (cardWins % 10)) : 0;
                            
                            return (
                              <div key={bi} style={{ 
                                fontSize: 10, fontWeight: 900, padding: "4px 10px", borderRadius: 6,
                                background: isAlbum ? "rgba(240,192,64,0.15)" : "rgba(99,130,230,0.15)",
                                color: isAlbum ? "var(--gold)" : "var(--accent)",
                                border: `1px solid ${isAlbum ? "rgba(240,192,64,0.3)" : "rgba(99,130,230,0.3)"}`,
                                display: "flex", flexDirection: "column", gap: 2
                              }}>
                                <div style={{ fontSize: 9, opacity: 0.8 }}>{b.type.toUpperCase()}</div>
                                {isAlbum && (
                                  <div style={{ display: "flex", gap: 8, marginTop: 1 }}>
                                    <span style={{ color: "white" }}>HAVE: {cardWins}</span>
                                    <span style={{ color: "var(--red)" }}>NEED: {need}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
 
            {/* 2. Global World Master Tracker Tab */}
            {sidebarTab === "tracker" && (
              <div className="card custom-scrollbar" style={{ flex: 1, padding: 16, overflowY: "auto", background: "rgba(10,12,18,0.7)", display: "flex", flexDirection: "column", animation: "fade-in 0.3s" }}>
               <div className="card-title" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                 <Icon name="shield" size={14} color="var(--gold)" /> World Master Tracker
               </div>
               <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 8, flexWrap: "wrap" }}>
                 {Object.keys(resourceHistory).map(cat => (
                   <button key={cat} onClick={() => setTrackerTab(cat)} style={{ flex: "1 1 auto", padding: "5px 10px", fontSize: 10, fontWeight: 900, borderRadius: 6, background: trackerTab === cat ? "var(--bg-card)" : "transparent", color: trackerTab === cat ? (isLDColumn(cat) ? "#c080ff" : "var(--accent)") : "var(--text-muted)", border: "none", cursor: "pointer", transition: "all 0.2s" }}>
                     {cat.toUpperCase()}
                   </button>
                 ))}
               </div>
               <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  <button className={`btn btn-sm ${trackerCompactMode ? "btn-primary" : "btn-ghost"}`} style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => setTrackerCompactMode(v => !v)}>
                    {trackerCompactMode ? "Compact On" : "Compact Off"}
                  </button>
               </div>
               <div style={{ position: "relative", marginBottom: 10 }}>
                  <input className="form-input" style={{ fontSize: 11, padding: "6px 28px", width: "100%", background: "rgba(0,0,0,0.3)" }} placeholder={`Search ${trackerTab}...`} value={cardSearch} onChange={e => setCardSearch(e.target.value)} />
                  <div style={{ position: "absolute", left: 8, top: 7, opacity: 0.5 }}><Icon name="search" size={12} /></div>
               </div>
              <div
                ref={trackerListRef}
                className="space-y-1"
                style={{ flex: 1, overflowY: "auto" }}
              >
                 {(() => {
                   const historyMap = resourceHistory[trackerTab] || {};
                   const isLD = isLDColumn(trackerTab);
                   let badgeColor = isLD ? "#c080ff" : "var(--gold)";
                   let badgeBg = isLD ? "rgba(180,100,250,0.1)" : "rgba(240,192,64,0.1)";
                   let badgeBorder = isLD ? "rgba(180,100,250,0.3)" : "rgba(240,192,64,0.3)";
                   if (!isCardColumn(trackerTab) && !isLD) {
                     badgeColor = "var(--green)"; badgeBg = "rgba(64,201,122,0.1)"; badgeBorder = "rgba(64,201,122,0.3)";
                   }
                   const activeMembersWithResources = members
                     .map(m => {
                       const historyData = historyMap[(m.memberId || '').trim().toLowerCase()] || { total: 0, allTags: [], sessions: {} };
                       return { ...m, ...historyData };
                     })
                     .filter(m => {
                       if (!cardSearch) return m.total > 0;
                       return m.ign.toLowerCase().includes(cardSearch.toLowerCase()) || m.allTags.some(c => c.toLowerCase().includes(cardSearch.toLowerCase()));
                     });
                    
                   const sortedMembers = activeMembersWithResources
                      .sort((a, b) => b.total - a.total);
                    
                    const grandTotal = activeMembersWithResources.reduce((sum, m) => sum + m.total, 0);

                    if (activeMembersWithResources.length === 0) {
                      return <div className="text-xs text-muted py-8 text-center">{`No ${trackerTab} records found.`}</div>;
                    }
                    
                    const latestSessionDate = sortedMembers.reduce((max, m) => {
                      const latest = Object.values(m.sessions || {}).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                      const d = latest?.date ? new Date(latest.date).getTime() : 0;
                      return Math.max(max, d || 0);
                    }, 0);
                    const grouped = sortedMembers.reduce((acc, m) => {
                      const role = m.role || "Unknown";
                      if (!acc[role]) acc[role] = [];
                      acc[role].push(m);
                      return acc;
                    }, {});
                    const roleOrder = ["DPS", "Support", "Unknown"];
                    const groupNames = Object.keys(grouped).sort((a, b) => {
                      const ai = roleOrder.indexOf(a);
                      const bi = roleOrder.indexOf(b);
                      if (ai === -1 && bi === -1) return a.localeCompare(b);
                      if (ai === -1) return 1;
                      if (bi === -1) return -1;
                      return ai - bi;
                    });
                    let runningRank = 0;

                    return (
                      <>
                        {groupNames.map((groupName) => {
                          const groupRows = grouped[groupName] || [];
                          const collapsed = !!trackerGroupCollapsed[groupName];
                          return (
                            <div key={groupName} style={{ marginBottom: 10 }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ width: "100%", justifyContent: "space-between", fontSize: 10, padding: "6px 8px", marginBottom: 6 }}
                                onClick={() => setTrackerGroupCollapsed(prev => ({ ...prev, [groupName]: !prev[groupName] }))}
                              >
                                <span>{collapsed ? "▶" : "▼"} {groupName.toUpperCase()}</span>
                                <span>{groupRows.length}</span>
                              </button>
                              {!collapsed && groupRows.map((m) => {
                                const absoluteIdx = runningRank;
                                runningRank += 1;
                                const isExpanded = !!expandedTrackerMembers[m.memberId];
                                const dominance = grandTotal > 0 ? (m.total / grandTotal * 100) : 0;
                                const memberSessions = Object.values(m.sessions || {}).sort((a, b) => new Date(b.date) - new Date(a.date));
                                const latestCount = memberSessions[0]?.items?.length || 0;
                                const prevCount = memberSessions[1]?.items?.length || 0;
                                const drop = prevCount >= 2 && latestCount <= Math.max(0, Math.floor(prevCount * 0.4));
                                const spike = prevCount >= 1 && latestCount >= Math.ceil(prevCount * 1.8);
                                const latestMemberDate = memberSessions[0]?.date ? new Date(memberSessions[0].date).getTime() : 0;
                                const missingLast = latestSessionDate > 0 && latestMemberDate > 0 && latestMemberDate < latestSessionDate;
                                return (
                                  <TrackerMemberRow
                                    key={m.memberId}
                                    memberId={m.memberId}
                                    ign={m.ign}
                                    total={m.total}
                                    sessions={m.sessions}
                                    isExpanded={isExpanded}
                                    absoluteIdx={absoluteIdx}
                                    dominance={dominance}
                                    badgeColor={badgeColor}
                                    badgeBg={badgeBg}
                                    badgeBorder={badgeBorder}
                                    onToggle={toggleTrackerMember}
                                    compact={trackerCompactMode}
                                    anomalies={{ drop, spike, missingLast }}
                                  />
                                );
                              })}
                            </div>
                          );
                        })}
                     </>
                   );
                 })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    {pendingAuctionConflict && (
      <Modal
        title="Resolve Auction Conflict"
        onClose={() => resolveAuctionConflict("keep_local")}
        footer={(
          <>
            <button className="btn btn-ghost" onClick={() => resolveAuctionConflict("keep_local")}>Keep Mine</button>
            <button className="btn btn-primary" onClick={() => resolveAuctionConflict("apply_remote")}>Apply Remote</button>
          </>
        )}
      >
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
          Another officer saved Auction changes while you have local unsaved edits.
          <br /><br />
          {conflictSummary && (
            <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--accent)", marginBottom: 6 }}>DIFF SUMMARY</div>
              <div style={{ fontSize: 12 }}>
                Sessions: <strong>{conflictSummary.localSessionsCount}</strong> local vs <strong>{conflictSummary.remoteSessionsCount}</strong> remote
              </div>
              <div style={{ fontSize: 12 }}>
                Templates: <strong>{conflictSummary.localTemplatesCount}</strong> local vs <strong>{conflictSummary.remoteTemplatesCount}</strong> remote
              </div>
              <div style={{ fontSize: 12 }}>
                Resource Categories: <strong>{conflictSummary.localResourcesCount}</strong> local vs <strong>{conflictSummary.remoteResourcesCount}</strong> remote
              </div>
              {Array.isArray(conflictSummary.sessionNameChanges) && conflictSummary.sessionNameChanges.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                  Session name diffs: {conflictSummary.sessionNameChanges.join(", ")}
                </div>
              )}
              {Array.isArray(conflictSummary.templateNameChanges) && conflictSummary.templateNameChanges.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                  Template name diffs: {conflictSummary.templateNameChanges.join(", ")}
                </div>
              )}
            </div>
          )}
          <strong>Keep Mine</strong> keeps your local state (save when ready to overwrite remote).
          <br />
          <strong>Apply Remote</strong> discards local unsaved changes and loads latest shared Auction data.
        </div>
      </Modal>
    )}
    <ConfirmDangerModal
      open={!!confirmDeleteMapPage}
      title={`Delete Auction Page ${confirmDeleteMapPage || ""}?`}
      message={`This will remove all assignments under Page ${confirmDeleteMapPage || ""} for the selected map resource.`}
      token={DELETE_TOKEN}
      confirmLabel="Delete Page"
      onCancel={() => setConfirmDeleteMapPage(null)}
      onConfirm={() => executeDeleteMapPage(confirmDeleteMapPage)}
    />
    {showDiscordPreview && discordPreview && (
      <Modal
        title="Preview Discord Post"
        onClose={() => setShowDiscordPreview(false)}
        footer={(
          <>
            <button className="btn btn-ghost" onClick={() => setShowDiscordPreview(false)} disabled={postingDiscord}>Cancel</button>
            <button className="btn btn-primary" onClick={() => sendPreviewToDiscord(discordPreview)} disabled={postingDiscord}>
              <Icon name="discord" size={13} /> {postingDiscord ? "Posting..." : "Post Now"}
            </button>
          </>
        )}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Review image and message before posting to Discord.
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "rgba(0,0,0,0.25)" }}>
            <img src={discordPreview.previewUrl} alt="Auction preview" style={{ width: "100%", display: "block", maxHeight: 260, objectFit: "contain" }} />
          </div>
          <div style={{ background: "rgba(99,130,230,0.08)", border: "1px solid rgba(99,130,230,0.25)", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 10, color: "var(--accent)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Message Preview</div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11, color: "var(--text-primary)", lineHeight: 1.5, fontFamily: "inherit" }}>
              {discordPreview.message}
            </pre>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}

export default AuctionBuilder;
