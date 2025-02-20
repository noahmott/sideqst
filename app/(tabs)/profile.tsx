import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  RefreshControl,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Modal
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Profile } from '../auth/types';

interface QuestSubmission {
  id: string;
  image_url: string;
  caption: string;
  created_at: string;
  quest: {
    title: string;
  };
}

interface Badge {
  id: string;
  name: string;
  icon: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [submissions, setSubmissions] = useState<QuestSubmission[]>([]);
  const [equippedBadges, setEquippedBadges] = useState<Badge[]>([]);
  const [equippedTitle, setEquippedTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGridView, setIsGridView] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const windowWidth = Dimensions.get('window').width;
  const imageSize = (windowWidth - 48) / 3; // 3 images per row with 16px padding

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch quest submissions
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('quest_submissions')
        .select(`
          id,
          image_url,
          caption,
          created_at,
          quest:quests (
            title
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (submissionsError) throw submissionsError;
      setSubmissions(submissionsData || []);

      // TODO: Fetch equipped badges and title once those tables are set up
      
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const renderQuestSubmission = ({ item }: { item: QuestSubmission }) => {
    if (isGridView) {
      return (
        <TouchableOpacity 
          style={[styles.submissionItem, { width: imageSize, height: imageSize }]}
          onPress={() => {
            // TODO: Implement submission detail view
          }}
        >
          <Image 
            source={{ uri: item.image_url }} 
            style={styles.submissionImage}
          />
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.feedItem}>
        <View style={styles.feedHeader}>
          <Image 
            source={{ uri: profile?.avatar_url || undefined }} 
            style={styles.feedAvatar}
          />
          <View>
            <Text style={styles.feedUsername}>{profile?.username}</Text>
            <Text style={styles.feedQuestTitle}>{item.quest.title}</Text>
          </View>
        </View>
        <Image 
          source={{ uri: item.image_url }} 
          style={styles.feedImage}
        />
        {item.caption && (
          <Text style={styles.feedCaption}>{item.caption}</Text>
        )}
      </View>
    );
  };

  const renderSettingsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showSettings}
      onRequestClose={() => setShowSettings(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity 
              onPress={() => setShowSettings(false)}
              style={styles.modalClose}
            >
              <FontAwesome5 name="times" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.settingsItem}>
            <FontAwesome5 name="trophy" size={20} color="#007AFF" style={styles.settingsIcon} />
            <Text style={styles.settingsText}>Achievements</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsItem}>
            <FontAwesome5 name="medal" size={20} color="#007AFF" style={styles.settingsIcon} />
            <Text style={styles.settingsText}>Badges</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsItem}>
            <FontAwesome5 name="crown" size={20} color="#007AFF" style={styles.settingsIcon} />
            <Text style={styles.settingsText}>Titles</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingsItem}
            onPress={() => {
              setShowSettings(false);
              router.push('/edit-profile');
            }}
          >
            <FontAwesome5 name="user-edit" size={20} color="#007AFF" style={styles.settingsIcon} />
            <Text style={styles.settingsText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.settingsItem, styles.signOutItem]}
            onPress={handleSignOut}
          >
            <FontAwesome5 name="sign-out-alt" size={20} color="#FF3B30" style={styles.settingsIcon} />
            <Text style={[styles.settingsText, styles.signOutText]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-circle" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>Could not load profile</Text>
      </View>
    );
  }

  const levelProgress = (profile.xp % 1000) / 1000;

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.settingsButton}
        onPress={() => setShowSettings(true)}
      >
        <FontAwesome5 name="cog" size={24} color="#007AFF" />
      </TouchableOpacity>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <FontAwesome5 name="user" size={40} color="#666" />
              </View>
            )}
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{profile.level}</Text>
            </View>
          </View>

          <Text style={styles.username}>{profile.username}</Text>
          
          {equippedTitle && (
            <Text style={styles.title}>{equippedTitle}</Text>
          )}

          <View style={styles.xpContainer}>
            <View style={styles.xpBar}>
              <View style={[styles.xpFill, { width: `${levelProgress * 100}%` }]} />
            </View>
            <Text style={styles.xpText}>
              {profile.xp % 1000} / 1000 XP to Level {profile.level + 1}
            </Text>
          </View>

          <View style={styles.badgeContainer}>
            {[...Array(5)].map((_, index) => (
              <View key={index} style={styles.badgePlaceholder}>
                <FontAwesome5 name="question" size={24} color="#ccc" />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.galleryContainer}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>Quest Gallery</Text>
            <View style={styles.viewToggle}>
              <TouchableOpacity 
                style={[styles.toggleButton, isGridView && styles.toggleActive]}
                onPress={() => setIsGridView(true)}
              >
                <FontAwesome5 name="th" size={20} color={isGridView ? "#007AFF" : "#666"} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleButton, !isGridView && styles.toggleActive]}
                onPress={() => setIsGridView(false)}
              >
                <FontAwesome5 name="list" size={20} color={!isGridView ? "#007AFF" : "#666"} />
              </TouchableOpacity>
            </View>
          </View>
          
          <FlatList
            key={isGridView ? 'grid' : 'list'}
            data={submissions}
            renderItem={renderQuestSubmission}
            keyExtractor={item => item.id}
            numColumns={isGridView ? 3 : 1}
            scrollEnabled={false}
            contentContainerStyle={isGridView ? styles.galleryGrid : styles.feedContainer}
            ListEmptyComponent={
              <View style={styles.emptyGallery}>
                <FontAwesome5 name="images" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No quest submissions yet</Text>
              </View>
            }
          />
        </View>
      </ScrollView>

      {renderSettingsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    textAlign: 'center',
  },
  settingsButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
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
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  levelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 12,
  },
  xpContainer: {
    width: '100%',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  xpBar: {
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  xpText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  badgePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  galleryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    padding: 8,
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: '#fff',
  },
  galleryGrid: {
    gap: 8,
  },
  feedContainer: {
    gap: 16,
  },
  submissionItem: {
    margin: 1,
  },
  submissionImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  feedItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  feedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  feedUsername: {
    fontSize: 16,
    fontWeight: '600',
  },
  feedQuestTitle: {
    fontSize: 14,
    color: '#666',
  },
  feedImage: {
    width: '100%',
    aspectRatio: 1,
  },
  feedCaption: {
    padding: 12,
    fontSize: 14,
    color: '#000',
  },
  emptyGallery: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalClose: {
    padding: 4,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  settingsIcon: {
    width: 32,
  },
  settingsText: {
    fontSize: 16,
    marginLeft: 12,
  },
  signOutItem: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  signOutText: {
    color: '#FF3B30',
  },
}); 