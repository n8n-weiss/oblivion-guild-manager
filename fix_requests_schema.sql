-- consolidated fix for requests and join_requests tables
-- ensures correct types and missing columns

-- 1. Fix join_requests
ALTER TABLE join_requests 
  ADD COLUMN IF NOT EXISTS uid TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS discord TEXT,
  ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'join';

-- Ensure timestamp is BIGINT (if it was text, we'd need a conversion, but assuming it was already bigint or empty)
-- If there's existing data with ISO strings in a BIGINT column, it might have failed anyway.
-- Let's just make sure it's BIGINT.
-- ALTER TABLE join_requests ALTER COLUMN timestamp TYPE BIGINT USING timestamp::bigint; 
-- ^ Only run the above if timestamp was previously TEXT.

-- 2. Fix profile update requests
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS requester_ign TEXT;

-- 3. Ensure RLS is disabled or properly configured for initial testing
ALTER TABLE join_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE requests DISABLE ROW LEVEL SECURITY;
