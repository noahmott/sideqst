export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  image_url: string | null;
  created_at: string;
}

export interface Quest {
  id: string;
  title: string;
  category_id: string;
  category?: Category;
  short_description: string;
  long_description: string;
  is_daily: boolean;
  is_geofenced: boolean;
  base_xp_reward: number;
  geofence_center?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  geofence_radius?: number;
  created_at: string;
  updated_at: string;
}

export interface QuestStep {
  id: string;
  quest_id: string;
  step_number: number;
  description: string;
  requires_check_in: boolean;
  created_at: string;
}

export interface UserQuest {
  id: string;
  user_id: string;
  quest_id: string;
  is_accepted: boolean;
  accepted_at: string | null;
  is_completed: boolean;
  completed_at: string | null;
  current_step: number;
  last_submission_at: string | null;
  created_at: string;
  quest?: Quest;
  steps?: QuestStep[];
}

export interface QuestSubmission {
  id: string;
  user_id: string;
  quest_id: string;
  step_id: string | null;
  image_url: string;
  check_in_location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  caption: string;
  created_at: string;
  quest?: {
    title: string;
  };
}

export interface QuestFilters {
  categories?: string[];
  isDaily?: boolean;
  isGeofenced?: boolean;
  searchQuery?: string;
} 