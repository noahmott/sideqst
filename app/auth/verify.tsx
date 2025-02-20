import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/AuthContext';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function VerifyScreen() {
  const router = useRouter();
  const { resendVerificationEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { email } = useLocalSearchParams<{ email: string }>();

  const handleResendEmail = async () => {
    if (!email) return;
    
    try {
      setLoading(true);
      setError(null);
      await resendVerificationEmail(email);
      setResendSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/auth/login');
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={90} tint="light" style={styles.content}>
        <View style={styles.iconContainer}>
          <FontAwesome5 name="envelope" size={48} color="#007AFF" />
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        
        <View style={styles.messageContainer}>
          <Text style={styles.description}>
            We've sent a verification email to
          </Text>
          <Text style={styles.emailText}>{email}</Text>
        </View>

        <View style={styles.cardContainer}>
          <Text style={styles.instructions}>
            Please check your email and click the verification link to continue.
          </Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <FontAwesome5 name="exclamation-circle" size={16} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {resendSuccess && (
          <View style={styles.successContainer}>
            <FontAwesome5 name="check-circle" size={16} color="#34C759" />
            <Text style={styles.successText}>Verification email resent!</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResendEmail}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Resend Verification Email</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={handleBackToLogin}
          >
            <Text style={styles.secondaryButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f0f0f0',
  },
  content: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  description: {
    fontSize: 17,
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  cardContainer: {
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  instructions: {
    fontSize: 15,
    color: '#000',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    gap: 8,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 15,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    gap: 8,
  },
  successText: {
    color: '#34C759',
    fontSize: 15,
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
}); 