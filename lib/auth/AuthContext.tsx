import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import type { Profile } from '../../app/auth/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, inviteCode: string) => Promise<{ requiresEmailVerification: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
  });
  
  const router = useRouter();

  // Fetch profile data
  const fetchProfile = async (userId: string) => {
    console.log('Fetching profile for user:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No profile found for user:', userId);
          return null;
        }
        console.error('Error in profile fetch:', error);
        throw error;
      }
      console.log('Profile found:', data);
      return data;
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
      return null;
    }
  };

  // Verify invite code
  const verifyInviteCode = async (code: string) => {
    console.log('Verifying invite code:', code);
    const { data, error } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (error) {
      console.error('Error verifying invite code:', error);
      throw new Error(`Error verifying invite code: ${error.message}`);
    }
    
    if (!data) {
      console.error('No invite code found');
      throw new Error('Invalid invite code - not found');
    }
    
    if (data.is_used) {
      console.error('Invite code already used:', data);
      throw new Error('This invite code has already been used');
    }

    console.log('Invite code verified successfully:', data);
    return data;
  };

  // Update invite code status
  const markInviteCodeAsUsed = async (inviteId: string, userId: string) => {
    console.log('Marking invite code as used:', { inviteId, userId });
    const { error } = await supabase
      .from('invite_codes')
      .update({ 
        is_used: true,
        redeemed_by: userId 
      })
      .eq('id', inviteId);

    if (error) {
      console.error('Error marking invite code as used:', error);
      throw error;
    }
    console.log('Invite code marked as used successfully');
  };

  // Auth methods
  const signIn = async (email: string, password: string) => {
    const { data: { session, user }, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        throw new Error('Please verify your email address before signing in');
      }
      throw error;
    }

    if (user) {
      const profile = await fetchProfile(user.id);
      setState(prev => ({ ...prev, session, user, profile }));
    }
  };

  const signUp = async (email: string, password: string, inviteCode: string) => {
    try {
      console.log('Starting signup process for:', email);
      
      // First verify the invite code
      const inviteData = await verifyInviteCode(inviteCode);
      console.log('Invite code verified:', inviteData);

      // Then sign up the user
      const { data: { user, session }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'sideqst://verify-email',
        },
      });

      if (signUpError) {
        console.error('Error during signup:', signUpError);
        throw signUpError;
      }
      
      if (!user) {
        console.error('No user returned from signup');
        throw new Error('Signup failed - no user returned');
      }

      console.log('User created successfully:', user);

      // Mark invite code as used
      await markInviteCodeAsUsed(inviteData.id, user.id);

      // Create profile using the helper function
      try {
        const profileData = {
          username: formData.username.trim(),
          bio: formData.bio?.trim() || undefined,
          avatar_url: avatarUrl || undefined,
        };
        
        console.log('Creating profile with data:', profileData);
        const profile = await createProfile(user.id, profileData);

        console.log('Profile created successfully:', profile);
        // Update the auth state with the new profile
        setState(prev => ({ ...prev, profile }));
        router.replace('/(tabs)');
      } catch (err: any) {
        console.error('Profile creation error:', err);
        throw err;
      }

      // Return whether email verification is required
      return { requiresEmailVerification: session === null };
    } catch (error) {
      console.error('Signup process failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // First update the state
      setState({ 
        session: null, 
        user: null, 
        profile: null, 
        isLoading: false 
      });
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'sideqst://reset-password',
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  const resendVerificationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: 'sideqst://verify-email',
      },
    });
    if (error) throw error;
  };

  const refreshProfile = async () => {
    if (state.user) {
      const profile = await fetchProfile(state.user.id);
      setState(prev => ({ ...prev, profile }));
    }
  };

  // Handle auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setState(prev => ({ 
          ...prev, 
          session: null, 
          user: null, 
          profile: null, 
          isLoading: false 
        }));
        return;
      }

      setState(prev => ({ ...prev, session, user: session.user }));
      fetchProfile(session.user.id).then(profile => {
        setState(prev => ({ ...prev, profile, isLoading: false }));
      });
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, {
        hasSession: !!session,
        sessionUser: session?.user?.id
      });
      
      if (!session) {
        console.log('No session in state change, clearing auth state');
        setState(prev => ({ 
          ...prev, 
          session: null, 
          user: null, 
          profile: null,
          isLoading: false
        }));
        return;
      }

      console.log('Setting session and fetching profile');
      setState(prev => ({ ...prev, session, user: session.user, isLoading: true }));
      
      try {
        const profile = await fetchProfile(session.user.id);
        console.log('Profile fetch result:', { hasProfile: !!profile });
        setState(prev => ({ ...prev, profile, isLoading: false }));
      } catch (error) {
        console.error('Error fetching profile in auth change:', error);
        setState(prev => ({ ...prev, profile: null, isLoading: false }));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider 
      value={{
        ...state,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        resetPassword,
        updatePassword,
        resendVerificationEmail,
      }}
    >
      {!state.isLoading ? children : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 