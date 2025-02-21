import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  useWindowDimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../lib/auth/AuthContext';
import type { AuthFormData } from './types';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    inviteCode: '',
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (!validatePassword(formData.password)) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    if (!isLogin && !formData.inviteCode?.trim()) {
      setError('Invite code is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    try {
      if (!validateForm()) return;

      setLoading(true);
      setError(null);

      if (showResetPassword) {
        await resetPassword(formData.email);
        setResetSent(true);
        return;
      }

      if (isLogin) {
        await signIn(formData.email, formData.password);
      } else {
        if (!formData.inviteCode) {
          throw new Error('Invite code is required');
        }
        const { requiresEmailVerification } = await signUp(formData.email, formData.password, formData.inviteCode);
        
        if (requiresEmailVerification) {
          router.push({
            pathname: '/auth/verify',
            params: { email: formData.email }
          });
        }
      }
    } catch (err) {
      let message = 'An error occurred';
      if (err instanceof Error) {
        // Handle specific error messages
        if (err.message.includes('Invalid login')) {
          message = 'Invalid email or password';
        } else if (err.message.includes('invite code')) {
          message = err.message;
        } else if (err.message.includes('already registered')) {
          message = 'This email is already registered';
        } else if (err.message.includes('verify your email')) {
          router.push({
            pathname: '/auth/verify',
            params: { email: formData.email }
          });
          return;
        }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    if (showResetPassword) {
      return (
        <>
          <View style={styles.logoContainer}>
            <FontAwesome5 name="lock" size={48} color="#007AFF" />
            <Text style={styles.title}>Reset Password</Text>
          </View>

          {resetSent ? (
            <>
              <View style={styles.successContainer}>
                <FontAwesome5 name="check-circle" size={24} color="#34C759" />
                <Text style={styles.successText}>
                  Password reset instructions have been sent to your email.
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.button}
                onPress={() => {
                  setShowResetPassword(false);
                  setResetSent(false);
                  setFormData({ email: '', password: '', inviteCode: '' });
                }}
              >
                <Text style={styles.buttonText}>Back to Login</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.description}>
                Enter your email address and we'll send you instructions to reset your password.
              </Text>
              
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={formData.email}
                onChangeText={(text) => {
                  setFormData({ ...formData, email: text });
                  setError(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
              />

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
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Instructions</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.switchButton}
                onPress={() => {
                  setShowResetPassword(false);
                  setError(null);
                  setFormData({ email: '', password: '', inviteCode: '' });
                }}
              >
                <Text style={styles.switchText}>Back to Login</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      );
    }

    return (
      <>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <FontAwesome5 name="map-marked-alt" size={48} color="#007AFF" />
            <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Join SideQst'}</Text>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              value={formData.email}
              onChangeText={(text) => {
                setFormData({ ...formData, email: text });
                setError(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#999"
              value={formData.password}
              onChangeText={(text) => {
                setFormData({ ...formData, password: text });
                setError(null);
              }}
              secureTextEntry
              autoComplete={isLogin ? "password" : "new-password"}
              textContentType={isLogin ? "password" : "newPassword"}
              returnKeyType={isLogin ? "done" : "next"}
              onSubmitEditing={() => {
                if (isLogin) {
                  handleSubmit();
                }
              }}
            />
            {!isLogin && (
              <Text style={styles.inputHint}>Must be at least 8 characters long</Text>
            )}
          </View>

          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Invite Code</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your invite code"
                placeholderTextColor="#999"
                value={formData.inviteCode}
                onChangeText={(text) => {
                  setFormData({ ...formData, inviteCode: text });
                  setError(null);
                }}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <FontAwesome5 name="exclamation-circle" size={16} color="#FF3B30" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.bottomContainer}>
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? 'Sign In' : 'Sign Up'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.buttonGroup}>
            <TouchableOpacity 
              style={styles.switchButton}
              onPress={() => {
                setIsLogin(!isLogin);
                setError(null);
                setFormData({ email: '', password: '', inviteCode: '' });
              }}
            >
              <Text style={styles.switchText}>
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </Text>
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity 
                style={styles.forgotButton}
                onPress={() => {
                  setShowResetPassword(true);
                  setError(null);
                }}
              >
                <Text style={styles.switchText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.content}>
          <BlurView intensity={90} tint="light" style={styles.formContainer}>
            {renderForm()}
          </BlurView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E0E0E0',
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    fontSize: 16,
    color: '#000',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 10,
    gap: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 14,
    flex: 1,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonGroup: {
    gap: 12,
    marginTop: 24,
  },
  switchButton: {
    alignItems: 'center',
  },
  switchText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  forgotButton: {
    alignItems: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  successText: {
    fontSize: 16,
    color: '#34C759',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  bottomContainer: {
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 10 : 24,
  },
}); 