import { db } from './firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

async function migrateData() {
  console.log("Starting migration...");
  const eventsSnap = await getDocs(collection(db, "events"));
  const attSnap = await getDocs(collection(db, "attendance"));
  const perfSnap = await getDocs(collection(db, "performance"));
  const eoSnap = await getDocs(collection(db, "eoRatings"));

  const attMap = new Map(attSnap.docs.map(d => [d.id, d.data().members || {}]));
  const perfMap = new Map(perfSnap.docs.map(d => [d.id, d.data().members || {}]));
  const eoMap = new Map(eoSnap.docs.map(d => [d.id, d.data().ratings || {}]));

  const batch = writeBatch(db);
  let count = 0;

  eventsSnap.docs.forEach(eventDoc => {
    const eid = eventDoc.id;
    const eventData = eventDoc.data();
    
    const updatedData = {
      ...eventData,
      attendanceData: attMap.get(eid) || {},
      performanceData: perfMap.get(eid) || {},
      eoRatingsData: eoMap.get(eid) || {}
    };

    batch.set(doc(db, "events", eid), updatedData);
    count++;
  });

  await batch.commit();
  console.log(`Migration complete! Updated ${count} events.`);
}

migrateData();
