-- Create initial system user for generating first invite codes
INSERT INTO auth.users (id, email)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system@sideqst.internal'
) ON CONFLICT (id) DO NOTHING;

-- Insert initial profile for system user
INSERT INTO public.profiles (user_id, username, xp, level, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'SYSTEM',
  0,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (user_id) DO NOTHING;

-- Insert test invite codes
INSERT INTO invite_codes (code, generated_by, redeemed_by, is_used, created_at)
VALUES
  (
    'SIDEQST-BETA-001',
    '00000000-0000-0000-0000-000000000000',
    NULL,
    false,
    CURRENT_TIMESTAMP
  ),
  (
    'SIDEQST-BETA-002',
    '00000000-0000-0000-0000-000000000000',
    NULL,
    false,
    CURRENT_TIMESTAMP
  ),
  (
    'SIDEQST-BETA-003',
    '00000000-0000-0000-0000-000000000000',
    NULL,
    false,
    CURRENT_TIMESTAMP
  ),
  (
    'SIDEQST-BETA-004',
    '00000000-0000-0000-0000-000000000000',
    NULL,
    false,
    CURRENT_TIMESTAMP
  ),
  (
    'SIDEQST-BETA-005',
    '00000000-0000-0000-0000-000000000000',
    NULL,
    false,
    CURRENT_TIMESTAMP
  );

-- Verify the invite codes were inserted correctly
SELECT code, generated_by, redeemed_by, is_used, created_at 
FROM invite_codes 
WHERE generated_by = '00000000-0000-0000-0000-000000000000'; 