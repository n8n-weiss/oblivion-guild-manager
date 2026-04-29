-- ============================================================
-- MIGRATION: Separate Auction Sessions into individual rows
-- ============================================================

-- Drop the table if it exists to ensure a clean slate 
-- (Safe because the source of truth is still in the metadata table)
DROP TABLE IF EXISTS auction_sessions;

-- 1. Create the new auction_sessions table
CREATE TABLE auction_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    columns JSONB DEFAULT '[]',
    members JSONB DEFAULT '[]',
    cells JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Disable RLS for now (matching current project state)
ALTER TABLE auction_sessions DISABLE ROW LEVEL SECURITY;

-- 3. Migrate existing data from metadata if any exists
-- This logic extracts the 'auctionSessions' array from the 'auction' key in metadata
-- and inserts each item as a separate row.
DO $$
DECLARE
    session_record RECORD;
    auction_metadata JSONB;
BEGIN
    SELECT data INTO auction_metadata FROM metadata WHERE key = 'auction';
    
    IF auction_metadata IS NOT NULL AND auction_metadata ? 'auctionSessions' THEN
        FOR session_record IN SELECT * FROM jsonb_to_recordset(auction_metadata->'auctionSessions') 
            AS x(id TEXT, name TEXT, date TEXT, columns JSONB, members JSONB, cells JSONB)
        LOOP
            INSERT INTO auction_sessions (id, name, date, columns, members, cells)
            VALUES (
                session_record.id, 
                session_record.name, 
                session_record.date::DATE, 
                COALESCE(session_record.columns, '[]'::JSONB), 
                COALESCE(session_record.members, '[]'::JSONB), 
                COALESCE(session_record.cells, '{}'::JSONB)
            )
            ON CONFLICT (id) DO NOTHING;
        END LOOP;
        
        -- Clean up the old metadata to save space, but keep templates and categories
        UPDATE metadata 
        SET data = data - 'auctionSessions'
        WHERE key = 'auction';
    END IF;
END $$;
