import React, { useState, useEffect } from 'react';
import { useGuild } from '../../context/GuildContext';
import Icon from '../ui/icons';
import Modal from '../ui/Modal';

const DEFAULT_NOTIFICATIONS = {
  join_requests: { enabled: true, webhookUrl: "", mentions: { master: true, officer: true, oblivion: false, member: false } },
  welcome: { enabled: true, webhookUrl: "", mentions: { member: true } },
  vanguard: { enabled: true, webhookUrl: "", mentions: { officer: true } },
  events: { enabled: true, webhookUrl: "", mentions: {} },
  event_digest: { enabled: true, webhookUrl: "", mentions: {} },
  absences: { enabled: true, webhookUrl: "", mentions: { officer: true, member: true } },
  auction_results: { enabled: true, webhookUrl: "", mentions: {} }
};

const DEFAULT_TEMPLATES = {
  new_join: { title: "", description: "" },
  welcome: { title: "", description: "" },
  vanguard: { title: "", description: "" },
  event_created: { title: "", description: "" },
  event_digest: { title: "", description: "" },
  absence_filed: { title: "", description: "" },
  absence_removed: { title: "", description: "" },
  auction_results: { title: "", description: "" }
};

const normalizeDiscordConfig = (cfg = {}) => {
  const inputNotifs = cfg.notifications || {};
  const inputTemplates = cfg.templates || {};
  const notifications = Object.entries(DEFAULT_NOTIFICATIONS).reduce((acc, [key, fallback]) => {
    const candidate = inputNotifs[key] || {};
    acc[key] = {
      ...fallback,
      ...candidate,
      mentions: { ...(fallback.mentions || {}), ...(candidate.mentions || {}) }
    };
    return acc;
  }, {});

  const templates = Object.entries(DEFAULT_TEMPLATES).reduce((acc, [key, fallback]) => {
    acc[key] = { ...fallback, ...(inputTemplates[key] || {}) };
    return acc;
  }, {});

  return {
    webhookUrl: cfg.webhookUrl || "",
    masterRoleId: cfg.masterRoleId || "",
    officerRoleId: cfg.officerRoleId || "",
    oblivionRoleId: cfg.oblivionRoleId || "",
    notifications,
    templates
  };
};

const DiscordSettings = () => {
  const { discordConfig, setDiscordConfig, showToast, isArchitect } = useGuild();
  const normalizedRemoteConfig = React.useMemo(() => normalizeDiscordConfig(discordConfig), [discordConfig]);
  const [localConfig, setLocalConfig] = useState(() => normalizedRemoteConfig);
  const [activeSection, setActiveSection] = useState("general");
  const [isTesting, setIsTesting] = useState(false);
  const [pendingRemoteConfig, setPendingRemoteConfig] = useState(null);

  const lastSyncedConfig = React.useRef(JSON.stringify(normalizedRemoteConfig));
  const DRAFT_KEY = "draft_discord_settings_v1";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.data) return;
      const normalizedDraft = normalizeDiscordConfig(parsed.data);
      const currentSynced = normalizeDiscordConfig(discordConfig);
      // Skip stale draft prompt when draft is same as current synced config.
      if (JSON.stringify(normalizedDraft) === JSON.stringify(currentSynced)) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const shouldRestore = window.confirm("Restore unsaved Discord Settings draft?");
      if (shouldRestore) {
        setLocalConfig(normalizedDraft);
        showToast("Draft restored", "info");
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [discordConfig, showToast]);

  useEffect(() => {
    // Only update local config if the user hasn't made any unsaved changes,
    // or if we just performed a save (in which case they will be equal again).
    const isLocalSameAsLastSync = JSON.stringify(localConfig) === lastSyncedConfig.current;
    
    const remoteString = JSON.stringify(normalizedRemoteConfig);
    // If the server data has changed since our last sync
    if (lastSyncedConfig.current !== remoteString) {
      if (isLocalSameAsLastSync) {
        // User hasn't touched anything, safe to update to the latest server data
        setLocalConfig(normalizedRemoteConfig);
        lastSyncedConfig.current = remoteString;
        setPendingRemoteConfig(null);
        return;
      }
      // User has unsaved changes and remote changed: keep local, ask explicit resolution.
      setPendingRemoteConfig(normalizedRemoteConfig);
      showToast("Remote Discord config updated by another officer. Resolve conflict.", "warning");
    }
  }, [normalizedRemoteConfig, localConfig, showToast]);

  useEffect(() => {
    const localString = JSON.stringify(localConfig);
    if (localString !== lastSyncedConfig.current) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: localConfig, ts: Date.now() }));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [localConfig]);

  if (!isArchitect) return null;

  const handleSave = () => {
    setDiscordConfig(normalizeDiscordConfig(localConfig));
    localStorage.removeItem(DRAFT_KEY);
    showToast("Discord configuration saved!", "success");
  };

  const validateDiscordConfig = () => {
    const cfg = normalizeDiscordConfig(localConfig);
    const issues = [];
    // Accept official Discord webhook domains and common token formats.
    const webhookRegex = /^https:\/\/(?:(?:canary|ptb)\.)?discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/i;
    const normalizeWebhook = (url = "") => String(url || "").trim();
    const isWebhookValid = (url = "") => {
      const value = normalizeWebhook(url);
      return value.length > 0 && webhookRegex.test(value);
    };
    const hasGlobalWebhook = isWebhookValid(cfg.webhookUrl);

    if (!hasGlobalWebhook) {
      issues.push("Global webhook URL is missing or invalid.");
    }

    Object.entries(cfg.notifications || {}).forEach(([cat, catCfg]) => {
      if (!catCfg?.enabled) return;
      const override = normalizeWebhook(catCfg.webhookUrl);
      if (override && !isWebhookValid(override)) {
        issues.push(`[${cat}] Override webhook format looks invalid.`);
        return;
      }
      if (!override && !hasGlobalWebhook) {
        issues.push(`[${cat}] Enabled but no valid global or override webhook.`);
      }
    });

    if (issues.length === 0) {
      showToast("Discord config looks valid for all enabled categories.", "success");
      return;
    }

    showToast(`${issues[0]} ${issues.length > 1 ? `(+${issues.length - 1} more)` : ""}`, "warning");
    window.alert(`Discord Config Validation\n\n${issues.map((x, i) => `${i + 1}. ${x}`).join("\n")}`);
  };

  const applyRemoteConfig = () => {
    if (!pendingRemoteConfig) return;
    setLocalConfig(normalizeDiscordConfig(pendingRemoteConfig));
    lastSyncedConfig.current = JSON.stringify(pendingRemoteConfig);
    setPendingRemoteConfig(null);
    localStorage.removeItem(DRAFT_KEY);
    showToast("Applied latest remote config", "info");
  };

  const keepLocalConfig = () => {
    if (!pendingRemoteConfig) return;
    // Advance sync reference to avoid repeated conflict prompt on same remote snapshot.
    lastSyncedConfig.current = JSON.stringify(pendingRemoteConfig);
    setPendingRemoteConfig(null);
    showToast("Keeping local edits. Save when ready to overwrite remote values.", "warning");
  };

  const updateNotif = (cat, field, val) => {
    setLocalConfig(prev => ({
      ...prev,
      notifications: {
        ...(prev.notifications || {}),
        [cat]: { ...(DEFAULT_NOTIFICATIONS[cat] || { enabled: true, webhookUrl: "", mentions: {} }), ...(prev.notifications?.[cat] || {}), [field]: val }
      }
    }));
  };

  const toggleMention = (cat, type) => {
    const current = localConfig.notifications?.[cat]?.mentions || {};
    updateNotif(cat, "mentions", { ...current, [type]: !current[type] });
  };

  const updateTemplate = (key, field, val) => {
    setLocalConfig(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        [key]: { ...(prev.templates?.[key] || {}), [field]: val }
      }
    }));
  };

  const testWebhook = async (urlOverride = null) => {
    const targetUrl = urlOverride || localConfig.webhookUrl;
    if (!targetUrl) return showToast("Please enter a Webhook URL first", "error");
    setIsTesting(true);
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "🔌 Connection Test",
            description: "Ang inyong Discord integration ay matagumpay na naka-konekta! ✅",
            color: 0x6382E6,
            timestamp: new Date().toISOString(),
            footer: { text: "Oblivion Guild Portal" }
          }]
        })
      });
      if (response.ok) showToast("Test notification sent!", "success");
      else throw new Error("Failed");
    } catch {
      showToast("Error connecting to Discord Webhook", "error");
    } finally {
      setIsTesting(false);
    }
  };

  const sections = [
    { id: "general", label: "General", icon: "settings" },
    { id: "join_requests", label: "Join Requests", icon: "add-user" },
    { id: "welcome", label: "Member Welcome", icon: "users" },
    { id: "vanguard", label: "Vanguard", icon: "edit" },
    { id: "events", label: "Events", icon: "calendar" },
    { id: "absences", label: "Absences", icon: "absence" },
    { id: "auction_results", label: "Auction Results", icon: "trophy" }
  ];

  const renderTemplateEditor = (key, title, placeholders) => {
    const temp = localConfig.templates?.[key] || { title: "", description: "" };
    return (
      <div className="card-inner p-3 mb-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 8, textTransform: "uppercase" }}>Editing: {title}</div>
        <div className="form-group mb-2">
          <label className="text-[10px] text-muted mb-1 block">EMBED TITLE</label>
          <input className="form-input form-input-sm" value={temp.title} onChange={e => updateTemplate(key, "title", e.target.value)} />
        </div>
        <div className="form-group mb-2">
          <label className="text-[10px] text-muted mb-1 block">EMBED DESCRIPTION</label>
          <textarea 
            className="form-input form-input-sm" 
            rows={5} 
            style={{ minHeight: 80, fontSize: 11, lineHeight: 1.4 }}
            value={temp.description} 
            onChange={e => updateTemplate(key, "description", e.target.value)} 
          />
        </div>
        <div className="text-[9px] text-muted">
          Available: {placeholders.map(p => <code key={p} style={{ color: "var(--gold)", marginRight: 5 }}>{`{${p}}`}</code>)}
        </div>
      </div>
    );
  };

  const renderMentionToggle = (cat, type, label, color) => {
    const isActive = localConfig.notifications?.[cat]?.mentions?.[type];
    return (
      <button 
        key={type}
        className={`btn btn-xs ${isActive ? '' : 'btn-ghost'}`}
        onClick={() => toggleMention(cat, type)}
        style={{ 
          background: isActive ? color : 'rgba(255,255,255,0.05)',
          color: isActive ? '#fff' : 'var(--text-muted)',
          fontSize: '9px',
          padding: '2px 8px',
          border: isActive ? 'none' : '1px solid var(--border)'
        }}
      >
        {isActive ? '✅' : ''} {label}
      </button>
    );
  };

  const renderCategoryHead = (cat, title) => (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold">{title}</span>
        <label className="switch">
          <input type="checkbox" checked={localConfig.notifications?.[cat]?.enabled || false} onChange={e => updateNotif(cat, "enabled", e.target.checked)} />
          <span className="slider round" style={{ transform: 'scale(0.8)' }}></span>
        </label>
      </div>

      <div className="flex items-center gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <span className="text-[10px] text-muted mr-1">Mentions:</span>
        {renderMentionToggle(cat, "master", "Master", "var(--gold)")}
        {renderMentionToggle(cat, "officer", "Officer", "var(--accent)")}
        {renderMentionToggle(cat, "oblivion", "Oblivion", "#8A2BE2")}
        {renderMentionToggle(cat, "member", "Member", "#40C97A")}
      </div>

      <div className="form-group mb-4">
        <label className="text-[10px] font-bold mb-1 block">WEBHOOK OVERRIDE (OPTIONAL)</label>
        <div className="flex gap-2">
          <input type="password" className="form-input form-input-sm" placeholder="Default global webhook will be used if blank..." value={localConfig.notifications?.[cat]?.webhookUrl || ""} onChange={e => updateNotif(cat, "webhookUrl", e.target.value)} />
          <button className="btn btn-ghost btn-sm" onClick={() => testWebhook(localConfig.notifications?.[cat]?.webhookUrl)} disabled={isTesting}>Test</button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="card animate-fade-in" style={{ marginTop: 20 }}>
        <div className="card-title flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="discord" size={20} color="#5865F2" />
            🤖 Discord Alert Center
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={validateDiscordConfig}>✅ Validate Config</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>💾 Save All Config</button>
          </div>
        </div>

        <div className="flex gap-4 mt-4" style={{ minHeight: 450 }}>
        {/* Sidebar */}
        <div style={{ width: 160, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`btn btn-sm btn-ghost`} style={{ justifyContent: "flex-start", color: activeSection === s.id ? "var(--accent)" : "var(--text-muted)", background: activeSection === s.id ? "rgba(99,130,230,0.1)" : "transparent" }}>
              <Icon name={s.icon} size={14} /> {s.label}
            </button>
          ))}
          <div style={{ marginTop: "auto", padding: "10px", background: "rgba(240,192,64,0.05)", borderRadius: "8px", border: "1px solid rgba(240,192,64,0.1)" }}>
             <div style={{ color: "var(--gold)", fontSize: 9, fontWeight: 700, marginBottom: 4 }}>💡 MULTI-CHANNEL TIPS</div>
             <p style={{ fontSize: 8, color: "var(--text-muted)", lineHeight: 1.4 }}>
               I-leave as <strong>blank</strong> ang Webhook Override para gamitin ang Global channel. Para sa <strong>Mentions</strong>, gamitin ang Numeric User ID sa roster.
             </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, paddingLeft: 10 }}>
          {activeSection === "general" && (
            <div className="animate-fade-in">
               <div className="form-group mb-4">
                <label className="text-xs font-bold mb-2 block">GLOBAL WEBHOOK URL</label>
                <div className="flex gap-2">
                  <input type="password" className="form-input" placeholder="https://discord.com/api/webhooks/..." value={localConfig.webhookUrl} onChange={e => setLocalConfig(p => ({ ...p, webhookUrl: e.target.value }))} style={{ fontFamily: localConfig.webhookUrl ? 'password' : 'inherit' }} />
                  <button className="btn btn-secondary btn-sm" onClick={() => testWebhook()} disabled={isTesting}>Test</button>
                </div>
                <p className="text-[10px] text-muted mt-1">Gagamitin ito sa lahat ng alerts maliban kung may 'Override Webhook' sa specific category.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div className="form-group">
                  <label className="text-xs font-bold mb-1 block text-gold">👑 MASTER ID</label>
                  <input className="form-input" value={localConfig.masterRoleId} onChange={e => setLocalConfig(p => ({ ...p, masterRoleId: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="text-xs font-bold mb-1 block text-accent">⚔️ OFFICER ID</label>
                  <input className="form-input" value={localConfig.officerRoleId} onChange={e => setLocalConfig(p => ({ ...p, officerRoleId: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="text-xs font-bold mb-1 block" style={{ color: '#8A2BE2' }}>⚖️ OBLIVION ID</label>
                  <input className="form-input" value={localConfig.oblivionRoleId} onChange={e => setLocalConfig(p => ({ ...p, oblivionRoleId: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginTop: 24, padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border)" }}>
                  <div className="text-xs font-bold mb-2 text-accent">📖 How to get Numeric IDs:</div>
                  <ol style={{ paddingLeft: 16, fontSize: 10, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <li>Buksan ang <strong>Settings &gt; Advanced</strong> sa Discord.</li>
                    <li>I-on ang <strong>Developer Mode</strong>.</li>
                    <li>I-right click ang <strong>Role</strong> o <strong>User Profile</strong>.</li>
                    <li>Piliin ang <strong>Copy Role ID</strong> o <strong>Copy User ID</strong>.</li>
                  </ol>
              </div>
            </div>
          )}

          {activeSection === "join_requests" && (
            <div className="animate-fade-in">
              {renderCategoryHead("join_requests", "JOIN REQUESTS (PENDING)")}
              {renderTemplateEditor("new_join", "Application Received alert", ["ign", "class", "role", "uid", "discord"])}
            </div>
          )}

          {activeSection === "welcome" && (
            <div className="animate-fade-in">
              {renderCategoryHead("welcome", "MEMBER WELCOME (APPROVED)")}
              {renderTemplateEditor("welcome", "Public Welcome Message", ["ign", "class", "role"])}
            </div>
          )}

          {activeSection === "vanguard" && (
            <div className="animate-fade-in">
              {renderCategoryHead("vanguard", "VANGUARD REQUESTS")}
              {renderTemplateEditor("vanguard", "Profile Update Request", ["ign", "updates"])}
            </div>
          )}

          {activeSection === "events" && (
            <div className="animate-fade-in">
              {renderCategoryHead("events", "EVENT SCHEDULING")}
              {renderTemplateEditor("event_created", "New Event Created", ["type", "date"])}
              {renderCategoryHead("event_digest", "POST-EVENT DIGEST")}
              {renderTemplateEditor("event_digest", "Post-Event Digest", ["type", "date"])}
            </div>
          )}

          {activeSection === "absences" && (
            <div className="animate-fade-in">
              {renderCategoryHead("absences", "ABSENCE ALERTS")}
              {renderTemplateEditor("absence_filed", "New Absence Filed", ["ign", "event", "date", "reason", "online"])}
              {renderTemplateEditor("absence_removed", "Absence Records Removed", ["ign", "event", "date"])}
            </div>
          )}
          
          {activeSection === "auction_results" && (
            <div className="animate-fade-in">
              {renderCategoryHead("auction_results", "AUCTION RESULTS (LOOT TABLE)")}
              <div style={{ padding: "12px", background: "rgba(99,130,230,0.08)", borderRadius: 10, border: "1px solid rgba(99,130,230,0.2)", marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: "var(--accent)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>📖 Discord Image Post Guide</div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px 0", lineHeight: 1.5 }}>
                  This will send an <strong>IMAGE</strong> of the auction table. You can use the legend below in your description template to help members understand the codes:
                </p>
                <div style={{ background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 6, fontSize: 10, fontFamily: "monospace", color: "#ddd" }}>
                  📖 **Legend:**<br/>
                  • **P1** = Full Page 1 (Bulk Win)<br/>
                  • **P1R1** = Page 1, Row 1 (Individual Slot)
                </div>
              </div>
              {renderTemplateEditor("auction_results", "Loot Session Finalized alert", ["name"])}
            </div>
          )}
        </div>
        </div>
      </div>
      {pendingRemoteConfig && (
        <Modal
          title="Resolve Discord Config Conflict"
          onClose={keepLocalConfig}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={keepLocalConfig}>Keep Mine</button>
              <button className="btn btn-primary" onClick={applyRemoteConfig}>Apply Remote</button>
            </>
          )}
        >
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Another officer saved Discord settings while you have unsaved local edits.
            <br /><br />
            <strong>Keep Mine</strong> keeps your local draft and you can save it later (may overwrite remote values).
            <br />
            <strong>Apply Remote</strong> discards local draft and loads latest shared settings.
          </div>
        </Modal>
      )}
    </>
  );
};

export default DiscordSettings;
