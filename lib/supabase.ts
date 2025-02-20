import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Initialize Supabase client - these will be replaced with actual values from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auth helper functions
export const signUpWithEmail = async (email: string, password: string, inviteCode: string) => {
  // First verify the invite code
  const { data: inviteData, error: inviteError } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', inviteCode)
    .single();

  if (inviteError || !inviteData || inviteData.is_used) {
    throw new Error('Invalid or used invite code');
  }

  // Sign up the user
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) throw signUpError;

  // Mark invite code as used
  const { error: updateError } = await supabase
    .from('invite_codes')
    .update({ 
      is_used: true,
      redeemed_by: authData.user?.id 
    })
    .eq('id', inviteData.id);

  if (updateError) throw updateError;

  return authData;
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const createProfile = async (userId: string, profile: { username: string; bio?: string; avatar_url?: string }) => {
  console.log('Creating profile for user:', userId, 'with data:', profile);
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert([{
        user_id: userId,
        username: profile.username,
        bio: profile.bio || null,
        avatar_url: profile.avatar_url || null,
        xp: 0,
        level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error in createProfile:', error);
      if (error.code === '23505') {
        throw new Error('This username is already taken. Please choose another one.');
      }
      throw new Error(`Failed to create profile: ${error.message}`);
    }

    if (!data) {
      console.error('No profile data returned after creation');
      throw new Error('Failed to create profile: No data returned');
    }

    console.log('Profile created successfully:', data);
    return data;
  } catch (err) {
    console.error('Unexpected error in createProfile:', err);
    throw err;
  }
};

export const updateProfile = async (userId: string, updates: Partial<{ username: string; bio: string; avatar_url: string }>) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}; 