-- 🛡️ OBLIVION STAFF AUTO-PROVISIONING SCRIPT
-- Ito ay awtomatikong gagawa ng entries sa user_roles para sa lahat ng staff sa roster.

INSERT INTO user_roles (email, role, member_id, updated_at)
SELECT 
    -- Gagawa tayo ng default email base sa IGN (halimbawa: weiss@oblivion.com)
    -- Pwede mong palitan ito sa User Management page mamaya kung may custom email sila.
    LOWER(REGEXP_REPLACE(ign, '[^a-zA-Z0-9]', '', 'g')) || '@oblivion.com' as email,
    CASE 
        WHEN guild_rank ILIKE '%architect%' THEN 'architect'
        WHEN guild_rank IN ('Admin', 'Guild Master', 'Vice Guild Master') THEN 'admin'
        WHEN guild_rank IN ('Officer', 'Commander') THEN 'officer'
        ELSE 'member'
    END as role,
    member_id,
    NOW() as updated_at
FROM roster
WHERE guild_rank IN ('Admin', 'Officer', 'Commander', 'Vice Guild Master', 'Guild Master')
   OR guild_rank ILIKE '%architect%'
ON CONFLICT (email) DO NOTHING;

-- 2. Check the results
SELECT email, role, member_id FROM user_roles;
