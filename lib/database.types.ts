export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          username: string
          avatar_url: string | null
          bio: string | null
          xp: number
          level: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          username: string
          avatar_url?: string | null
          bio?: string | null
          xp?: number
          level?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          username?: string
          avatar_url?: string | null
          bio?: string | null
          xp?: number
          level?: number
          created_at?: string
          updated_at?: string
        }
      }
      invite_codes: {
        Row: {
          id: string
          code: string
          generated_by: string
          redeemed_by: string | null
          is_used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          generated_by: string
          redeemed_by?: string | null
          is_used?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          generated_by?: string
          redeemed_by?: string | null
          is_used?: boolean
          created_at?: string
        }
      }
    }
    Buckets: {
      'profile-avatars': {
        Path: string
        CreatePolicy: {
          INSERT: {
            check: "bucket_id = 'profile-avatars'::text"
            predicate: "bucket_id = 'profile-avatars'::text"
          }
        }
        UpdatePolicy: {
          UPDATE: {
            check: "bucket_id = 'profile-avatars'::text"
            predicate: "bucket_id = 'profile-avatars'::text"
            filter: "owner_id = auth.uid()"
          }
        }
      }
    }
  }
} 