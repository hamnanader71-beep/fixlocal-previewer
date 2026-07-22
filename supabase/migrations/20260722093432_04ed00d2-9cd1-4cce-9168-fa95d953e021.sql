
-- Add source_url to leads for clickable source links
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Seed operating countries the client asked for (idempotent)
INSERT INTO public.countries (name, code) VALUES
  ('United States', 'US'),
  ('Lithuania', 'LT'),
  ('Latvia', 'LV'),
  ('United Arab Emirates', 'AE')
ON CONFLICT (code) DO NOTHING;

-- Reset admin password (admin@getfixlocal.com / admin@123)
UPDATE auth.users
SET encrypted_password = crypt('admin@123', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'admin@getfixlocal.com';
