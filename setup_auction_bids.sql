-- Create the auction_bids table
CREATE TABLE IF NOT EXISTS auction_bids (
    member_id TEXT PRIMARY KEY REFERENCES roster(member_id) ON DELETE CASCADE,
    bids JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable Row Level Security to match the rest of the application
ALTER TABLE auction_bids DISABLE ROW LEVEL SECURITY;
