import React, { useState } from 'react';
import { useGuild } from '../context/GuildContext';
import Icon from '../components/ui/icons';
import DiscordSettings from '../components/common/DiscordSettings';
import ConfirmDangerModal from '../components/common/ConfirmDangerModal';
import StatePanel from '../components/common/StatePanel';

function ImportPage() {
  const { members, setMembers, showToast, isArchitect, exportBackupSnapshot, restoreBackupSnapshot, backfillBattleBuckets, estimateBattleBucketBackfill } = useGuild();
  const CONFIRM_TOKEN = "RESTORE";
  const [preview, setPreview] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [imported, setImported] = useState(false);
  const [defaultJoinDate, setDefaultJoinDate] = useState("");
  const [protectExistingData, setProtectExistingData] = useState(true);
  const [activeTab, setActiveTab] = useState("import");
  const [backupMode, setBackupMode] = useState("replace");
  const [restorePreview, setRestorePreview] = useState(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [backfillingBuckets, setBackfillingBuckets] = useState(false);
  const [estimatingBuckets, setEstimatingBuckets] = useState(false);
  const [bucketEstimate, setBucketEstimate] = useState(null);

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
            joinDate: row.findIndex(c => ["join date", "joined", "joindate"].includes(c.toLowerCase())),
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
        if (!ign || ign.toLowerCase() === "ign" || (memberId && memberId.toLowerCase() === "uid")) continue;
        if (ign.toLowerCase().includes("count") || ign === "0" || ign.toLowerCase().includes("total")) continue;

        // Provide a fallback UID if missing so the member isn't skipped
        let finalUid = memberId;
        if (!finalUid || finalUid.toLowerCase() === "n/a" || finalUid === "-") {
          finalUid = `TEMP-${ign.replace(/[^a-zA-Z0-9]/g, "").substring(0, 6).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
        }

        // We won't strictly enforce '#' sequence numbers because new members might not have them yet.
        if (mapping.idCol !== -1) {
          const rawId = (row[mapping.idCol] || "").trim().toLowerCase();
          if (rawId.includes("total") || rawId.includes("count")) continue;
        }

        const cls = mapping.cls !== -1 ? (row[mapping.cls] || "") : "";
        const roleStr = mapping.role !== -1 ? (row[mapping.role] || "") : "";
        const discord = mapping.discord !== -1 ? (row[mapping.discord] || "") : "";

        // Ensure the UID isn't just a word accidentally mapped
        if (finalUid.length < 3 || /^(dps|support|role|ign|rank|status)$/i.test(finalUid)) continue;

        const normalizedRole = roleStr.toLowerCase().includes("support") || roleStr.toLowerCase().includes("utility") ? "Support" : "DPS";
        const jd = mapping.joinDate !== -1 ? (row[mapping.joinDate] || defaultJoinDate) : defaultJoinDate;

        parsed.push({ memberId: finalUid, ign, class: cls, role: normalizedRole, discord, joinDate: jd });
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
      setShowReplaceConfirm(true);
    } else {
      const merged = [...members];
      let added = 0, updated = 0;
      preview.forEach(p => {
        const idx = merged.findIndex(m => m.memberId === p.memberId);
        if (idx >= 0) {
          // Preserve app-managed fields (guildRank, status, etc.)
          if (protectExistingData) {
            // "Smart Merge": Keep existing critical fields (approved by portal)
            merged[idx] = { 
              ...merged[idx], 
              discord: p.discord || merged[idx].discord, 
              joinDate: (p.joinDate && p.joinDate !== defaultJoinDate) ? p.joinDate : merged[idx].joinDate 
              // Notice we SKIP p.ign, p.class, p.role
            };
          } else {
            // "Overwrite Merge": CSV takes precedence
            merged[idx] = { ...merged[idx], ...p };
          }
          updated++;
        } else {
          merged.push(p);
          added++;
        }
      });
      setMembers(merged);
      showToast(`Import done: ${added} added, ${updated} updated`, "success");
      setImported(true); setPreview([]); setFileName("");
    }
  };

  const exportToCSV = () => {
    try {
      if (members.length === 0) { showToast("No members to export", "error"); return; }
      const headers = ["#", "IGN", "UID", "Class", "Role", "Discord", "Join Date", "Rank", "Status"];
      const rows = members.map((m, i) => [
        i + 1,
        m.ign,
        m.memberId,
        m.class,
        m.role,
        m.discord || "",
        m.joinDate || "",
        m.guildRank || "Member",
        m.status || "active"
      ]);
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${(cell + "").replace(/"/g, '""')}"`).join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `oblivion_roster_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Roster exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed", "error");
    }
  };

  const downloadBackup = async () => {
    try {
      const snapshot = await exportBackupSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json;charset=utf-8" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `oblivion_backup_${new Date().toISOString().split("T")[0]}.json`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Backup exported", "success");
    } catch (err) {
      console.error(err);
      showToast("Backup export failed", "error");
    }
  };

  const downloadJsonFile = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      setRestorePreview({
        fileName: file.name,
        payload,
        counts: {
          roster: Array.isArray(payload?.roster) ? payload.roster.length : 0,
          events: Array.isArray(payload?.events) ? payload.events.length : 0,
          absences: Array.isArray(payload?.absences) ? payload.absences.length : 0,
          metadataDocs: ["parties", "auction", "discord"].filter(k => payload?.metadata?.[k]).length
        }
      });
    } catch (err) {
      console.error(err);
      showToast("Backup restore failed (invalid file or data)", "error");
    } finally {
      e.target.value = "";
    }
  };

  const confirmRestorePreview = async () => {
    if (!restorePreview?.payload) return;
    setShowRestoreConfirm(true);
  };

  const doReplaceImport = () => {
    setMembers(preview);
    showToast(`${preview.length} members imported (replaced all)`, "success");
    setImported(true);
    setPreview([]);
    setFileName("");
    setShowReplaceConfirm(false);
  };

  const doRestore = async () => {
    try {
      // Safety net: auto-export current live state before applying incoming restore file.
      const safetySnapshot = await exportBackupSnapshot();
      downloadJsonFile(safetySnapshot, `oblivion_pre_restore_backup_${new Date().toISOString().split("T")[0]}.json`);
      await restoreBackupSnapshot(restorePreview.payload, backupMode);
      showToast("Backup restore completed (safety backup exported first)", "success");
      setRestorePreview(null);
      setShowRestoreConfirm(false);
    } catch (err) {
      console.error(err);
      showToast("Backup restore failed", "error");
    }
  };
  const handleBackfillBuckets = async () => {
    try {
      setBackfillingBuckets(true);
      const result = await backfillBattleBuckets();
      showToast(`Bucket backfill complete (${result?.totalBucketDocs || 0} docs written)`, "success");
    } catch (err) {
      console.error(err);
      showToast("Bucket backfill failed", "error");
    } finally {
      setBackfillingBuckets(false);
    }
  };
  const handleEstimateBuckets = React.useCallback(async () => {
    try {
      setEstimatingBuckets(true);
      const estimate = await estimateBattleBucketBackfill();
      setBucketEstimate(estimate);
      showToast(`Estimated ${estimate?.totalBucketDocs || 0} bucket docs`, "info");
    } catch (err) {
      console.error(err);
      showToast("Bucket estimate failed", "error");
    } finally {
      setEstimatingBuckets(false);
    }
  }, [estimateBattleBucketBackfill, showToast]);
  React.useEffect(() => {
    if (!isArchitect || activeTab !== "backup") return;
    if (estimatingBuckets || backfillingBuckets) return;
    if (bucketEstimate) return;
    handleEstimateBuckets();
  }, [isArchitect, activeTab, estimatingBuckets, backfillingBuckets, bucketEstimate, handleEstimateBuckets]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📥 Import CSV / Spreadsheet</h1>
        <p className="page-subtitle">Manage roster data and system integrations</p>
      </div>

      <div className="tabs mb-6 sticky-actions">
        <button className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>📥 Import</button>
        <button className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`} onClick={() => setActiveTab('export')}>📤 Export</button>
        <button className={`tab-btn ${activeTab === 'discord' ? 'active' : ''}`} onClick={() => setActiveTab('discord')}>🤖 Discord</button>
        {isArchitect && (
          <button className={`tab-btn ${activeTab === 'backup' ? 'active' : ''}`} onClick={() => setActiveTab('backup')}>🧰 Backup</button>
        )}
      </div>

      {activeTab === 'import' && (
        <div className="animate-fade-in">
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">📋 Paano mag-import nang tama</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
              <div>Para hindi malito ang system, ito ang dapat content ng CSV file mo:</div>
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
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "32px 20px", border: "2px dashed var(--border-bright)", borderRadius: 12, cursor: "pointer", background: "rgba(99,130,230,0.03)", marginBottom: 12 }}>
              <div style={{ fontSize: 32 }}>📄</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{fileName || "I-click para pumili ng CSV o TSV file"}</div>
              <div className="text-xs text-muted">Awtomatikong nade-detect ang format at separator (Comma, Tab, Semicolon)</div>
              <input type="file" accept=".csv,.tsv,.txt" style={{ display: "none" }} onChange={handleFile} />
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: "rgba(240,192,64,0.05)", borderRadius: 8, border: "1px solid rgba(240,192,64,0.1)" }}>
              <div style={{ fontSize: 18 }}>🛡️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>DEFAULT JOIN DATE</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Gagamitin ito kapag walang 'Join Date' column sa iyong file.</div>
              </div>
              <input type="date" className="form-input" style={{ width: "auto", padding: "4px 8px" }} value={defaultJoinDate} onChange={e => setDefaultJoinDate(e.target.value)} />
            </div>

            {error && <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(224,80,80,0.1)", border: "1px solid rgba(224,80,80,0.3)", borderRadius: 8, color: "var(--red)", fontSize: 13 }}>⚠️ {error}</div>}
            {imported && <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(64,201,122,0.1)", border: "1px solid rgba(64,201,122,0.3)", borderRadius: 8, color: "var(--green)", fontSize: 13 }}>✅ Import successful!</div>}
          </div>
        </div>
      )}

      {activeTab === 'export' && (
        <div className="animate-fade-in">
          <div className="card" style={{ marginBottom: 20, background: "rgba(99,130,230,0.05)", border: "1px solid var(--accent)" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="card-title mb-1">📤 Export Portal Data</div>
                <div className="text-xs text-muted">I-download ang latest roster mula sa Portal para ma-update ang inyong Master Spreadsheet.</div>
              </div>
              <button className="btn btn-primary" onClick={exportToCSV}>
                <Icon name="save" size={12} /> Download Current Roster
              </button>
            </div>
            {members.length === 0 && (
              <div style={{ marginTop: 12 }}>
                <StatePanel
                  icon="📤"
                  title="No members to export yet"
                  description="Import roster data first, then export current portal roster."
                  tone="warning"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className={activeTab === 'discord' ? 'animate-fade-in' : 'hidden'}>
        <DiscordSettings />
      </div>

      {activeTab === 'backup' && isArchitect && (
        <div className="animate-fade-in">
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">🧰 Backup / Restore (Architect)</div>
            <div className="text-xs text-muted" style={{ marginBottom: 14 }}>
              Includes: roster, events, absences, and metadata split docs (parties/auction/discord).
            </div>
            <div className="flex gap-2" style={{ marginBottom: 14 }}>
              <button className="btn btn-primary" onClick={downloadBackup}>
                <Icon name="save" size={12} /> Export Full Backup
              </button>
              <button className="btn btn-ghost" onClick={handleEstimateBuckets} disabled={estimatingBuckets || backfillingBuckets}>
                <Icon name="search" size={12} /> {estimatingBuckets ? "Estimating..." : "Estimate Backfill"}
              </button>
              <button className="btn btn-ghost" onClick={handleBackfillBuckets} disabled={backfillingBuckets}>
                <Icon name="refresh" size={12} /> {backfillingBuckets ? "Backfilling..." : "Backfill Battle Buckets"}
              </button>
            </div>
            <div className="text-xs text-muted" style={{ marginBottom: 10 }}>
              Backfill copies legacy attendance/performance/eo docs into monthly bucket docs for faster scoped reads.
            </div>
            {bucketEstimate && (
              <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, border: "1px solid rgba(99,130,230,0.35)", background: "rgba(99,130,230,0.08)", fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <strong>Dry-run estimate:</strong> {bucketEstimate.totalBucketDocs} docs
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleEstimateBuckets}
                    disabled={estimatingBuckets || backfillingBuckets}
                    style={{ padding: "2px 8px", fontSize: 11 }}
                  >
                    {estimatingBuckets ? "Refreshing..." : "Refresh estimate"}
                  </button>
                </div>
                {" "}(<span>attendance {bucketEstimate.attendanceEligible}</span>,{" "}
                <span>performance {bucketEstimate.performanceEligible}</span>,{" "}
                <span>eo {bucketEstimate.eoEligible}</span>)
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <label className="text-xs font-bold">Restore Mode</label>
              <select className="form-select" style={{ width: 180 }} value={backupMode} onChange={e => setBackupMode(e.target.value)}>
                <option value="replace">Replace (overwrite)</option>
                <option value="merge">Merge (upsert)</option>
              </select>
            </div>
            <label className="btn btn-danger" style={{ width: "fit-content", cursor: "pointer" }}>
              <Icon name="upload" size={12} /> Restore From Backup JSON
              <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleRestoreFile} />
            </label>
            {restorePreview && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(240,192,64,0.08)", border: "1px solid rgba(240,192,64,0.25)" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--gold)", marginBottom: 8 }}>
                  Restore Dry-Run Preview
                </div>
                <div className="text-xs text-muted" style={{ marginBottom: 8 }}>
                  File: {restorePreview.fileName}
                </div>
                <div className="text-xs" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                  <span>Roster: <strong>{restorePreview.counts.roster}</strong></span>
                  <span>Events: <strong>{restorePreview.counts.events}</strong></span>
                  <span>Absences: <strong>{restorePreview.counts.absences}</strong></span>
                  <span>Metadata Docs: <strong>{restorePreview.counts.metadataDocs}</strong></span>
                </div>
                <div className="text-xs text-muted" style={{ marginBottom: 10 }}>
                  Mode impact: {backupMode === "replace" ? "Current roster/events/absences will be overwritten." : "Backup data will be merged into current data."}
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-danger btn-sm" onClick={confirmRestorePreview}>Confirm Restore</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setRestorePreview(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'import' && preview.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="card-title" style={{ marginBottom: 4 }}>👀 Preview — {preview.length} members found</div>
              <div className="text-xs text-muted">I-check kung tama ang data bago i-confirm. Kung may maling information (katulad nung Weiss 456463), paki-check ang headers ng iyong file.</div>
            </div>
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 cursor-pointer" title="Kapag naka-ON, hindi mapapalitan ang IGN, Class, at Role ng existing members.">
                <input type="checkbox" checked={protectExistingData} onChange={e => setProtectExistingData(e.target.checked)} />
                <span className="text-xs font-bold" style={{ color: protectExistingData ? "var(--green)" : "var(--gold)" }}>
                  {protectExistingData ? "🛡️ Smart Merge Protected" : "⚠️ Overwrite Enabled"}
                </span>
              </label>
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={() => confirmImport("merge")}>🔄 Confirm Merge</button>
                {isArchitect && (
                  <button className="btn btn-danger" onClick={() => confirmImport("replace")}>⚠️ Replace All</button>
                )}
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Member ID</th><th>IGN</th><th>Class</th><th>Role</th><th>Discord</th><th>Join Date</th></tr></thead>
              <tbody>
                {preview.map((m, i) => (
                  <tr key={i}>
                    <td><span className="font-cinzel text-xs text-muted">{m.memberId}</span></td>
                    <td><span style={{ fontWeight: 700 }}>{m.ign}</span></td>
                    <td className="text-secondary">{m.class}</td>
                    <td><span className={`badge ${m.role === "DPS" ? "badge-dps" : "badge-support"}`}>{m.role}</span></td>
                    <td className="text-xs text-muted">{m.discord || <span style={{ opacity: 0.3 }}>N/A</span>}</td>
                    <td><span className="badge badge-casual" style={{ fontSize: 10 }}>{m.joinDate}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(240,192,64,0.06)", border: "1px solid rgba(240,192,64,0.2)", borderRadius: 8, fontSize: 12, color: "var(--text-muted)" }}>
            💡 <strong style={{ color: "var(--gold)" }}>Merge</strong> — i-update ang existing members. (Kapag naka-ON ang <strong>🛡️ Smart Merge</strong>, hindi mapapalitan ang approved IGN/Class/Role ng existing members).<br />
            {isArchitect ? (
              <>💡 <strong style={{ color: "var(--red)" }}>Replace All</strong> — <span style={{ color: "var(--red)", fontWeight: 800 }}>MABURA LAHAT</span> ng current members at mapapalitan ng CSV data. Gamitin lamang kung magsa-start over.</>
            ) : (
              <>💡 <span style={{ opacity: 0.5 }}>Replace All option is restricted to System Architect only.</span></>
            )}
          </div>
        </div>
      )}
      <ConfirmDangerModal
        open={showReplaceConfirm}
        title="Replace All Members?"
        message="This will delete all current member entries and replace them with CSV preview data."
        token={CONFIRM_TOKEN}
        confirmLabel="Replace All"
        onCancel={() => setShowReplaceConfirm(false)}
        onConfirm={doReplaceImport}
      />
      <ConfirmDangerModal
        open={showRestoreConfirm}
        title={`Confirm Restore (${backupMode === "replace" ? "Replace" : "Merge"})`}
        message={
          backupMode === "replace"
            ? "Restore replace mode will overwrite current roster/events/absences."
            : "Restore merge mode will upsert backup records into current data."
        }
        token={CONFIRM_TOKEN}
        confirmLabel="Run Restore"
        onCancel={() => setShowRestoreConfirm(false)}
        onConfirm={doRestore}
      />
    </div>
  );
}

export default ImportPage;
