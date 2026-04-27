-- 1. Linisin ang member_id: Tanggalin ang spaces at siguruhing dikit ang OBL prefix
-- Halimbawa: 'OBL 123456' -> 'OBL123456'
UPDATE roster 
SET member_id = 'OBL' || REGEXP_REPLACE(member_id, '[^0-9]', '', 'g')
WHERE member_id IS NOT NULL;

-- 2. Linisin ang discord handles: Tanggalin ang extra spaces
UPDATE roster
SET discord = TRIM(discord)
WHERE discord IS NOT NULL;

-- 3. Siguraduhin na ang user_roles ay linked sa tamang member_id (Cleaned version)
-- (Paunawa: I-verify ulet ito pagkatapos ng login attempt)

-- 4. Check results
SELECT member_id, ign, discord FROM roster LIMIT 10;
