import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { questService } from '../../lib/services/questService';
import { useAuth } from '../../lib/auth/AuthContext';
import type { Quest, QuestStep, UserQuest } from '../../lib/types/quest';

export default function QuestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quest, setQuest] = useState<Quest | null>(null);
  const [steps, setSteps] = useState<QuestStep[]>([]);
  const [userQuest, setUserQuest] = useState<UserQuest | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    loadQuestDetails();
  }, [id]);

  const loadQuestDetails = async () => {
    try {
      setLoading(true);
      const { quest, steps } = await questService.fetchQuestDetails(id);
      setQuest(quest);
      setSteps(steps);

      if (user) {
        const userQuests = await questService.fetchUserQuests(user.id);
        const currentQuest = userQuests.find(uq => uq.quest_id === id);
        setUserQuest(currentQuest || null);
      }
    } catch (error) {
      console.error('Error loading quest details:', error);
      Alert.alert('Error', 'Failed to load quest details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptQuest = async () => {
    if (!user || !quest) return;

    try {
      setSubmitting(true);
      const newUserQuest = await questService.acceptQuest(quest.id, user.id);
      setUserQuest(newUserQuest);
      Alert.alert('Success', 'Quest accepted! Check your quest log to track progress.');
    } catch (error) {
      console.error('Error accepting quest:', error);
      Alert.alert('Error', 'Failed to accept quest');
    } finally {
      setSubmitting(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const getCurrentLocation = async (): Promise<[number, number] | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for this quest');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({});
      return [location.coords.longitude, location.coords.latitude];
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get location');
      return null;
    }
  };

  const handleSubmitStep = async () => {
    if (!user || !quest || !userQuest || !selectedImage) return;

    try {
      setSubmitting(true);
      const currentStep = steps[userQuest.current_step - 1];
      
      let checkInLocation = undefined;
      if (currentStep.requires_check_in) {
        const location = await getCurrentLocation();
        if (!location) return;
        checkInLocation = {
          type: 'Point' as const,
          coordinates: location
        };
      }

      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      });

      await questService.submitQuestStep(
        {
          user_id: user.id,
          quest_id: quest.id,
          step_id: currentStep.id,
          image_url: '', // Will be set by the service
          check_in_location: checkInLocation,
          caption: `Completed step ${userQuest.current_step} of ${steps.length}`
        },
        base64
      );

      setSelectedImage(null);
      await loadQuestDetails(); // Refresh quest status
      Alert.alert('Success', 'Step submitted successfully!');
    } catch (error) {
      console.error('Error submitting step:', error);
      Alert.alert('Error', 'Failed to submit step');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!quest) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-circle" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>Quest not found</Text>
      </View>
    );
  }

  const currentStep = userQuest ? steps[userQuest.current_step - 1] : null;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{quest.title}</Text>
        <View style={styles.badges}>
          {quest.is_daily && (
            <View style={[styles.badge, styles.dailyBadge]}>
              <FontAwesome5 name="clock" size={12} color="#fff" />
              <Text style={styles.badgeText}>Daily</Text>
            </View>
          )}
          {quest.is_geofenced && (
            <View style={[styles.badge, styles.geoBadge]}>
              <FontAwesome5 name="map-marker-alt" size={12} color="#fff" />
              <Text style={styles.badgeText}>Location</Text>
            </View>
          )}
        </View>
      </View>

      <BlurView intensity={80} style={styles.contentCard}>
        <Text style={styles.description}>{quest.long_description}</Text>
      </BlurView>

      {userQuest ? (
        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Progress</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(userQuest.current_step / steps.length) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            Step {userQuest.current_step} of {steps.length}
          </Text>

          {currentStep && (
            <BlurView intensity={80} style={styles.stepCard}>
              <Text style={styles.stepTitle}>Current Step</Text>
              <Text style={styles.stepDescription}>{currentStep.description}</Text>
              
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
              ) : (
                <TouchableOpacity 
                  style={styles.imagePickerButton}
                  onPress={pickImage}
                >
                  <FontAwesome5 name="camera" size={24} color="#007AFF" />
                  <Text style={styles.imagePickerText}>Add Photo</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[styles.submitButton, (!selectedImage || submitting) && styles.buttonDisabled]}
                onPress={handleSubmitStep}
                disabled={!selectedImage || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <FontAwesome5 name="check" size={16} color="#fff" />
                    <Text style={styles.submitButtonText}>Submit Step</Text>
                  </>
                )}
              </TouchableOpacity>
            </BlurView>
          )}
        </View>
      ) : (
        <TouchableOpacity 
          style={[styles.acceptButton, submitting && styles.buttonDisabled]}
          onPress={handleAcceptQuest}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <FontAwesome5 name="play" size={16} color="#fff" />
              <Text style={styles.acceptButtonText}>Accept Quest</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginTop: 12,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  dailyBadge: {
    backgroundColor: '#007AFF',
  },
  geoBadge: {
    backgroundColor: '#34C759',
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  contentCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000',
  },
  progressSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  stepCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#000',
    marginBottom: 20,
  },
  imagePickerButton: {
    height: 200,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  imagePickerText: {
    color: '#007AFF',
    fontSize: 16,
    marginTop: 8,
  },
  selectedImage: {
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    margin: 20,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
}); 