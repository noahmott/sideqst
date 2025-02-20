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
  useWindowDimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { supabase, createProfile } from '../../lib/supabase';
import { FontAwesome5 } from '@expo/vector-icons';
import { decode as base64Decode } from 'base64-arraybuffer';
import type { ProfileFormData } from './types';
import { useAuth } from '../../lib/auth/AuthContext';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const { height } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    username: '',
    bio: '',
  });
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Request permissions when component mounts
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Sorry, we need camera roll permissions to upload a photo');
      }
    })();
  }, []);

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
    if (!avatarUri) return null;

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

      console.log('Starting profile creation for user:', user.id);

      // Try to upload avatar but continue even if it fails
      let avatarUrl: string | null = null;
      if (avatarUri) {
        avatarUrl = await uploadAvatar(user.id);
        console.log('Avatar upload result:', avatarUrl);
      }

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
        
        // Manually trigger a profile refresh in the auth context
        await refreshProfile();
        
        router.replace('/(tabs)');
      } catch (err: any) {
        console.error('Profile creation error:', err);
        
        if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
          throw new Error('This username is already taken. Please choose another one.');
        }
        
        // Log the full error details
        console.error('Full error details:', {
          message: err.message,
          code: err.code,
          details: err.details,
          hint: err.hint,
          stack: err.stack
        });
        
        throw new Error('Failed to create profile. Please try again.');
      }
    } catch (err) {
      console.error('Profile setup error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during profile setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <BlurView intensity={90} tint="light" style={styles.formContainer}>
            <View style={styles.header}>
              <FontAwesome5 name="user-circle" size={48} color="#007AFF" />
              <Text style={styles.title}>Create Your Profile</Text>
              <Text style={styles.subtitle}>Let's set up your SideQst profile</Text>
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
                  <Text style={styles.avatarText}>Add Photo</Text>
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

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Complete Setup</Text>
                  <FontAwesome5 name="arrow-right" size={16} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </BlurView>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
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
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
}); 