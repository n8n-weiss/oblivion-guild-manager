-- ==========================================
-- OBLIVION MASTER CLEANUP & SETUP SCRIPT
-- ==========================================

-- PART 1: CLEAN UP DUPLICATES IN USER ROLES (Staff/Admins)
-- This keeps the latest record based on updated_at
DELETE FROM user_roles
WHERE uid IN (
    SELECT uid
    FROM (
        SELECT uid,
        ROW_NUMBER() OVER (PARTITION BY email ORDER BY updated_at DESC) as row_num
        FROM user_roles
    ) t
    WHERE t.row_num > 1
);

-- PART 2: CLEAN UP DUPLICATES IN ROSTER (Members)
-- Removes entries that don't have the 'OBL' prefix if an 'OBL' version exists
DELETE FROM roster
WHERE member_id NOT LIKE 'OBL%'
AND 'OBL' || member_id IN (SELECT member_id FROM roster);

-- PART 3: BOOTSTRAP STAFF (Optional)
-- Adds Admins/Officers from Roster to User Management if they are missing
INSERT INTO user_roles (uid, email, role, member_id)
SELECT 
    gen_random_uuid(),
    LOWER(REPLACE(discord, ' ', '')) || '@oblivion.com',
    CASE 
        WHEN guild_rank IN ('Guild Master', 'System Architect (Creator)') THEN 'admin'
        ELSE 'officer'
    END,
    member_id
FROM roster
WHERE guild_rank IN ('Admin', 'Officer', 'Commander', 'Vice Guild Master', 'Guild Master', 'System Architect (Creator)')
AND member_id NOT IN (SELECT member_id FROM user_roles)
AND discord IS NOT NULL
ON CONFLICT DO NOTHING;

-- PART 4: COMPLETE
SELECT 'Cleanup and Setup Complete!' as status;

