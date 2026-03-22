ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS line_display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS line_picture_url TEXT;

COMMENT ON COLUMN public.customers.line_display_name IS 'Display name from LINE profile API - may differ from full_name';
COMMENT ON COLUMN public.customers.line_picture_url IS 'Profile picture URL from LINE profile API (profile.line-scdn.net)';
