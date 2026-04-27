-- 1. See duplicates first (Run this to check)
SELECT email, COUNT(*) 
FROM user_roles 
GROUP BY email 
HAVING COUNT(*) > 1;

-- 2. Clean up duplicates (Keep the latest one based on updated_at)
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

-- 3. Ensure email is unique (Optional but recommended to prevent future duplicates)
-- ALTER TABLE user_roles ADD CONSTRAINT unique_email UNIQUE (email);
