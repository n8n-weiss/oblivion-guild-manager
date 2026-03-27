import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export async function writeAuditLog(userEmail, userName, action, details) {
  try {
    await addDoc(collection(db, "auditlogs"), {
      userEmail,
      userName,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
