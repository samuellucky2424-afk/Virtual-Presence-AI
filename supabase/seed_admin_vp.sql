-- Virtual Presence AI admin seed.
--
-- Run this in the Supabase SQL editor after creating the admin user in
-- Authentication > Users. Replace admin@example.com with the real admin email,
-- then run the whole file.

SELECT set_config('virtual_presence_ai.admin_email', 'admin@example.com', false);

DO $$
DECLARE
    admin_email TEXT := LOWER(TRIM(current_setting('virtual_presence_ai.admin_email', true)));
    admin_user_id UUID;
BEGIN
    IF admin_email IS NULL
       OR admin_email = ''
       OR admin_email = 'admin@example.com' THEN
        RAISE EXCEPTION 'Replace admin@example.com with the real admin email before running this seed.';
    END IF;

    SELECT id
      INTO admin_user_id
      FROM auth.users
     WHERE LOWER(email) = admin_email
     ORDER BY created_at DESC
     LIMIT 1;

    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION 'No Supabase Auth user found for admin email %. Create the Auth user first, then re-run this seed.', admin_email;
    END IF;

    INSERT INTO public.admins_vp (user_id, email)
    VALUES (admin_user_id, admin_email)
    ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email;

    RAISE NOTICE 'Virtual Presence AI admin seeded: % (%)', admin_email, admin_user_id;
END $$;

SELECT
    a.user_id,
    a.email,
    public.is_admin_vp(a.user_id) AS is_admin_vp
FROM public.admins_vp a
WHERE LOWER(a.email) = LOWER(current_setting('virtual_presence_ai.admin_email', true));
