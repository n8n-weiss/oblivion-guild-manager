import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, writeBatch } from 'firebase/firestore';

/**
 * Migration Script: Monolith to Collection-based Schema
 * This script reads the existing 'guilddata/main' document and distributes
 * its contents into the new 'roster', 'events', 'attendance', 'performance', 
 * 'absences', and 'metadata' collections.
 */
export async function runMigration() {
  console.log("Starting migration...");
  
  try {
    const mainRef = doc(db, "guilddata", "main");
    const snap = await getDoc(mainRef);
    
    if (!snap.exists()) {
      console.error("Migration failed: 'guilddata/main' document not found.");
      return;
    }
    
    const data = snap.data();
    const batch = writeBatch(db);
    
    // 1. Migrate Roster (Members)
    if (data.members && Array.isArray(data.members)) {
      data.members.forEach(member => {
        const ref = doc(db, "roster", member.memberId);
        batch.set(ref, member);
      });
      console.log(`Prepared ${data.members.length} members for migration.`);
    }
    
    // 2. Migrate Events
    if (data.events && Array.isArray(data.events)) {
      data.events.forEach(event => {
        const ref = doc(db, "events", event.eventId);
        batch.set(ref, event);
      });
      console.log(`Prepared ${data.events.length} events for migration.`);
    }
    
    // 3. Migrate Attendance (Grouped by Event)
    // Map attendance to { [eventId]: { [memberId]: status } }
    if (data.attendance && Array.isArray(data.attendance)) {
      const attByEvent = {};
      data.attendance.forEach(att => {
        if (!attByEvent[att.eventId]) attByEvent[att.eventId] = {};
        attByEvent[att.eventId][att.memberId] = att.status;
      });
      
      Object.keys(attByEvent).forEach(eventId => {
        const ref = doc(db, "attendance", eventId);
        batch.set(ref, { eventId, members: attByEvent[eventId] });
      });
      console.log(`Prepared attendance for ${Object.keys(attByEvent).length} events for migration.`);
    }
    
    // 4. Migrate Performance (Grouped by Event)
    if (data.performance && Array.isArray(data.performance)) {
      const perfByEvent = {};
      data.performance.forEach(perf => {
        if (!perfByEvent[perf.eventId]) perfByEvent[perf.eventId] = {};
        perfByEvent[perf.eventId][perf.memberId] = perf;
      });
      
      Object.keys(perfByEvent).forEach(eventId => {
        const ref = doc(db, "performance", eventId);
        batch.set(ref, { eventId, members: perfByEvent[eventId] });
      });
      console.log(`Prepared performance for ${Object.keys(perfByEvent).length} events for migration.`);
    }

    // 5. Migrate EO Ratings (Grouped by Event)
    if (data.eoRatings && Array.isArray(data.eoRatings)) {
      const eoByEvent = {};
      data.eoRatings.forEach(r => {
        if (!eoByEvent[r.eventId]) eoByEvent[r.eventId] = {};
        eoByEvent[r.eventId][r.memberId] = r.rating;
      });
      
      Object.keys(eoByEvent).forEach(eventId => {
        const ref = doc(db, "eoRatings", eventId);
        batch.set(ref, { eventId, ratings: eoByEvent[eventId] });
      });
      console.log(`Prepared EO ratings for ${Object.keys(eoByEvent).length} events for migration.`);
    }
    
    // 6. Migrate Absences
    if (data.absences && Array.isArray(data.absences)) {
      data.absences.forEach(absence => {
        const ref = doc(db, "absences", absence.id || `ABS_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
        batch.set(ref, absence);
      });
      console.log(`Prepared ${data.absences.length} absence records for migration.`);
    }
    
    // 7. Migrate Metadata (Parties, Templates)
    const metaRef = doc(db, "metadata", "current");
    batch.set(metaRef, {
      parties: data.parties || [],
      auctionTemplates: data.auctionTemplates || [],
      auctionSessions: data.auctionSessions || [], // Note: Auction sessions might need their own collection if they get too many
      lastMigrated: new Date().toISOString()
    });
    console.log("Prepared metadata for migration.");
    
    // Commit everything
    await batch.commit();
    console.log("Migration completed successfully!");
    
    // Optional: Mark monolith as migrated
    await setDoc(mainRef, { ...data, migratedAt: new Date().toISOString(), isLegacy: true });
    console.log("Monolith marked as legacy.");
    
  } catch (err) {
    console.error("Migration error:", err);
    throw err;
  }
}
