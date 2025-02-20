import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Alert
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { supabase, updateProfile } from '../lib/supabase';
import { FontAwesome5 } from '@expo/vector-icons';
import { decode as base64Decode } from 'base64-arraybuffer';
import type { Profile } from './auth/types';

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
  });
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [originalUsername, setOriginalUsername] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      
      setProfile(profileData);
      setFormData({
        username: profileData.username,
        bio: profileData.bio || '',
      });
      setOriginalUsername(profileData.username);
      if (profileData.avatar_url) {
        setAvatarUri(profileData.avatar_url);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    }
  };

  const pickImage = async () => {
    try {
      setError(null);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        // Validate file size (limit to 5MB)
        const response = await fetch(selectedAsset.uri);
        const blob = await response.blob();
        const fileSize = blob.size;
        
        if (fileSize > 5 * 1024 * 1024) {
          setError('Image size too large. Please choose an image under 5MB.');
          return;
        }

        setAvatarUri(selectedAsset.uri);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      setError('Failed to select image. Please try again.');
    }
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarUri || avatarUri === profile?.avatar_url) return profile?.avatar_url || null;

    try {
      console.log('Starting avatar upload process');
      
      // First convert to base64
      const base64Response = await fetch(avatarUri);
      const imageBlob = await base64Response.blob();
      
      // Convert blob to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to convert image to base64'));
          }
        };
        reader.onerror = () => {
          reject(new Error('Failed to read image file'));
        };
        reader.readAsDataURL(imageBlob);
      });

      const base64File = base64Data.split(',')[1];
      
      // Get file extension from mime type
      const fileExt = imageBlob.type.split('/')[1] || 'jpeg';
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      console.log('Attempting upload with base64 data');
      const { data, error } = await supabase.storage
        .from('profile-avatars')
        .upload(filePath, base64Decode(base64File), {
          contentType: imageBlob.type,
          upsert: true
        });

      if (error) {
        console.error('Storage upload error:', error);
        throw error;
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(filePath);

      console.log('Got public URL:', urlData);
      return urlData.publicUrl;
    } catch (err) {
      console.error('Avatar upload process failed:', err);
      if (err instanceof Error) {
        console.error('Full error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        });
      }
      throw err;
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate username
      if (!formData.username.trim()) {
        throw new Error('Username is required');
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user:', userError);
        throw new Error('Could not verify user session');
      }

      if (!user) {
        console.error('No user found in session');
        throw new Error('No user found');
      }

      // Only upload new avatar if it's changed
      let avatarUrl: string | null = null;
      if (avatarUri !== profile?.avatar_url) {
        avatarUrl = await uploadAvatar(user.id);
      }

      // Update profile
      const updates: any = {
        username: formData.username.trim(),
        bio: formData.bio?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (avatarUrl !== null) {
        updates.avatar_url = avatarUrl;
      }

      // Only update username if it's changed
      if (formData.username === originalUsername) {
        delete updates.username;
      }

      const updatedProfile = await updateProfile(user.id, updates);
      console.log('Profile updated successfully:', updatedProfile);
      
      Alert.alert(
        'Success',
        'Your profile has been updated',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      console.error('Profile update error:', err);
      if (err instanceof Error) {
        if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
          setError('This username is already taken. Please choose another one.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An error occurred while updating your profile');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.headerButton}
            >
              <Text style={styles.headerButtonText}>Cancel</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={handleSubmit}
              disabled={loading}
              style={styles.headerButton}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={styles.headerButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          ),
        }} 
      />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <BlurView intensity={90} tint="light" style={styles.formContainer}>
              <View style={styles.header}>
                <FontAwesome5 name="user-edit" size={48} color="#007AFF" />
                <Text style={styles.title}>Edit Profile</Text>
                <Text style={styles.subtitle}>Update your SideQst profile</Text>
              </View>

              <TouchableOpacity 
                style={styles.avatarContainer} 
                onPress={pickImage}
                activeOpacity={0.8}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <FontAwesome5 name="camera" size={24} color="#007AFF" />
                    <Text style={styles.avatarText}>Change Photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Username</Text>
                <View style={styles.inputContainer}>
                  <FontAwesome5 name="user" size={16} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Choose a username"
                    placeholderTextColor="#999"
                    value={formData.username}
                    onChangeText={(text) => {
                      setFormData({ ...formData, username: text });
                      setError(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Bio <Text style={styles.optional}>(optional)</Text></Text>
                <View style={[styles.inputContainer, styles.bioContainer]}>
                  <FontAwesome5 
                    name="comment-alt" 
                    size={16} 
                    color="#666" 
                    style={[styles.inputIcon, { marginTop: 12 }]} 
                  />
                  <TextInput
                    style={[styles.input, styles.bioInput]}
                    placeholder="Tell us about yourself"
                    placeholderTextColor="#999"
                    value={formData.bio}
                    onChangeText={(text) => setFormData({ ...formData, bio: text })}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <FontAwesome5 name="exclamation-circle" size={16} color="#FF3B30" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </BlurView>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  formContainer: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  avatarText: {
    color: '#007AFF',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  optional: {
    color: '#666',
    fontWeight: '400',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  inputIcon: {
    marginLeft: 16,
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#000',
  },
  bioContainer: {
    alignItems: 'flex-start',
  },
  bioInput: {
    height: 100,
    paddingTop: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    flex: 1,
  },
}); 