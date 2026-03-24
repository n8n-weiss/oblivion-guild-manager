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
      const rows = text.split("\n").map(r => r.split(",").map(c => c.replace(/^"|"$/g, "").trim()));
      const parsed = [];
      for (let i = 3; i < rows.length; i++) {
        const row = rows[i];
        const ign = row[1], cls = row[2], memberId = row[3], role = row[4];
        if (!ign || !memberId) continue;
        const normalizedRole = role?.toLowerCase().includes("support") || role?.toLowerCase().includes("utility") ? "Support" : "DPS";
        parsed.push({ memberId, ign, class: cls || "", role: normalizedRole });
      }
      if (parsed.length === 0) { setError("Walang nahanap na data. I-check kung tama ang format ng CSV."); return; }
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
        <h1 className="page-title">📥 Import CSV</h1>
        <p className="page-subtitle">I-import ang Members list mula sa Google Sheets</p>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">📋 Paano mag-export mula sa Google Sheets</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
          <div>1. Buksan ang Google Sheets → Members sheet</div>
          <div>2. <strong>File → Download → Comma Separated Values (.csv)</strong></div>
          <div>3. I-upload ang CSV file dito</div>
        </div>
        <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(99,130,230,0.06)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div className="text-xs text-muted" style={{ marginBottom: 8, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>Expected Format</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace", lineHeight: 1.8 }}>
            <div>Row 1-3: Headers (isi-skip)</div>
            <div>Column B: IGN</div>
            <div>Column C: Class</div>
            <div>Column D: Member ID</div>
            <div>Column E: Role (DPS / Support)</div>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">📍 Upload CSV File</div>
        <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "32px 20px", border: "2px dashed var(--border-bright)", borderRadius: 12, cursor: "pointer", background: "rgba(99,130,230,0.03)" }}>
          <div style={{ fontSize: 32 }}>📄</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{fileName || "I-click para pumili ng CSV file"}</div>
          <div className="text-xs text-muted">Supports .csv files mula sa Google Sheets</div>
          <input type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
        </label>
        {error && <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(224,80,80,0.1)", border: "1px solid rgba(224,80,80,0.3)", borderRadius: 8, color: "var(--red)", fontSize: 13 }}>⚠️ {error}</div>}
        {imported && <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(64,201,122,0.1)", border: "1px solid rgba(64,201,122,0.3)", borderRadius: 8, color: "var(--green)", fontSize: 13 }}>✅ Import successful! Pumunta sa Members tab para makita.</div>}
      </div>
      {preview.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="card-title" style={{ marginBottom: 4 }}>👀 Preview — {preview.length} members found</div>
              <div className="text-xs text-muted">I-check kung tama ang data bago i-confirm ang import</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => confirmImport("merge")}>🔄 Merge</button>
              <button className="btn btn-primary" onClick={() => confirmImport("replace")}>♻️ Replace All</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Member ID</th><th>IGN</th><th>Class</th><th>Role</th></tr></thead>
              <tbody>
                {preview.map((m, i) => (
                  <tr key={i}>
                    <td><span className="font-cinzel text-xs text-muted">{m.memberId}</span></td>
                    <td><span style={{ fontWeight: 700 }}>{m.ign}</span></td>
                    <td className="text-secondary">{m.class}</td>
                    <td><span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`}>{m.role}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(240,192,64,0.06)", border: "1px solid rgba(240,192,64,0.2)", borderRadius: 8, fontSize: 12, color: "var(--text-muted)" }}>
            💡 <strong style={{ color: "var(--gold)" }}>Merge</strong> — mag-a-update ng existing at magda-dagdag ng bago. Hindi mabubura ang current data.<br />
            💡 <strong style={{ color: "var(--accent)" }}>Replace All</strong> — mabubura lahat at papalitan ng CSV data.
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportPage;
