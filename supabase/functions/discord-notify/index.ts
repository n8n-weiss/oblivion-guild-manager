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
    const notifications = meta.data?.discord?.notifications || {};

    let discordPayload = null;
    let webhookUrl = null;

    // --- CASE 1: AUTOMATED REMINDERS (CRON JOB) ---
    if (action === 'check-reminders') {
      webhookUrl = notifications.battlelog_reminder?.webhookUrl || notifications.events?.webhookUrl;
      if (!webhookUrl) return new Response("No webhook for reminders", { status: 200 });

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
        
        // 1. Soft Reminder (55 mins after event)
        if (!audit.postEventReminderSentAt && now.getTime() > eventStart.getTime() + (55 * 60 * 1000)) {
           await sendToDiscord(webhookUrl, {
             embeds: [{
               title: "🔔 Battlelog Soft Reminder",
               description: `The event **${ev.title}** has ended. Please audit the logs!`,
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
             embeds: [{
               title: "📘 Battlelog Overdue Alert",
               description: `Audit for **${ev.title}** is now overdue!`,
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
    const globalWebhookUrl = meta.data?.discord?.webhookUrl;
    
    if (table === 'absences') {
      webhookUrl = notifications.absences?.webhookUrl || globalWebhookUrl || Deno.env.get("DISCORD_ABSENCE_WEBHOOK_URL");
      
      let displayName = record.ign;
      if (!displayName && record.member_id) {
        const { data: memberData } = await supabase.from('roster').select('ign').eq('member_id', record.member_id).single();
        if (memberData) displayName = memberData.ign;
      }
      displayName = displayName || record.member_id || "Unknown";

      if (type === 'INSERT') {
        discordPayload = { 
          embeds: [{ 
            title: "🚨 Absence Notice Filed", 
            description: `**${displayName}** will not be able to attend an upcoming event.`,
            color: 0xff4757, 
            fields: [
              { name: "Date", value: record.event_date, inline: true }, 
              { name: "Reason", value: record.reason || "No reason provided", inline: false }
            ],
            thumbnail: { url: "https://raw.githubusercontent.com/n8n-weiss/oblivion-guild-manager/main/public/oblivion-logo.png" }
          }] 
        };
      } else if (type === 'DELETE') {
        discordPayload = { 
          embeds: [{ 
            title: "✅ Absence Cancelled", 
            color: 0x2ecc71, 
            description: `The absence record for **${displayName}** on **${record.event_date}** has been cancelled. They are now expected to attend.` 
          }] 
        };
      }
    } 
    else if (table === 'join_requests' && type === 'INSERT') {
      webhookUrl = notifications.join_requests?.webhookUrl || globalWebhookUrl;
      const isRe = record.request_type === 'reactivation';
      discordPayload = { 
        embeds: [{ 
          title: isRe ? "♻️ Account Reactivation Request" : "📩 New Guild Application", 
          description: `Please review this request in the Guild Portal.`,
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
    else if (table === 'events' && type === 'INSERT') {
      webhookUrl = notifications.events?.webhookUrl || globalWebhookUrl;
      discordPayload = { 
        embeds: [{ 
          title: `📅 New Event Scheduled: ${record.title}`, 
          description: `A new guild event has been posted to the calendar.`,
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
