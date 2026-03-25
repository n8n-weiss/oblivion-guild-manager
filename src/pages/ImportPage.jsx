import React, { useState } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';

function ImportPage() {
  const { members, setMembers, showToast } = useGuild();
  const [preview, setPreview] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [imported, setImported] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError(""); setPreview([]); setImported(false);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { setError("The file is empty or too short."); return; }

      // 1. Detect Header and Separator by searching for the row with most keywords
      let headerIdx = -1;
      let sep = ",";
      let mapping = { ign: -1, cls: -1, uid: -1, role: -1, discord: -1, idCol: -1 };
      let finalRows = [];

      for (let i = 0; i < Math.min(15, lines.length); i++) {
        const line = lines[i];
        // Try each common separator
        for (const s of [",", "\t", ";"]) {
          const row = line.split(s).map(c => c.replace(/^"|"$/g, "").trim());
          const finds = {
            ign: row.findIndex(c => ["ign", "character", "name", "username"].includes(c.toLowerCase())),
            cls: row.findIndex(c => ["class", "job"].includes(c.toLowerCase())),
            uid: row.findIndex(c => ["uid", "member id", "id", "memberid"].includes(c.toLowerCase())),
            role: row.findIndex(c => ["role", "position"].includes(c.toLowerCase())),
            discord: row.findIndex(c => ["discord", "discord id", "discord username"].includes(c.toLowerCase())),
            idCol: row.findIndex(c => c === "#" || c.toLowerCase() === "no" || c.toLowerCase() === "no.")
          };
          const foundCount = Object.values(finds).filter(v => v !== -1).length;
          if (foundCount >= 3) {
            headerIdx = i;
            sep = s;
            mapping = finds;
            break;
          }
        }
        if (headerIdx !== -1) break;
      }

      if (headerIdx === -1) {
        setError("Bigo sa pag-detect ng format. Siguraduhin na may 'IGN', 'UID', at '#' columns ang inyong file.");
        return;
      }

      // 2. Split all lines using the detected separator
      finalRows = lines.map(l => l.split(sep).map(c => c.replace(/^"|"$/g, "").trim()));

      // 3. Parse Data
      const parsed = [];
      for (let i = headerIdx + 1; i < finalRows.length; i++) {
        const row = finalRows[i];
        if (!row || row.length < 3) continue;

        const ign = row[mapping.ign] || "";
        const memberId = row[mapping.uid] || "";
        
        // Skip summary or header repetitions
        if (!ign || !memberId || ign.toLowerCase() === "ign" || memberId.toLowerCase() === "uid") continue;
        if (ign.toLowerCase().includes("count") || ign === "0") continue;

        // Skip rows that don't have a valid positive ID if the ID column exists
        if (mapping.idCol !== -1) {
          const rawId = (row[mapping.idCol] || "").trim();
          const rowNumStr = rawId.replace(/[^0-9]/g, "");
          const rowNum = parseInt(rowNumStr, 10);
          if (isNaN(rowNum) || rowNum <= 0) continue;
          
          // Extra safety: If Column A is "1" but IGN is empty, it's not a real member
          if (!ign || ign === "0") continue;
        }

        const cls = mapping.cls !== -1 ? (row[mapping.cls] || "") : "";
        const roleStr = mapping.role !== -1 ? (row[mapping.role] || "") : "";
        const discord = mapping.discord !== -1 ? (row[mapping.discord] || "") : "";

        // Ensure the Member ID (UID) isn't just a word like "DPS" or "Role" accidentally mapped
        if (memberId.length < 3 || /^(dps|support|role|ign|rank|status)$/i.test(memberId)) continue;

        const normalizedRole = roleStr.toLowerCase().includes("support") || roleStr.toLowerCase().includes("utility") ? "Support" : "DPS";
        
        parsed.push({ memberId, ign, class: cls, role: normalizedRole, discord });
      }

      if (parsed.length === 0) {
        setError("Walang nahanap na member data. Siguraduhin na ang IGN at UID columns ay may laman.");
        return;
      }
      setPreview(parsed);
    };
    reader.readAsText(file);
  };

  const confirmImport = (mode) => {
    if (preview.length === 0) return;
    if (mode === "replace") {
      setMembers(preview);
      showToast(`${preview.length} members imported (replaced all)`, "success");
    } else {
      const merged = [...members];
      let added = 0, updated = 0;
      preview.forEach(p => {
        const idx = merged.findIndex(m => m.memberId === p.memberId);
        if (idx >= 0) { merged[idx] = p; updated++; } else { merged.push(p); added++; }
      });
      setMembers(merged);
      showToast(`Import done: ${added} added, ${updated} updated`, "success");
    }
    setImported(true); setPreview([]); setFileName("");
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📥 Import CSV / Spreadsheet</h1>
        <p className="page-subtitle">I-import ang Members list gamit ang bago nating Universal Parser</p>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">📋 Paano mag-import nang tama</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
          <div>Para hindi malito ang system, ito ang subukan mo:</div>
          <div style={{ marginTop: 8, padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 6, fontFamily: "monospace", fontSize: 11 }}>
            #, IGN, Class, UID, Role, Discord<br />
            1, Ebakook, High Wizard, OBL335675, DPS, taegamingsaaa<br />
            2, Pulube22, Creator, OBL404266, DPS, weissgaming
          </div>
          <div style={{ marginTop: 8 }}>1. Sa Google Sheets, **File → Download → .csv**</div>
          <div>2. Siguraduhin na ang columns ay may header na **#, IGN, UID** sa mismong data row.</div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">📍 Upload File</div>
        <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "32px 20px", border: "2px dashed var(--border-bright)", borderRadius: 12, cursor: "pointer", background: "rgba(99,130,230,0.03)" }}>
          <div style={{ fontSize: 32 }}>📄</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{fileName || "I-click para pumili ng CSV o TSV file"}</div>
          <div className="text-xs text-muted">Awtomatikong nade-detect ang format at separator (Comma, Tab, Semicolon)</div>
          <input type="file" accept=".csv,.tsv,.txt" style={{ display: "none" }} onChange={handleFile} />
        </label>
        {error && <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(224,80,80,0.1)", border: "1px solid rgba(224,80,80,0.3)", borderRadius: 8, color: "var(--red)", fontSize: 13 }}>⚠️ {error}</div>}
        {imported && <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(64,201,122,0.1)", border: "1px solid rgba(64,201,122,0.3)", borderRadius: 8, color: "var(--green)", fontSize: 13 }}>✅ Import successful!</div>}
      </div>
      {preview.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="card-title" style={{ marginBottom: 4 }}>👀 Preview — {preview.length} members found</div>
              <div className="text-xs text-muted">I-check kung tama ang data bago i-confirm. Kung may maling information (katulad nung Weiss 456463), paki-check ang headers ng iyong file.</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => confirmImport("merge")}>🔄 Merge</button>
              <button className="btn btn-primary" onClick={() => confirmImport("replace")}>♻️ Replace All</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Member ID</th><th>IGN</th><th>Class</th><th>Role</th><th>Discord</th></tr></thead>
              <tbody>
                {preview.map((m, i) => (
                  <tr key={i}>
                    <td><span className="font-cinzel text-xs text-muted">{m.memberId}</span></td>
                    <td><span style={{ fontWeight: 700 }}>{m.ign}</span></td>
                    <td className="text-secondary">{m.class}</td>
                    <td><span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`}>{m.role}</span></td>
                    <td className="text-xs text-muted">{m.discord || <span style={{ opacity: 0.3 }}>N/A</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(240,192,64,0.06)", border: "1px solid rgba(240,192,64,0.2)", borderRadius: 8, fontSize: 12, color: "var(--text-muted)" }}>
            💡 <strong style={{ color: "var(--gold)" }}>Merge</strong> — i-update ang existing at idagdag ang bago.<br />
            💡 <strong style={{ color: "var(--accent)" }}>Replace All</strong> — burahin lahat at palitan ng nasa CSV.
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportPage;
