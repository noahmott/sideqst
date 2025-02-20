// This file is for type definitions only
export interface AuthFormData {
  email: string;
  password: string;
  inviteCode?: string;
}

export interface ProfileFormData {
  username: string;
  bio?: string;
  avatarUrl?: string;
}

export interface InviteCode {
  id: string;
  code: string;
  generated_by: string;
  redeemed_by: string | null;
  is_used: boolean;
  created_at: string;
}

export interface Profile {
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  xp: number;
  level: number;
  created_at: string;
  updated_at: string;
}

// This empty export satisfies the Expo Router requirement for a default export
export default {}; 