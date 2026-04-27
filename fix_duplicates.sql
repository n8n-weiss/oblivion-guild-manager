-- 1. Burahin lahat ng records na walang 'OBL' prefix at hindi 'TEMP-' 
-- (Ito yung mga pumasok nung nag-'Replace' ka kanina nang walang prefix)
DELETE FROM roster 
WHERE member_id NOT LIKE 'OBL%' 
  AND member_id NOT LIKE 'TEMP-%';

-- 2. Siguraduhin na ang mga natira ay malinis (walang spaces)
UPDATE roster 
SET member_id = TRIM(member_id),
    discord = TRIM(discord);

-- 3. Check results (Dapat wala nang duplicates dito)
SELECT member_id, ign, discord FROM roster ORDER BY member_id LIMIT 20;
