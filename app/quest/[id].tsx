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

interface QuestReward {
  xp_reward?: number;
  badge?: {
    id: string;
    title: string;
    description: string;
    image_url: string;
    rarity: string;
  };
  title?: {
    id: string;
    title: string;
    description: string;
    rarity: string;
  };
}

export default function QuestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quest, setQuest] = useState<Quest | null>(null);
  const [steps, setSteps] = useState<QuestStep[]>([]);
  const [rewards, setRewards] = useState<QuestReward[]>([]);
  const [userQuest, setUserQuest] = useState<UserQuest | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    loadQuestDetails();
  }, [id]);

  const loadQuestDetails = async () => {
    try {
      setLoading(true);
      const { quest, steps, rewards } = await questService.fetchQuestDetails(id);
      setQuest(quest);
      setSteps(steps);
      setRewards(rewards);

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

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'rgba(255, 215, 0, 0.15)'; // Gold
      case 'epic': return 'rgba(218, 112, 255, 0.15)'; // Purple
      case 'rare': return 'rgba(0, 191, 255, 0.15)'; // Blue
      case 'uncommon': return 'rgba(127, 255, 0, 0.15)'; // Green
      default: return 'rgba(255, 255, 255, 0.15)';
    }
  };

  const getRarityTextColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return '#FFD700'; // Bright gold
      case 'epic': return '#DA70FF'; // Bright purple
      case 'rare': return '#00BFFF'; // Bright blue
      case 'uncommon': return '#7FFF00'; // Bright green
      default: return '#FFFFFF';
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
    <View style={styles.container}>
      {/* Header with Category Image and Back Button */}
      <View style={styles.imageHeader}>
        <Image 
          source={{ uri: quest.category?.image_url || undefined }} 
          style={styles.headerImage}
          resizeMode="cover"
        />
        <View style={styles.headerOverlay} />
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        
        {/* Quest Title and Badges overlaid on image */}
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{quest.title}</Text>
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
      </View>

      <ScrollView style={styles.content}>
        {/* Quest Info Section */}
        <View style={styles.questInfo}>
          <View style={styles.questCard}>
            {/* Quest Description */}
            <Text style={styles.description}>
              {quest.long_description || quest.short_description}
            </Text>

            {/* Rewards Section */}
            <View style={styles.rewardsSection}>
              <View style={styles.rewardsDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.rewardsTitle}>Rewards</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.rewardsContainer}>
                {/* XP and Badge Rewards */}
                <View style={styles.badgeRow}>
                  {/* XP Rewards */}
                  {rewards.map((reward, index) => reward.xp_reward && (
                    <View key={`xp-${index}`} style={styles.rewardItem}>
                      <View style={[
                        styles.circularBadge,
                        { backgroundColor: `rgba(${quest.category?.color || '#007AFF'}, 0.15)` }
                      ]}>
                        <View style={[
                          styles.glowEffect,
                          { backgroundColor: quest.category?.color || '#007AFF' }
                        ]} />
                        <Text style={[styles.xpText, { color: quest.category?.color || '#007AFF' }]}>
                          {reward.xp_reward}
                        </Text>
                      </View>
                      <Text style={[styles.rewardLabel, { color: quest.category?.color || '#007AFF' }]}>XP</Text>
                    </View>
                  ))}

                  {/* Badge Rewards */}
                  {rewards.map((reward, index) => reward.badge && (
                    <View key={`badge-${index}`} style={styles.rewardItem}>
                      <View style={[
                        styles.circularBadge,
                        { backgroundColor: getRarityColor(reward.badge.rarity) }
                      ]}>
                        <View style={[
                          styles.glowEffect,
                          { backgroundColor: getRarityTextColor(reward.badge.rarity) }
                        ]} />
                        <Image 
                          source={{ uri: reward.badge.image_url }} 
                          style={styles.badgeImage}
                        />
                      </View>
                      <Text style={[
                        styles.rewardLabel,
                        { color: getRarityTextColor(reward.badge.rarity) }
                      ]}>
                        {reward.badge.title}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Title Rewards Section - Only show if there are title rewards */}
                {rewards.some(reward => reward.title) && (
                  <>
                    <View style={styles.titleDivider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.rewardsTitle}>Title</Text>
                      <View style={styles.dividerLine} />
                    </View>
                    <View style={styles.titleRow}>
                      {rewards.map((reward, index) => reward.title && (
                        <View key={`title-${index}`} style={styles.titleItem}>
                          <Text style={[
                            styles.titleText, 
                            { color: getRarityTextColor(reward.title.rarity) }
                          ]}>
                            "{reward.title.title}"
                          </Text>
                          <Text style={[
                            styles.rarityText, 
                            { color: getRarityTextColor(reward.title.rarity) }
                          ]}>
                            {reward.title.rarity} Title
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Quest Steps Section */}
        <View style={styles.stepsSection}>
          <Text style={styles.stepsTitle}>Quest Steps</Text>
          {steps.map((step, index) => (
            <View 
              key={step.id}
              style={[
                styles.stepCard,
                userQuest && userQuest.current_step > index + 1 && styles.completedStepCard
              ]}
            >
              <View style={styles.stepContent}>
                <View style={styles.stepLeft}>
                  <View style={[
                    styles.stepNumber,
                    userQuest && userQuest.current_step > index + 1 && styles.completedStepNumber
                  ]}>
                    {userQuest && userQuest.current_step > index + 1 ? (
                      <FontAwesome5 name="check" size={12} color="#fff" />
                    ) : (
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.stepLine} />
                </View>
                <View style={styles.stepRight}>
                  <View style={styles.stepHeader}>
                    <Text style={styles.stepTitle}>Step {index + 1}</Text>
                    {step.requires_check_in && (
                      <View style={styles.locationTag}>
                        <FontAwesome5 name="map-marker-alt" size={12} color="#fff" />
                        <Text style={styles.locationText}>Check-in Required</Text>
                      </View>
                    )}
                    <View style={[styles.miniXpBadge, { backgroundColor: quest.category?.color || '#007AFF' }]}>
                      <Text style={styles.miniXpText}>+{step.step_xp_reward} XP</Text>
                    </View>
                  </View>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                  {userQuest && userQuest.current_step === index + 1 && (
                    <TouchableOpacity 
                      style={styles.uploadButton}
                      onPress={pickImage}
                    >
                      <FontAwesome5 name="camera" size={16} color="#fff" />
                      <Text style={styles.uploadButtonText}>Upload Proof</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Accept/Submit Button */}
      {userQuest ? (
        selectedImage && (
          <BlurView intensity={80} style={styles.submitContainer}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            <TouchableOpacity 
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmitStep}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <FontAwesome5 name="check" size={16} color="#fff" />
                  <Text style={styles.submitButtonText}>Submit Proof</Text>
                </>
              )}
            </TouchableOpacity>
          </BlurView>
        )
      ) : (
        <BlurView intensity={80} style={styles.acceptContainer}>
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
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#121212',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginTop: 12,
  },
  imageHeader: {
    height: 250,
    width: '100%',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  headerContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginTop: -20,
  },
  questInfo: {
    margin: 16,
  },
  questCard: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#E0E0E0',
    marginBottom: 24,
  },
  rewardsSection: {
    marginTop: 8,
  },
  rewardsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  rewardsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B0B0',
    marginHorizontal: 12,
    textTransform: 'uppercase',
  },
  rewardsContainer: {
    gap: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleDivider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleRow: {
    alignItems: 'center',
  },
  titleItem: {
    alignItems: 'center',
    gap: 4,
  },
  rewardItem: {
    alignItems: 'center',
    gap: 2,
  },
  circularBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  glowEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    opacity: 0.15,
  },
  xpText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    zIndex: 2,
  },
  rewardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    color: '#fff',
    marginTop: 4,
    opacity: 0.9,
  },
  badgeImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    zIndex: 2,
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  rarityText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  stepsSection: {
    padding: 16,
    paddingTop: 0,
  },
  stepsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E0E0E0',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  stepCard: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  completedStepCard: {
    backgroundColor: '#1E1E1E',
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  stepContent: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  stepLeft: {
    alignItems: 'center',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedStepNumber: {
    backgroundColor: '#34C759',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 8,
  },
  stepRight: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  miniXpBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  miniXpText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  locationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  stepDescription: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
    marginBottom: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    alignSelf: 'flex-start',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  submitContainer: {
    padding: 16,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    gap: 12,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  submitButton: {
    flex: 1,
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
  acceptContainer: {
    padding: 16,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  acceptButton: {
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