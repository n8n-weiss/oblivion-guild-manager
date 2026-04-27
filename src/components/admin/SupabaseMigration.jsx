import React, { useState } from 'react';
import { supabase } from '../../supabase';
import { useGuild } from '../../context/GuildContext';

const SupabaseMigration = () => {
  const { showToast } = useGuild();
  const [status, setStatus] = useState('idle');
  const [log, setLog] = useState([]);
  const [jsonInput, setJsonInput] = useState('');

  const addLog = (msg) => setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

  const runMigration = async () => {
    if (!jsonInput) return alert("Please paste the JSON backup first!");
    
    setStatus('migrating');
    setLog(["Starting migration..."]);

    try {
      const data = JSON.parse(jsonInput);
      
      // 1. Migrate Roster
      if (data.members) {
        addLog(`Migrating ${data.members.length} members...`);
        const { error } = await supabase.from('roster').upsert(
          data.members.map(m => {
            let mid = String(m.memberId || "");
            if (mid && !mid.startsWith('OBL')) mid = 'OBL' + mid;
            
            return {
              member_id: mid,
              ign: m.ign,
              class: m.class,
              guild_rank: m.guildRank,
              role: m.role || 'DPS',
              discord: m.discord || '',
              status: m.status || 'active',
              level: Number(m.level || 0),
              cp: Number(m.cp || 0),
              metadata: m
            };
          })
        );
        if (error) throw new Error(`Roster error: ${error.message}`);
        addLog("Roster migrated successfully.");
      }


      // 2. Migrate Events
      if (data.events) {
        addLog(`Migrating ${data.events.length} events...`);
        const validEvents = data.events.filter(e => e.eventId);
        const { error } = await supabase.from('events').upsert(
          validEvents.map(e => ({
            event_id: e.eventId,
            event_date: e.eventDate || new Date().toISOString().split('T')[0],
            type: e.type || e.eventType || 'Other',
            title: e.title || '',
            auditor: e.auditor || '',
            attendance_data: e.attendanceData || {},
            performance_data: e.performanceData || {},
            eo_ratings_data: e.eoRatingsData || {}
          }))
        );
        if (error) throw new Error(`Events error: ${error.message}`);
        addLog(`Events migrated successfully (${validEvents.length}/${data.events.length}).`);
      }

      // 3. Migrate Absences
      if (data.absences) {
        addLog(`Migrating ${data.absences.length} absences...`);
        const validAbsences = data.absences.filter(a => a.id && a.memberId);
        const { error } = await supabase.from('absences').upsert(
          validAbsences.map(a => ({
            id: a.id,
            member_id: a.memberId,
            start_date: a.startDate || new Date().toISOString().split('T')[0],
            end_date: a.endDate || new Date().toISOString().split('T')[0],
            reason: a.reason || '',
            status: a.status || 'pending'
          }))
        );
        if (error) throw new Error(`Absences error: ${error.message}`);
        addLog(`Absences migrated successfully (${validAbsences.length}/${data.absences.length}).`);
      }

      // 4. Migrate Metadata
      const metaKeys = [
        { key: 'parties', data: { parties: data.parties, partyNames: data.partyNames, raidParties: data.raidParties, raidPartyNames: data.raidPartyNames, partyOverrides: data.partyOverrides, leagueParties: data.leagueParties, leaguePartyNames: data.leaguePartyNames } },
        { key: 'auction', data: { 
          auctionSessions: data.auctionSessions || data.auctions?.auctionSessions || [], 
          auctionTemplates: data.auctionTemplates || data.auctions?.auctionTemplates || [], 
          resourceCategories: data.resourceCategories || data.auctions?.resourceCategories || ["Card Album", "Light & Dark"] 
        } },
        { key: 'discord', data: { discord: data.discordConfig } },
        { key: 'battlelog', data: { ...data.battlelogConfig } }
      ];

      for (const m of metaKeys) {
        // Skip if data is basically empty to prevent overwriting existing Supabase data with nulls
        const hasData = Object.values(m.data).some(v => Array.isArray(v) ? v.length > 0 : (v && Object.keys(v).length > 0));
        
        if (!hasData) {
          addLog(`Skipping empty metadata: ${m.key}`);
          continue;
        }

        addLog(`Migrating metadata: ${m.key}...`);
        const { error } = await supabase.from('metadata').upsert({
          key: m.key,
          data: m.data,
          updated_at: new Date().toISOString()
        });
        if (error) throw new Error(`Meta ${m.key} error: ${error.message}`);
      }

      // 5. Bootstrap Architect Role (The person running this is the first Architect)
      addLog("Bootstrapping Architect role...");
      const user = JSON.parse(localStorage.getItem('firebase:authUser:' + Object.keys(localStorage).find(k => k.startsWith('firebase:authUser'))?.split(':')[2] || ''));
      if (user || window.currentUserUID) {
        const uid = user?.uid || window.currentUserUID;
        const { error } = await supabase.from('user_roles').upsert({
          uid: uid,
          role: 'architect',
          updated_at: new Date().toISOString()
        });
        if (error) addLog(`Warning: Architect bootstrap failed: ${error.message}`);
        else addLog("Architect role assigned successfully.");
      }

      setStatus('done');
      addLog("Migration COMPLETE! Reloading app in 3 seconds...");
      showToast("Migration successful!", "success");
      
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err) {
      console.error(err);
      setStatus('error');
      addLog(`ERROR: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: 20, background: '#1a1a1a', borderRadius: 12, border: '1px solid #333' }}>
      <h3 style={{ color: 'var(--accent)', marginBottom: 16 }}>🚀 Supabase Migration Tool</h3>
      <p style={{ fontSize: 13, color: '#aaa', marginBottom: 20 }}>
        Paste the content of your <b>OBLIVION_EMERGENCY_BACKUP.json</b> file below to move your data to Supabase.
      </p>

      <textarea
        style={{ width: '100%', height: 200, background: '#000', color: '#0f0', fontFamily: 'monospace', fontSize: 11, padding: 10, borderRadius: 8, border: '1px solid #444', marginBottom: 20 }}
        placeholder="Paste JSON here..."
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button 
          className="btn" 
          disabled={status === 'migrating'}
          onClick={runMigration}
          style={{ background: 'var(--accent)', color: '#000', fontWeight: 800 }}
        >
          {status === 'migrating' ? 'Migrating...' : 'Start Migration'}
        </button>
      </div>

      <div style={{ maxHeight: 200, overflowY: 'auto', background: '#000', padding: 10, borderRadius: 8, fontSize: 10, fontFamily: 'monospace' }}>
        {log.map((l, i) => <div key={i} style={{ color: l.includes('ERROR') ? '#ff4d4d' : '#888' }}>{l}</div>)}
      </div>
    </div>
  );
};

export default SupabaseMigration;
