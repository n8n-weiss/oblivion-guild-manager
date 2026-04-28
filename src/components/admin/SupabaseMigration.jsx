import React, { useState } from 'react';
import { supabase } from '../../supabase';
import { useGuild } from '../../context/GuildContext';

const SupabaseMigration = () => {
  const { showToast, currentUser } = useGuild();
  const [status, setStatus] = useState('idle');
  const [log, setLog] = useState([]);
  const [jsonInput, setJsonInput] = useState('');

  const addLog = (msg) => setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

  const runMigration = async () => {
    if (!jsonInput) return alert("Please paste the JSON backup first!");
    
    setStatus('migrating');
    setLog(["Starting migration..."]);

    try {
      console.log("DEBUG: JSON Prefix:", jsonInput.substring(0, 100));
      const data = JSON.parse(jsonInput);
      let wishlistEntries = [];
      const membersList = data.members || data.roster || [];
      console.log("DEBUG: JSON Top-Level Keys:", Object.keys(data));
      if (membersList.length > 0) {
        console.log("DEBUG: FULL FIRST MEMBER:", JSON.stringify(membersList[0], null, 2));
      }
      
      addLog("JSON parsed successfully.");
      // 1. Migrate Roster & Extract Wishlists
      if (membersList.length > 0) {
        addLog(`Migrating ${membersList.length} members...`);
        const rosterToUpsert = membersList.map(m => {
          let mid = String(m.memberId || m.id || "");
          if (mid && !mid.startsWith('OBL') && mid.length < 10) mid = 'OBL' + mid;
          
          // AGGRESSIVE EXTRACTION: Check multiple possible keys
          const memberWishlist = m.wishlist || m.bids || m.loot || m.requests || 
                                m.metadata?.wishlist || m.metadata?.bids || m.metadata?.loot;
          
          if (memberWishlist && (Array.isArray(memberWishlist) || typeof memberWishlist === 'object')) {
            wishlistEntries.push({
              id: mid,
              bids: Array.isArray(memberWishlist) ? memberWishlist : [memberWishlist],
              updated_at: new Date().toISOString()
            });
          }
          return {
            member_id: mid,
            ign: m.ign,
            class: m.class,
            guild_rank: m.guildRank || m.guild_rank,
            role: m.role || 'DPS',
            discord: m.discord || '',
            status: m.status || 'active',
            level: Number(m.level || 0),
            cp: Number(m.cp || 0),
            metadata: m
          };
        });
        const { error: rosterError } = await supabase.from('roster').upsert(rosterToUpsert);
        if (rosterError) throw new Error(`Roster error: ${rosterError.message}`);
        addLog(`Roster migrated successfully (${data.members.length}).`);
        if (wishlistEntries.length > 0) {
          addLog(`Extracting ${wishlistEntries.length} wishlists...`);
          const { error: wishError } = await supabase.from('auction_bids').upsert(wishlistEntries);
          if (!wishError) addLog(`Extracted ${wishlistEntries.length} wishlists.`);
        }
      }


      // 2. Migrate Events
      let migratedEvents = [];
      if (data.events) {
        addLog(`Migrating ${data.events.length} events...`);
        const validEvents = data.events.filter(e => e.eventId || e.event_id);
        
        // Fetch existing events to avoid overwriting good data with empty data
        const { data: existingEvents } = await supabase.from('events').select('event_id, attendance_data, performance_data');
        
        const upsertData = validEvents.map(e => {
          const eid = e.eventId || e.event_id;
          const existing = existingEvents?.find(ex => ex.event_id === eid);
          
          const newAtt = e.attendance_data || e.attendanceData || e.attendance || e.metadata?.attendanceData || {};
          const newPerf = e.performance_data || e.performanceData || e.performance || e.perf || e.scores || e.metadata?.performanceData || {};
          const newEo = e.eo_ratings_data || e.eoRatingsData || e.eo_ratings || e.metadata?.eoRatingsData || {};

          return {
            event_id: eid,
            event_date: e.event_date || e.eventDate || new Date().toISOString().split('T')[0],
            type: e.type || e.eventType || 'Other',
            title: e.title || '',
            auditor: e.auditor || '',
            // Smart Merge: Only use new data if it's not empty, otherwise preserve existing
            attendance_data: Object.keys(newAtt).length > 0 ? newAtt : (existing?.attendance_data || {}),
            performance_data: Object.keys(newPerf).length > 0 ? newPerf : (existing?.performance_data || {}),
            eo_ratings_data: Object.keys(newEo).length > 0 ? newEo : (existing?.eo_ratings_data || {})
          };
        });
        
        migratedEvents = upsertData;

        console.log("Migration Debug: upsertData sample:", upsertData[0]);

        const { error } = await supabase.from('events').upsert(upsertData);
        if (error) throw new Error(`Events error: ${error.message}`);
        addLog(`Events migrated successfully (${validEvents.length}).`);
      }

      // 3. Migrate Absences
      if (data.absences) {
        addLog(`Migrating ${data.absences.length} absences...`);
        const validAbsences = data.absences.filter(a => a.id && (a.memberId || a.member_id));
        const { error } = await supabase.from('absences').upsert(
          validAbsences.map(a => ({
            id: a.id,
            member_id: a.member_id || a.memberId,
            start_date: a.startDate || a.start_date || new Date().toISOString().split('T')[0],
            end_date: a.endDate || a.end_date || new Date().toISOString().split('T')[0],
            reason: a.reason || '',
            status: a.status || 'pending'
          }))
        );
        if (error) throw new Error(`Absences error: ${error.message}`);
        addLog(`Absences migrated successfully (${validAbsences.length}/${data.absences.length}).`);
      }

      // 4. Migrate Attendance (Separate Table)
      const attendanceList = data.attendance || [];
      if (attendanceList.length > 0) {
        addLog(`Migrating ${attendanceList.length} top-level attendance records...`);
        const { error } = await supabase.from('attendance').upsert(
          attendanceList.map(a => ({
            event_id: a.eventId || a.event_id,
            member_id: a.memberId || a.member_id,
            status: a.status || 'present'
          }))
        );
        if (error) addLog(`Warning: Attendance table error: ${error.message}`);
        else addLog(`${attendanceList.length} attendance records migrated.`);
      }

      // 5. Migrate Performance (Separate Table)
      const performanceList = data.performance || [];
      if (performanceList.length > 0) {
        addLog(`Migrating ${performanceList.length} top-level performance records...`);
        const { error } = await supabase.from('performance').upsert(
          performanceList.map(p => ({
            event_id: p.eventId || p.event_id,
            member_id: p.memberId || p.member_id,
            kills: p.kills || 0,
            assists: p.assists || 0,
            ctf1: p.ctf1 || p.ctfPoints || 0,
            ctf2: p.ctf2 || 0,
            ctf3: p.ctf3 || 0,
            ctf_points: p.ctfPoints || 0,
            performance_points: p.performancePoints || 0
          }))
        );
        if (error) addLog(`Warning: Performance table error: ${error.message}`);
        else addLog(`${performanceList.length} performance records migrated.`);
      }

      // 6. Migrate EO Ratings
      const eoList = data.eoRatings || [];
      if (eoList.length > 0) {
        addLog(`Migrating ${eoList.length} EO ratings...`);
        const { error } = await supabase.from('eo_ratings').upsert(
          eoList.map(r => ({
            event_id: r.eventId || r.event_id,
            member_id: r.memberId || r.member_id,
            rating: r.rating || 0
          }))
        );
        if (error) addLog(`Warning: eo_ratings table error: ${error.message}`);
      }

      // 7. Migrate Auction Bids (Wishlist)
      const wishlist = data.auctionBids || data.auction_bids || [];
      if (wishlist.length > 0) {
        addLog(`Migrating ${wishlist.length} wishlist entries...`);
        const { error } = await supabase.from('auction_bids').upsert(
          wishlist.map(w => {
            let mid = String(w.id || w.memberId || w.member_id || "");
            if (mid && !mid.startsWith('OBL') && mid.length < 10) mid = 'OBL' + mid;
            
            return {
              id: mid,
              bids: w.bids || [],
              updated_at: w.updatedAt || new Date().toISOString()
            };
          })
        );
        if (error) addLog(`Warning: auction_bids table error: ${error.message}`);
        else addLog(`${wishlist.length} wishlist entries migrated.`);
      }

      // 8. Migrate Metadata
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
        const hasData = Object.values(m.data).some(v => Array.isArray(v) ? v.length > 0 : (v && Object.keys(v).length > 0));
        if (!hasData) continue;

        addLog(`Migrating metadata: ${m.key}...`);
        const { error } = await supabase.from('metadata').upsert({
          key: m.key,
          data: m.data,
          updated_at: new Date().toISOString()
        });
        if (error) throw new Error(`Meta ${m.key} error: ${error.message}`);
      }

      // 8. Bootstrap Architect Role
      addLog("Bootstrapping Architect role...");
      if (currentUser?.id) {
        const { error } = await supabase.from('user_roles').upsert({
          uid: currentUser.id,
          role: 'architect',
          updated_at: new Date().toISOString()
        });
        if (error) addLog(`Warning: Architect bootstrap failed: ${error.message}`);
        else addLog("Architect role assigned successfully.");
      }

      setStatus('done');
      addLog("Migration COMPLETE! Clearing cache and reloading...");
      showToast("Migration successful!", "success");
      
      // Clear cache to force fresh fetch after migration
      sessionStorage.removeItem("global_guild_data_v3");
      sessionStorage.setItem("global_guild_data_v3", JSON.stringify({
        data: {
          rosterData: (data.members && data.members.length > 0) ? data.members : JSON.parse(sessionStorage.getItem("global_guild_data_v3") || "{}")?.data?.rosterData || [],
          eventsData: migratedEvents.length > 0 ? migratedEvents : data.events,
          absenceData: data.absences,
          metaData: data.metaData,
          bidsData: wishlistEntries,
          attendanceData: [],
          performanceData: [],
          eoRatingsData: []
        },
        fetchedAt: Date.now()
      }));
      
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
