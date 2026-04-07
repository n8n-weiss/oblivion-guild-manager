const fs = require('fs');
let content = fs.readFileSync('src/pages/AuctionBuilder.jsx', 'utf8');
const lines = content.split('\n');

// Fix 1: Find and fix the isCardColumn line (line 152, index 151)
const targetLineIdx = lines.findIndex(l => l.includes('const isCardColumn') && l.includes('card album'));
if (targetLineIdx !== -1) {
  console.log('Found isCardColumn at line', targetLineIdx + 1);
  lines[targetLineIdx] = '  const isCardColumn = (colName = "") => (colName || "").toLowerCase().includes("card album");';
  // Insert isLDColumn right after
  lines.splice(targetLineIdx + 1, 0, '  const isLDColumn = (colName = "") => (colName || "").toLowerCase().includes("light") || (colName || "").toLowerCase().includes("dark");');
  console.log('Fix 1 applied');
} else {
  console.log('Fix 1 NOT FOUND');
}

content = lines.join('\n');

// Fix 2: Replace old tracker sections with World Master Tracker
const startMarker = '            {/* 2. Global Card Master Summary */}';
const startIdx = content.indexOf(startMarker);
// Find the closing of the sidebar div: "          </div>\n        )}"
const endTarget = '          </div>\n        )}';
const endIdx = content.lastIndexOf(endTarget);

console.log('Fix 2 startIdx:', startIdx, 'endIdx:', endIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newTracker = `            {/* 2. Global World Master Tracker */}
            <div className="card custom-scrollbar" style={{ flex: 1, padding: 16, overflowY: "auto", background: "rgba(10,12,18,0.7)", display: "flex", flexDirection: "column" }}>
               <div className="card-title" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                 <Icon name="shield" size={14} color="var(--gold)" /> World Master Tracker
               </div>
               <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 8 }}>
                 <button onClick={() => setTrackerTab("cards")} style={{ flex: 1, padding: "5px", fontSize: 10, fontWeight: 900, borderRadius: 6, background: trackerTab === "cards" ? "var(--bg-card)" : "transparent", color: trackerTab === "cards" ? "var(--accent)" : "var(--text-muted)", border: "none", cursor: "pointer", transition: "all 0.2s" }}>CARDS</button>
                 <button onClick={() => setTrackerTab("ld")} style={{ flex: 1, padding: "5px", fontSize: 10, fontWeight: 900, borderRadius: 6, background: trackerTab === "ld" ? "var(--bg-card)" : "transparent", color: trackerTab === "ld" ? "#c080ff" : "var(--text-muted)", border: "none", cursor: "pointer", transition: "all 0.2s" }}>LIGHT + DARK</button>
               </div>
               <div style={{ position: "relative", marginBottom: 10 }}>
                  <input className="form-input" style={{ fontSize: 11, padding: "6px 28px", width: "100%", background: "rgba(0,0,0,0.3)" }} placeholder={trackerTab === "cards" ? "Search cards..." : "Search L+D..."} value={cardSearch} onChange={e => setCardSearch(e.target.value)} />
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
                       return m.ign.toLowerCase().includes(cardSearch.toLowerCase()) || m.items.some(c => c.toLowerCase().includes(cardSearch.toLowerCase()));
                     })
                     .sort((a, b) => b.items.length - a.items.length);
                   if (activeMembersWithResources.length === 0) {
                     return <div className="text-xs text-muted py-8 text-center">{isLD ? "No Light & Dark resources recorded." : "No card records found."}</div>;
                   }
                   return activeMembersWithResources.map(m => (
                     <div key={m.memberId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 4 }}>
                       <MemberAvatar ign={m.ign} size={24} />
                       <div style={{ flex: 1, minWidth: 0 }}>
                         <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)" }}>{m.ign}</div>
                         <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                           {m.items.map((item, idx) => (
                             <span key={idx} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: badgeBg, color: badgeColor, border: \`1px solid \${badgeBorder}\` }}>{item}</span>
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
        )}`;

  content = content.slice(0, startIdx) + newTracker + content.slice(endIdx + endTarget.length);
  console.log('Fix 2 applied');
} else {
  console.log('Fix 2 NOT FOUND - trying alternate end marker...');
  // Log what's near startIdx
  if (startIdx !== -1) {
    console.log('Content after startIdx (500 chars):', JSON.stringify(content.slice(startIdx, startIdx + 200)));
    console.log('Last 200 chars of file:', JSON.stringify(content.slice(-200)));
  }
}

fs.writeFileSync('src/pages/AuctionBuilder.jsx', content, 'utf8');
console.log('Done. Total lines:', content.split('\n').length);
