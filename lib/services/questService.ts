import { supabase } from '../supabase';
import type { Quest, QuestStep, UserQuest, QuestSubmission, QuestFilters, Category } from '../types/quest';

export const questService = {
  // Fetch all categories
  async fetchCategories(): Promise<Category[]> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  // Fetch all available quests with optional filters
  async fetchQuests(filters?: QuestFilters): Promise<Quest[]> {
    try {
      let query = supabase
        .from('quests')
        .select(`
          *,
          category:categories (*)
        `);

      if (filters?.categories && filters.categories.length > 0) {
        query = query.in('category_id', filters.categories);
      }
      if (filters?.isDaily !== undefined) {
        query = query.eq('is_daily', filters.isDaily);
      }
      if (filters?.isGeofenced !== undefined) {
        query = query.eq('is_geofenced', filters.isGeofenced);
      }
      if (filters?.searchQuery) {
        query = query.ilike('title', `%${filters.searchQuery}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching quests:', error);
      return [];
    }
  },

  // Fetch a single quest with its steps and rewards
  async fetchQuestDetails(questId: string): Promise<{ 
    quest: Quest; 
    steps: QuestStep[];
    rewards: {
      xp_reward: number;
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
    }[];
  }> {
    try {
      const { data: quest, error: questError } = await supabase
        .from('quests')
        .select(`
          *,
          category:categories (*)
        `)
        .eq('id', questId)
        .single();

      if (questError) throw questError;

      const { data: steps, error: stepsError } = await supabase
        .from('quest_steps')
        .select('*')
        .eq('quest_id', questId)
        .order('step_number', { ascending: true });

      if (stepsError) throw stepsError;

      // Fetch rewards with badge and title details
      const { data: rewards, error: rewardsError } = await supabase
        .from('quest_rewards')
        .select(`
          *,
          badge:badges!quest_rewards_badge_id_fkey (*),
          title:titles!quest_rewards_title_id_fkey (*)
        `)
        .eq('quest_id', questId);

      if (rewardsError) throw rewardsError;

      return { 
        quest, 
        steps: steps || [],
        rewards: rewards?.map(reward => ({
          xp_reward: reward.xp_reward,
          badge: reward.badge,
          title: reward.title
        })) || []
      };
    } catch (error) {
      console.error('Error fetching quest details:', error);
      throw error;
    }
  },

  // Accept a quest
  async acceptQuest(questId: string, userId: string): Promise<UserQuest> {
    const { data, error } = await supabase
      .from('user_quests')
      .insert([{
        user_id: userId,
        quest_id: questId,
        is_accepted: true,
        accepted_at: new Date().toISOString(),
        current_step: 1
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Submit a quest step
  async submitQuestStep(
    submission: Omit<QuestSubmission, 'id' | 'created_at'>,
    imageFile: string
  ): Promise<QuestSubmission> {
    // First upload the image
    const fileName = `${submission.user_id}/${submission.quest_id}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('quest-submissions')
      .upload(fileName, imageFile, {
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });

    if (uploadError) throw uploadError;

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('quest-submissions')
      .getPublicUrl(fileName);

    // Create the submission record
    const { data, error } = await supabase
      .from('quest_submissions')
      .insert([{
        ...submission,
        image_url: publicUrl
      }])
      .select()
      .single();

    if (error) throw error;

    // Update user_quests progress
    await supabase
      .from('user_quests')
      .update({
        current_step: submission.step_id ? data.current_step + 1 : data.current_step,
        last_submission_at: new Date().toISOString()
      })
      .eq('user_id', submission.user_id)
      .eq('quest_id', submission.quest_id);

    return data;
  },

  // Fetch user's active quests
  async fetchUserQuests(userId: string): Promise<UserQuest[]> {
    const { data, error } = await supabase
      .from('user_quests')
      .select(`
        *,
        quest:quests (
          *
        )
      `)
      .eq('user_id', userId)
      .eq('is_accepted', true)
      .order('accepted_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Fetch quest submissions for a specific quest
  async fetchQuestSubmissions(questId: string, userId: string): Promise<QuestSubmission[]> {
    const { data, error } = await supabase
      .from('quest_submissions')
      .select('*')
      .eq('quest_id', questId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}; 