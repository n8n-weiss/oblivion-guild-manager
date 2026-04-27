-- 1. Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create the Admin Password Update Function
CREATE OR REPLACE FUNCTION admin_update_user_password(target_user_id TEXT, new_password TEXT)
RETURNS TEXT AS $$
DECLARE
    calling_user_role TEXT;
    target_uuid UUID;
BEGIN
    -- SECURITY CHECK: Only 'architect' or 'admin' can run this
    SELECT role INTO calling_user_role 
    FROM public.user_roles 
    WHERE uid::text = auth.uid()::text;

    IF calling_user_role NOT IN ('architect', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only Architects or Admins can change passwords.';
    END IF;

    -- Try to cast the ID to UUID
    BEGIN
        target_uuid := target_user_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid ID: The target user has an old Firebase ID. Please delete and re-create this user in User Management.';
    END;

    -- Update the password in Supabase Auth
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf')),
        updated_at = NOW()
    WHERE id = target_uuid;

    RETURN 'Password updated successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant access to authenticated users
GRANT EXECUTE ON FUNCTION admin_update_user_password(TEXT, TEXT) TO authenticated;

