-- OBLIVION GUILD MANAGER - SUPABASE SCHEMA (UPDATED V2)

-- 1. Roster Table
CREATE TABLE IF NOT EXISTS roster (
    member_id TEXT PRIMARY KEY,
    ign TEXT NOT NULL,
    class TEXT,
    guild_rank TEXT DEFAULT 'Member',
    role TEXT DEFAULT 'DPS',
    status TEXT DEFAULT 'active',
    is_donator BOOLEAN DEFAULT FALSE,
    level INTEGER,
    cp BIGINT,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- 2. Events Table
CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    event_date DATE NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    auditor TEXT,
    attendance_data JSONB DEFAULT '{}',
    performance_data JSONB DEFAULT '{}',
    eo_ratings_data JSONB DEFAULT '{}',
    is_nested BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Absences Table
CREATE TABLE IF NOT EXISTS absences (
    id TEXT PRIMARY KEY,
    member_id TEXT REFERENCES roster(member_id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_email TEXT,
    user_name TEXT,
    action TEXT,
    details TEXT,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 4. User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
    uid TEXT PRIMARY KEY, -- Firebase Auth UID
    email TEXT,
    role TEXT DEFAULT 'member',
    member_id TEXT REFERENCES roster(member_id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Metadata Table
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Notifications Table (NEW!)
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    target_id TEXT DEFAULT 'all',
    title TEXT,
    message TEXT,
    type TEXT DEFAULT 'info',
    ts TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);

-- 7. Profile Update Requests
CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    member_id TEXT REFERENCES roster(member_id) ON DELETE CASCADE,
    old_data JSONB,
    new_data JSONB,
    status TEXT DEFAULT 'pending',
    timestamp BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Join/Application Requests
CREATE TABLE IF NOT EXISTS join_requests (
    id TEXT PRIMARY KEY,
    ign TEXT,
    class TEXT,
    email TEXT,
    status TEXT DEFAULT 'pending',
    timestamp BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- DISABLE RLS FOR INITIAL MIGRATION
ALTER TABLE roster DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE absences DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE metadata DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests DISABLE ROW LEVEL SECURITY;
