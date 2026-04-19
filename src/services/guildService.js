import { db } from '../firebase';
import {
  collection,
  getDocs,
  writeBatch,
  doc
} from 'firebase/firestore';

/**
 * Handles the monthly reset process.
 * 1. Archives current attendance records into attendanceBuckets with a month_year tag.
 * 2. Clears current scoring data (performance and eoRatings).
 *
 * @param {string} monthYear - Format 'YYYY-MM' (e.g., '2026-04')
 */
export async function resetMonthlyData(monthYear) {
  const batch = writeBatch(db);

  // 1. Archive Attendance
  const attendanceRef = collection(db, 'attendance');
  const attendanceSnap = await getDocs(attendanceRef);

  attendanceSnap.forEach(docSnap => {
    const data = docSnap.data();
    const eventId = docSnap.id;

    // Create archived version in attendanceBuckets
    const archiveId = `${monthYear}_${eventId}`;
    const archiveRef = doc(db, 'attendanceBuckets', archiveId);

    batch.set(archiveRef, {
      ...data,
      month_year: monthYear,
      archivedAt: new Date().toISOString()
    });

    // Remove from active attendance
    batch.delete(doc(db, 'attendance', eventId));
  });

  // 2. Clear Scoring Data
  const collectionsToClear = [
    'performance',
    'performanceBuckets',
    'eoRatings',
    'eoRatingsBuckets'
  ];

  for (const colName of collectionsToClear) {
    const colRef = collection(db, colName);
    const snap = await getDocs(colRef);

    snap.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
  }

  // Firestore batch limit is 500.
  // For very large datasets, we might need to chunk this.
  // Given typical guild sizes, a single batch usually suffices.
  await batch.commit();
}
