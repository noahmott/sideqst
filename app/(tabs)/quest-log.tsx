import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';

interface QuestProgress {
  id: string;
  quest: {
    id: string;
    title: string;
    category: string;
    short_description: string;
  };
  current_step: number;
  is_completed: boolean;
  accepted_at: string;
}

export default function QuestLogScreen() {
  const [activeQuests, setActiveQuests] = useState<QuestProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActiveQuests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('user_quests')
        .select(`
          id,
          current_step,
          is_completed,
          accepted_at,
          quest:quests (
            id,
            title,
            category,
            short_description
          )
        `)
        .eq('user_id', user.id)
        .eq('is_accepted', true)
        .order('accepted_at', { ascending: false });

      if (error) throw error;
      setActiveQuests(data || []);
    } catch (error) {
      console.error('Error fetching active quests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActiveQuests();
  };

  useEffect(() => {
    fetchActiveQuests();
  }, []);

  const renderQuestCard = ({ item }: { item: QuestProgress }) => (
    <TouchableOpacity style={styles.questCard}>
      <BlurView intensity={80} style={styles.questCardContent}>
        <View style={styles.questHeader}>
          <Text style={styles.questTitle}>{item.quest.title}</Text>
          {item.is_completed ? (
            <View style={[styles.badge, styles.completedBadge]}>
              <FontAwesome5 name="check" size={12} color="#fff" />
              <Text style={styles.badgeText}>Completed</Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.activeBadge]}>
              <FontAwesome5 name="running" size={12} color="#fff" />
              <Text style={styles.badgeText}>In Progress</Text>
            </View>
          )}
        </View>
        <Text style={styles.questCategory}>{item.quest.category}</Text>
        <Text style={styles.questDescription}>{item.quest.short_description}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(item.current_step / 3) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>Step {item.current_step} of 3</Text>
      </BlurView>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Text>Loading quests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={activeQuests}
        renderItem={renderQuestCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.questList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <FontAwesome5 name="scroll" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No active quests</Text>
            <Text style={styles.emptySubtext}>Go discover new quests!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  questList: {
    padding: 16,
  },
  questCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  questCardContent: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  questHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  completedBadge: {
    backgroundColor: '#34C759',
  },
  activeBadge: {
    backgroundColor: '#007AFF',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  questCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  questDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
}); 