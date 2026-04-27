import { supabase } from '../supabase';

/**
 * Handles the monthly reset process for Supabase.
 * In the new nested architecture, attendance and performance are stored within the event document.
 * 
 * @param {string} monthYear - Format 'YYYY-MM' (e.g., '2026-04')
 */
export async function resetMonthlyData(monthYear) {
  try {
    // In Supabase, if we want to "reset" the month, we typically archive old events
    // or clear the specific scoring fields. 
    
    // For now, we will perform a "Clean Reset" by archiving events from the target month
    const { error } = await supabase
      .from('events')
      .update({ status: 'archived' })
      .ilike('date', `${monthYear}%`);

    if (error) throw error;

    // Also clear any global metadata if needed (e.g. current month scores)
    await supabase
      .from('metadata')
      .update({ value: {} })
      .eq('key', 'monthly_scores');

    console.log(`Monthly reset completed for ${monthYear}`);
  } catch (err) {
    console.error("Monthly reset error:", err);
    throw err;
  }
}
