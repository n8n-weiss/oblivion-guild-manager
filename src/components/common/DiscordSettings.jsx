import React, { useState } from 'react';
import { useGuild } from '../../context/GuildContext';
import Icon from '../ui/icons';

const DiscordSettings = () => {
  const { discordConfig, setDiscordConfig, showToast, isArchitect } = useGuild();
  const [url, setUrl] = useState(discordConfig?.webhookUrl || "");
  const [isTesting, setIsTesting] = useState(false);

  if (!isArchitect) return null;

  const handleSave = () => {
    setDiscordConfig({ ...discordConfig, webhookUrl: url });
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
            className="input-field flex-1"
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

      <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <button className="btn btn-primary" onClick={handleSave}>
          💾 Save Discord Config
        </button>
      </div>
    </div>
  );
};

export default DiscordSettings;
