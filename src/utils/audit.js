import { supabase } from '../supabase';

export async function writeAuditLog(userEmail, userName, action, details) {
  try {
    await supabase.from('audit_logs').insert([{
      user_email: userEmail,
      user_name: userName,
      action,
      details,
      timestamp: new Date().toISOString(),
    }]);
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
