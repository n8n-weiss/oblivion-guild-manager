-- 1. Idagdag ang discord column sa roster
ALTER TABLE roster ADD COLUMN IF NOT EXISTS discord TEXT;

-- 2. Idagdag ang missing columns sa join_requests (para sa future sync)
ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS uid TEXT;
ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS discord TEXT;
ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'join';

-- 3. Siguraduhin na may role column din ang roster (kung wala pa)
ALTER TABLE roster ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'DPS';

-- 4. Update existing roster data: Extract discord from metadata if it exists
UPDATE roster SET discord = metadata->>'discord' WHERE discord IS NULL;

-- 5. Siguraduhin na ang member_id ay may OBL prefix (Cleanup query)
-- Paunawa: Ito ay gagana lang kung ang member_id ay 6 digits at walang OBL prefix pa.
UPDATE roster SET member_id = 'OBL' || member_id WHERE member_id NOT LIKE 'OBL%';
