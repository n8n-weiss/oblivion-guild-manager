import re

with open(r'src/pages/AuctionBuilder.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ── Fix 1: isCardColumn indentation + add isLDColumn ──────────────────────────
old1 = '                                                                 const isCardColumn = (colName = "") => (colName || "").toLowerCase().includes("card album");'
new1 = '  const isCardColumn = (colName = "") => (colName || "").toLowerCase().includes("card album");\n  const isLDColumn = (colName = "") => (colName || "").toLowerCase().includes("light") || (colName || "").toLowerCase().includes("dark") || (colName || "").toLowerCase().includes("l&d");'

if old1 in content:
    content = content.replace(old1, new1, 1)
    print("Fix 1 applied: isCardColumn fixed, isLDColumn added")
else:
    print("Fix 1 NOT FOUND — isCardColumn line not matched")

# ── Fix 2: Replace old tracker sections with World Master Tracker ──────────────
# Find the start marker and end marker
start_marker = '            {/* 2. Global Card Master Summary */}'
end_marker = "            </div>\n        )}"

start_idx = content.find(start_marker)
end_idx = content.rfind(end_marker)

if start_idx != -1 and end_idx != -1:
    new_tracker = '''            {/* 2. Global World Master Tracker (Cards + L&D Tabs) */}
            <div className="card custom-scrollbar" style={{ flex: 1, padding: 16, overflowY: "auto", background: "rgba(10,12,18,0.7)", display: "flex", flexDirection: "column" }}>
               <div className="card-title" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                 <Icon name="shield" size={14} color="var(--gold)" /> World Master Tracker
               </div>

               {/* Resource Tabs */}
               <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 8 }}>
                 <button
                   onClick={() => setTrackerTab("cards")}
                   style={{ flex: 1, padding: "5px", fontSize: 10, fontWeight: 900, borderRadius: 6, background: trackerTab === "cards" ? "var(--bg-card)" : "transparent", color: trackerTab === "cards" ? "var(--accent)" : "var(--text-muted)", border: "none", cursor: "pointer", transition: "all 0.2s" }}
                 >📖 CARDS</button>
                 <button
                   onClick={() => setTrackerTab("ld")}
                   style={{ flex: 1, padding: "5px", fontSize: 10, fontWeight: 900, borderRadius: 6, background: trackerTab === "ld" ? "var(--bg-card)" : "transparent", color: trackerTab === "ld" ? "#c080ff" : "var(--text-muted)", border: "none", cursor: "pointer", transition: "all 0.2s" }}
                 >✨ LIGHT & DARK</button>
               </div>

               <div style={{ position: "relative", marginBottom: 10 }}>
                  <input className="form-input" style={{ fontSize: 11, padding: "6px 28px", width: "100%", background: "rgba(0,0,0,0.3)" }} placeholder={`Search ${trackerTab === "cards" ? "cards" : "L&D"}...`} value={cardSearch} onChange={e => setCardSearch(e.target.value)} />
                  <div style={{ position: "absolute", left: 8, top: 7, opacity: 0.5 }}><Icon name="search" size={12} /></div>
               </div>

               <div className="space-y-1" style={{ flex: 1, overflowY: "auto" }}>
                 {(() => {
                   const historyMap = resourceHistory[trackerTab] || {};
                   const isLD = trackerTab === "ld";
                   const badgeColor = isLD ? "#c080ff" : "var(--gold)";
                   const badgeBg = isLD ? "rgba(180,100,250,0.1)" : "rgba(240,192,64,0.1)";
                   const badgeBorder = isLD ? "rgba(180,100,250,0.3)" : "rgba(240,192,64,0.3)";

                   const activeMembersWithResources = members
                     .map(m => ({ ...m, items: historyMap[m.memberId] || [] }))
                     .filter(m => {
                       if (!cardSearch) return m.items.length > 0;
                       return m.ign.toLowerCase().includes(cardSearch.toLowerCase()) ||
                         m.items.some(c => c.toLowerCase().includes(cardSearch.toLowerCase()));
                     })
                     .sort((a, b) => b.items.length - a.items.length);

                   if (activeMembersWithResources.length === 0) {
                     return (
                       <div className="text-xs text-muted py-8 text-center">
                         {isLD ? "No Light & Dark resources recorded." : "No card records found."}
                       </div>
                     );
                   }

                   return activeMembersWithResources.map(m => (
                     <div key={m.memberId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 4 }}>
                       <MemberAvatar ign={m.ign} size={24} />
                       <div style={{ flex: 1, minWidth: 0 }}>
                         <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)" }}>{m.ign}</div>
                         <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                           {m.items.map((item, idx) => (
                             <span key={idx} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}` }}>
                               {item}
                             </span>
                           ))}
                         </div>
                       </div>
                       <div style={{ fontSize: 14, fontWeight: 900, color: badgeColor, flexShrink: 0 }}>{m.items.length}</div>
                     </div>
                   ));
                 })()}
               </div>
            </div>
          </div>
        )}'''
    content = content[:start_idx] + new_tracker + content[end_idx + len(end_marker):]
    print("Fix 2 applied: World Master Tracker replaced old sections")
else:
    print(f"Fix 2 NOT FOUND — start_idx={start_idx}, end_idx={end_idx}")

with open(r'src/pages/AuctionBuilder.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done.")
