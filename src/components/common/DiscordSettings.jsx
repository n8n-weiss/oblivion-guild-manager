import React, { useState, useEffect } from 'react';
import { useGuild } from '../../context/GuildContext';
import Icon from '../ui/icons';

const DiscordSettings = () => {
  const { discordConfig, setDiscordConfig, showToast, isArchitect } = useGuild();
  const [url, setUrl] = useState(discordConfig?.webhookUrl || "");
  const [masterId, setMasterId] = useState(discordConfig?.masterRoleId || "");
  const [officerId, setOfficerId] = useState(discordConfig?.officerRoleId || "");
  const [isTesting, setIsTesting] = useState(false);

  // Sync local state when global config loads from Firestore
  useEffect(() => {
    if (discordConfig?.webhookUrl) setUrl(discordConfig.webhookUrl);
    if (discordConfig?.masterRoleId) setMasterId(discordConfig.masterRoleId);
    if (discordConfig?.officerRoleId) setOfficerId(discordConfig.officerRoleId);
  }, [discordConfig]);

  if (!isArchitect) return null;

  const handleSave = () => {
    setDiscordConfig({ 
      ...discordConfig, 
      webhookUrl: url,
      masterRoleId: masterId,
      officerRoleId: officerId
    });
    showToast("Discord settings saved!", "success");
  };

  const testWebhook = async () => {
    if (!url) return showToast("Please enter a Webhook URL first", "error");
    setIsTesting(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "🔌 Connection Test",
            description: "Ang inyong Web App ay matagumpay na naka-konekta sa Discord! ✅",
            color: 0x6382E6,
            timestamp: new Date().toISOString(),
            footer: { text: "Oblivion Guild Manager" }
          }]
        })
      });
      if (response.ok) showToast("Test notification sent!", "success");
      else throw new Error("Failed to send");
    } catch (err) {
      showToast("Error connecting to Discord Webhook", "error");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-title flex items-center gap-2">
        <Icon name="discord" size={20} color="#5865F2" />
        🤖 Discord Integration (Power Feature)
      </div>
      <p className="text-xs text-muted mb-4">
        I-input ang inyong Discord Webhook URL para mag-send ng automatic alerts for recruitment and profile updates.
      </p>

      <div className="form-group pb-4">
        <label className="text-xs font-bold mb-2 block">DISCORD WEBHOOK URL</label>
        <div className="flex gap-2">
          <input
            type="password"
            className="form-input flex-1"
            placeholder="https://discord.com/api/webhooks/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ fontFamily: url ? 'password' : 'inherit' }}
          />
          <button 
            className="btn btn-secondary" 
            onClick={testWebhook}
            disabled={isTesting}
          >
            {isTesting ? "Testing..." : "Test"}
          </button>
        </div>
        <p className="text-[10px] text-muted mt-2">
          💡 Go to Server Settings &gt; Integrations &gt; Webhooks to create one.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px", padding: "16px", background: "rgba(0,0,0,0.2)", borderRadius: "10px", border: "1px solid var(--border)" }}>
        <div className="form-group">
          <label className="text-xs font-bold mb-2 block text-gold">👑 MASTER ROLE ID</label>
          <input
            className="form-input"
            placeholder="e.g. 123456789..."
            value={masterId}
            onChange={(e) => setMasterId(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="text-xs font-bold mb-2 block" style={{ color: "var(--accent)" }}>⚔️ OFFICER ROLE ID</label>
          <input
            className="form-input"
            placeholder="e.g. 123456789..."
            value={officerId}
            onChange={(e) => setOfficerId(e.target.value)}
          />
        </div>
        <div style={{ gridColumn: "1/-1", marginTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px" }}>
          <p className="text-[10px] text-muted">
            <strong>How to get Role ID:</strong> Enable <strong>Developer Mode</strong> in Discord Settings &gt; Advanced. Then right-click a Role in Server Settings and select <strong>Copy Role ID</strong>.
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <button className="btn btn-primary" onClick={handleSave}>
          💾 Save Discord Config
        </button>
      </div>
    </div>
  );
};

export default DiscordSettings;
