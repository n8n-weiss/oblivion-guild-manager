import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const payload = await req.json().catch(() => ({}));
    const { record, type, table, action } = payload;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: meta } = await supabase.from('metadata').select('data').eq('key', 'discord').single();
    
    if (!meta) throw new Error("Discord config not found");
    const discordConfig = meta.data?.discord || {};
    const notifications = discordConfig.notifications || {};
    const templates = discordConfig.templates || {};
    const globalWebhookUrl = discordConfig.webhookUrl;

    const getMentionsStr = (mentionsConfig) => {
        if (!mentionsConfig) return "";
        let str = "";
        if (mentionsConfig.master && discordConfig.masterRoleId) str += `<@&${discordConfig.masterRoleId}> `;
        if (mentionsConfig.officer && discordConfig.officerRoleId) str += `<@&${discordConfig.officerRoleId}> `;
        if (mentionsConfig.oblivion && discordConfig.oblivionRoleId) str += `<@&${discordConfig.oblivionRoleId}> `;
        if (mentionsConfig.member) str += `@everyone `;
        return str.trim();
    };

    const replacePlaceholders = (text, data) => {
        if (!text) return "";
        let res = text;
        for (const [key, value] of Object.entries(data)) {
            res = res.replace(new RegExp(`\\{${key}\\}`, 'gi'), value || "");
        }
        return res;
    };

    let discordPayload = null;
    let webhookUrl = null;

    // --- CASE 1: AUTOMATED REMINDERS (CRON JOB) ---
    if (action === 'check-reminders') {
      const config = notifications.battlelog_reminder || {};
      webhookUrl = config.webhookUrl || notifications.events?.webhookUrl || globalWebhookUrl;
      if (!webhookUrl || config.enabled === false) return new Response("No webhook or disabled for reminders", { status: 200 });

      const mentionsStr = getMentionsStr(config.mentions);
      const tpl = templates.battlelog_reminder || {};

      // Get pending events
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .not('battlelog_audit->status', 'eq', 'submitted');

      const now = new Date();
      
      for (const ev of (events || [])) {
        const audit = ev.battlelog_audit || {};
        const dueAt = audit.dueAt ? new Date(audit.dueAt) : null;
        const eventStart = new Date(`${ev.event_date}T${ev.type === 'Guild League' ? '20:55' : '20:00'}:00`);
        
        const data = { type: ev.type, date: ev.event_date, auditor: audit.assignedIgn || "TBA" };

        // 1. Soft Reminder (55 mins after event)
        if (!audit.postEventReminderSentAt && now.getTime() > eventStart.getTime() + (55 * 60 * 1000)) {
           await sendToDiscord(webhookUrl, {
             content: mentionsStr,
             embeds: [{
               title: replacePlaceholders(tpl.title || "🔔 Battlelog Soft Reminder", data),
               description: replacePlaceholders(tpl.description || `The event **${ev.title}** has ended. Please audit the logs!`, data),
               color: 0x3498db,
               fields: [{ name: "Auditor", value: audit.assignedIgn || "TBA" }]
             }]
           });
           // Update DB
           await supabase.from('events').update({ 
             battlelog_audit: { ...audit, postEventReminderSentAt: now.toISOString() } 
           }).eq('event_id', ev.event_id);
        }

        // 2. Hard Reminder (Overdue)
        if (dueAt && !audit.reminderSentAt && now > dueAt) {
          await sendToDiscord(webhookUrl, {
             content: mentionsStr,
             embeds: [{
               title: replacePlaceholders(tpl.title || "📘 Battlelog Overdue Alert", data),
               description: replacePlaceholders(tpl.description || `Audit for **${ev.title}** is now overdue!`, data),
               color: 0xf1c40f,
               fields: [{ name: "Auditor", value: audit.assignedIgn || "TBA" }]
             }]
           });
           // Update DB
           await supabase.from('events').update({ 
             battlelog_audit: { ...audit, reminderSentAt: now.toISOString(), status: 'overdue' } 
           }).eq('event_id', ev.event_id);
        }
      }
      return new Response("Reminders checked", { status: 200 });
    }

    // --- CASE 2: TABLE TRIGGERS ---
    
    if (table === 'absences') {
      const config = notifications.absences || {};
      if (config.enabled === false) return new Response("Disabled", { status: 200 });
      webhookUrl = config.webhookUrl || globalWebhookUrl || Deno.env.get("DISCORD_ABSENCE_WEBHOOK_URL");
      
      let displayName = record.ign;
      if (!displayName && record.member_id) {
        const { data: memberData } = await supabase.from('roster').select('ign').eq('member_id', record.member_id).single();
        if (memberData) displayName = memberData.ign;
      }
      displayName = displayName || record.member_id || "Unknown";

      const mentionsStr = getMentionsStr(config.mentions);
      const data = { ign: displayName, event: record.event_id || "Unknown", date: record.event_date, reason: record.reason || "No reason", online: record.online_status || "Unknown" };

      if (type === 'INSERT') {
        const tpl = templates.absence_filed || {};
        discordPayload = { 
          content: mentionsStr,
          embeds: [{ 
            title: replacePlaceholders(tpl.title || "🚨 Absence Notice Filed", data), 
            description: replacePlaceholders(tpl.description || `**${displayName}** will not be able to attend an upcoming event.`, data),
            color: 0xff4757, 
            fields: [
              { name: "Date", value: record.event_date, inline: true }, 
              { name: "Reason", value: record.reason || "No reason provided", inline: false }
            ],
            thumbnail: { url: "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png" }
          }] 
        };
      } else if (type === 'DELETE') {
        const tpl = templates.absence_removed || {};
        discordPayload = { 
          content: mentionsStr,
          embeds: [{ 
            title: replacePlaceholders(tpl.title || "✅ Absence Cancelled", data), 
            color: 0x2ecc71, 
            description: replacePlaceholders(tpl.description || `The absence record for **${displayName}** on **${record.event_date}** has been cancelled. They are now expected to attend.`, data) 
          }] 
        };
      } else if (type === 'UPDATE') {
        const oldRecord = payload.old_record || {};
        const tpl = templates.absence_updated || {};
        const changes = [];
        if (oldRecord.event_date !== record.event_date) changes.push(`Date: ~~${oldRecord.event_date}~~ ➔ **${record.event_date}**`);
        if (oldRecord.reason !== record.reason) changes.push(`Reason: "${record.reason}"`);
        if (oldRecord.online_status !== record.online_status) changes.push(`Online: **${record.online_status}**`);

        if (changes.length > 0) {
          discordPayload = {
            content: mentionsStr,
            embeds: [{
              title: replacePlaceholders(tpl.title || "📝 Absence Record Updated", data),
              description: replacePlaceholders(tpl.description || `Absence record for **${displayName}** has been modified.`, data),
              color: 0xe67e22,
              fields: [{ name: "Changes", value: changes.join("\n") }],
              thumbnail: { url: "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png" }
            }]
          };
        }
      }
    } 
    else if (table === 'join_requests' && type === 'INSERT') {
      const config = notifications.join_requests || {};
      if (config.enabled === false) return new Response("Disabled", { status: 200 });
      webhookUrl = config.webhookUrl || globalWebhookUrl;
      const isRe = record.request_type === 'reactivation';
      const mentionsStr = getMentionsStr(config.mentions);
      
      const tpl = templates.new_join || {};
      const data = { ign: record.ign, class: record.class, role: record.role, uid: record.uid, discord: record.discord };

      discordPayload = { 
        content: mentionsStr,
        embeds: [{ 
          title: replacePlaceholders(tpl.title || (isRe ? "♻️ Account Reactivation Request" : "📩 New Guild Application"), data), 
          description: replacePlaceholders(tpl.description || `Please review this request in the Guild Portal.`, data),
          color: isRe ? 0x6382E6 : 0x3498db, 
          fields: [
            { name: "IGN", value: record.ign || "Unknown", inline: true }, 
            { name: "Class", value: record.class || "Unknown", inline: true },
            { name: "Role", value: record.role || "Unknown", inline: true },
            { name: "Discord", value: record.discord || "Unknown", inline: true },
            { name: "UID", value: record.uid || "Unknown", inline: true }
          ],
          thumbnail: { url: "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png" }
        }] 
      };
    }
    else if (table === 'requests' && type === 'INSERT') {
      const config = notifications.vanguard || {};
      if (config.enabled === false) return new Response("Disabled", { status: 200 });
      webhookUrl = config.webhookUrl || globalWebhookUrl;
      const mentionsStr = getMentionsStr(config.mentions);
      
      const tpl = templates.vanguard || {};
      const data = { ign: record.requester_ign };

      const oldData = record.old_data || {};
      const newData = record.new_data || {};
      const changesFields = [];

      if (oldData.ign !== newData.ign) changesFields.push({ name: "IGN", value: `~~${oldData.ign || "—"}~~ ➔ **${newData.ign || "—"}**`, inline: false });
      if (oldData.class !== newData.class) changesFields.push({ name: "Class", value: `~~${oldData.class || "—"}~~ ➔ **${newData.class || "—"}**`, inline: false });
      if (oldData.role !== newData.role) changesFields.push({ name: "Role", value: `~~${oldData.role || "—"}~~ ➔ **${newData.role || "—"}**`, inline: false });

      discordPayload = { 
        content: mentionsStr,
        embeds: [{ 
          title: replacePlaceholders(tpl.title || "🛡️ Vanguard Request", data), 
          description: replacePlaceholders(tpl.description || `Member **${data.ign}** has submitted a profile update request.`, data),
          color: 0x9b59b6, 
          fields: changesFields.length > 0 ? changesFields : [{ name: "Changes", value: "No visible changes." }],
          footer: { text: `Member ID: ${record.member_id}` },
          thumbnail: { url: "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png" }
        }] 
      };
    }
    else if (table === 'events' && type === 'INSERT') {
      const config = notifications.events || {};
      if (config.enabled === false) return new Response("Disabled", { status: 200 });
      webhookUrl = config.webhookUrl || globalWebhookUrl;
      
      const mentionsStr = getMentionsStr(config.mentions);
      const tpl = templates.event_created || {};
      const eventTimeStr = discordConfig.eventTimeText ? `\n\n**Time:**\n${discordConfig.eventTimeText}` : "";
      
      const data = { type: record.type, date: record.event_date };
      
      discordPayload = { 
        content: mentionsStr,
        embeds: [{ 
          title: replacePlaceholders(tpl.title || `📅 New Event Scheduled: ${record.title}`, data), 
          description: replacePlaceholders(tpl.description || `A new guild event has been posted to the calendar.`, data) + eventTimeStr,
          color: 0x9b59b6, 
          fields: [
            { name: "Type", value: record.type, inline: true }, 
            { name: "Date", value: record.event_date, inline: true },
            { name: "Auditor", value: record.auditor || "TBA", inline: true }
          ],
          thumbnail: { url: "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png" }
        }] 
      };
    }

    if (discordPayload && webhookUrl) {
      await sendToDiscord(webhookUrl, discordPayload);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
})

async function sendToDiscord(url, payload) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
