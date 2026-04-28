-- ============================================================
-- FIX: Add gl_mode, battlelog_audit, digest_meta columns
--      to the events table.
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- 1. Add gl_mode column (defaults to 'vale' for all old events)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS gl_mode TEXT NOT NULL DEFAULT 'vale';

-- 2. Add battlelog_audit column (JSONB, nullable)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS battlelog_audit JSONB DEFAULT NULL;

-- 3. Add digest_meta column (JSONB, nullable)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS digest_meta JSONB DEFAULT NULL;

-- Confirm columns were added:
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN ('gl_mode', 'battlelog_audit', 'digest_meta');
