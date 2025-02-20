-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists postgis;

-- Drop existing types if they don't exist yet
drop type if not exists notification_type;
drop type if not exists achievement_reward_type;
drop type if not exists friendship_status;

-- Create custom types
create type friendship_status as enum ('pending', 'accepted', 'blocked');
create type achievement_reward_type as enum ('xp', 'badge', 'title');
create type notification_type as enum ('friend_request', 'quest_update', 'achievement_unlocked');

-- Create tables if they don't exist
create table if not exists categories (
    id uuid primary key default uuid_generate_v4(),
    name text unique not null,
    description text,
    icon text,
    color text,
    image_url text,
    created_at timestamptz default now()
);

create table if not exists profiles (
    user_id uuid primary key references auth.users(id),
    username text unique not null,
    avatar_url text,
    bio text,
    xp integer default 0,
    level integer default 1,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists invite_codes (
    id uuid primary key default uuid_generate_v4(),
    code text unique not null,
    generated_by uuid not null references profiles(user_id),
    redeemed_by uuid references profiles(user_id),
    is_used boolean default false,
    created_at timestamptz default now()
);

create table if not exists friendships (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references profiles(user_id),
    friend_id uuid not null references profiles(user_id),
    status friendship_status not null default 'pending',
    created_at timestamptz default now(),
    unique(user_id, friend_id)
);

create table if not exists quests (
    id uuid primary key default uuid_generate_v4(),
    title text not null,
    category_id uuid not null references categories(id),
    short_description text,
    long_description text,
    is_daily boolean default false,
    is_geofenced boolean default false,
    geofence_center geography(Point, 4326),
    geofence_radius integer, -- in meters
    base_xp_reward integer not null default 100, -- Base XP reward for completing the quest
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists quest_steps (
    id uuid primary key default uuid_generate_v4(),
    quest_id uuid not null references quests(id) on delete cascade,
    step_number integer not null,
    description text not null,
    requires_check_in boolean default false,
    step_xp_reward integer not null default 25, -- XP reward for completing this step
    created_at timestamptz default now(),
    unique(quest_id, step_number)
);

create table if not exists user_quests (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references profiles(user_id),
    quest_id uuid not null references quests(id),
    is_accepted boolean default false,
    accepted_at timestamptz,
    is_completed boolean default false,
    completed_at timestamptz,
    current_step integer default 0,
    last_submission_at timestamptz,
    created_at timestamptz default now(),
    unique(user_id, quest_id)
);

create table if not exists quest_submissions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references profiles(user_id),
    quest_id uuid not null references quests(id),
    step_id uuid references quest_steps(id),
    image_url text not null,
    check_in_location geography(Point, 4326),
    caption text,
    created_at timestamptz default now()
);

create table if not exists achievements (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    description text,
    reward_type achievement_reward_type not null,
    reward_value text not null,
    created_at timestamptz default now()
);

create table if not exists user_achievements (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references profiles(user_id),
    achievement_id uuid not null references achievements(id),
    awarded_at timestamptz default now(),
    unique(user_id, achievement_id)
);

create table if not exists notifications (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references profiles(user_id),
    type notification_type not null,
    message text not null,
    is_read boolean default false,
    created_at timestamptz default now()
);

create table if not exists comments (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references profiles(user_id),
    submission_id uuid not null references quest_submissions(id),
    comment_text text not null,
    created_at timestamptz default now()
);

-- Create indexes for better query performance
create index idx_user_quests_user_id on user_quests(user_id);
create index idx_user_quests_quest_id on user_quests(quest_id);
create index idx_quest_submissions_user_id on quest_submissions(user_id);
create index idx_quest_submissions_quest_id on quest_submissions(quest_id);
create index idx_notifications_user_id on notifications(user_id);
create index idx_comments_submission_id on comments(submission_id);

-- Create function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at columns
create trigger update_profiles_updated_at
    before update on profiles
    for each row
    execute function update_updated_at_column();

create trigger update_quests_updated_at
    before update on quests
    for each row
    execute function update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
alter table profiles enable row level security;
alter table invite_codes enable row level security;
alter table friendships enable row level security;
alter table quests enable row level security;
alter table quest_steps enable row level security;
alter table user_quests enable row level security;
alter table quest_submissions enable row level security;
alter table achievements enable row level security;
alter table user_achievements enable row level security;
alter table notifications enable row level security;
alter table comments enable row level security;

-- Create policies
-- Profiles: Users can read all profiles but only update their own
create policy "Profiles are viewable by everyone"
    on profiles for select
    using (true);

create policy "Users can update own profile"
    on profiles for update
    using (auth.uid() = user_id);

create policy "Users can create own profile"
    on profiles for insert
    with check (auth.uid() = user_id);

-- Invite codes: Users can verify invite codes and manage their own
drop policy if exists "Users can view own invite codes" on invite_codes;
create policy "Anyone can verify invite codes"
    on invite_codes for select
    using (true);

create policy "Users can create invite codes"
    on invite_codes for insert
    with check (auth.uid() = generated_by);

create policy "Users can update own invite codes"
    on invite_codes for update
    using (auth.uid() = generated_by);

-- Friendships: Users can view their own friendships
create policy "Users can view own friendships"
    on friendships for select
    using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can create friendships"
    on friendships for insert
    with check (auth.uid() = user_id);

-- Quests: All users can view quests
create policy "Quests are viewable by everyone"
    on quests for select
    using (true);

-- Quest steps: All users can view quest steps
create policy "Quest steps are viewable by everyone"
    on quest_steps for select
    using (true);

-- User quests: Users can view and manage their own quest progress
create policy "Users can view own quest progress"
    on user_quests for select
    using (auth.uid() = user_id);

create policy "Users can manage own quest progress"
    on user_quests for insert
    with check (auth.uid() = user_id);

create policy "Users can update own quest progress"
    on user_quests for update
    using (auth.uid() = user_id);

-- Quest submissions: Users can view all submissions but only create their own
create policy "Quest submissions are viewable by everyone"
    on quest_submissions for select
    using (true);

create policy "Users can create own submissions"
    on quest_submissions for insert
    with check (auth.uid() = user_id);

-- Comments: Users can view all comments but only create/update their own
create policy "Comments are viewable by everyone"
    on comments for select
    using (true);

create policy "Users can create own comments"
    on comments for insert
    with check (auth.uid() = user_id);

create policy "Users can update own comments"
    on comments for update
    using (auth.uid() = user_id);

-- Notifications: Users can only view and manage their own notifications
create policy "Users can view own notifications"
    on notifications for select
    using (auth.uid() = user_id);

create policy "Users can update own notifications"
    on notifications for update
    using (auth.uid() = user_id);

-- Create functions for XP calculations and level updates
create or replace function calculate_level(xp integer)
returns integer as $$
begin
    -- Simple level calculation: level = floor(sqrt(xp/100))
    -- This means:
    -- Level 1: 0-100 XP
    -- Level 2: 100-400 XP
    -- Level 3: 400-900 XP
    -- etc.
    return floor(sqrt(xp/100))::integer + 1;
end;
$$ language plpgsql;

create or replace function update_user_level()
returns trigger as $$
begin
    new.level := calculate_level(new.xp);
    return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update level when XP changes
create trigger update_level_on_xp_change
    before update of xp on profiles
    for each row
    execute function update_user_level();

-- Function to check friend synergy (10% XP bonus if friends complete within 5 minutes)
create or replace function check_friend_synergy(
    p_user_id uuid,
    p_quest_id uuid,
    p_completed_at timestamptz
)
returns boolean as $$
declare
    friend_completion_exists boolean;
begin
    select exists(
        select 1
        from user_quests uq
        join friendships f on (f.user_id = uq.user_id and f.friend_id = p_user_id)
            or (f.friend_id = uq.user_id and f.user_id = p_user_id)
        where uq.quest_id = p_quest_id
        and uq.is_completed = true
        and f.status = 'accepted'
        and abs(extract(epoch from (uq.completed_at - p_completed_at))) <= 300  -- 5 minutes = 300 seconds
    ) into friend_completion_exists;
    
    return friend_completion_exists;
end;
$$ language plpgsql;

-- Create Storage Buckets (if they don't exist)
insert into storage.buckets (id, name, public) 
values ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO NOTHING;

insert into storage.buckets (id, name, public) 
values ('quest-submissions', 'quest-submissions', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for profile-avatars bucket
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'profile-avatars' );

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    owner = auth.uid()
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'profile-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    owner = auth.uid()
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'profile-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    owner = auth.uid()
  );

-- Storage Policies for quest-submissions bucket
drop policy if exists "Quest submissions are publicly accessible" on storage.objects;
drop policy if exists "Users can upload their own quest submissions" on storage.objects;
drop policy if exists "Users can update their own quest submissions" on storage.objects;
drop policy if exists "Users can delete their own quest submissions" on storage.objects;

create policy "Quest submissions are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'quest-submissions' );

create policy "Users can upload their own quest submissions"
  on storage.objects for insert
  with check (
    bucket_id = 'quest-submissions' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    owner = auth.uid()
  );

create policy "Users can update their own quest submissions"
  on storage.objects for update
  using (
    bucket_id = 'quest-submissions' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    owner = auth.uid()
  );

create policy "Users can delete their own quest submissions"
  on storage.objects for delete
  using (
    bucket_id = 'quest-submissions' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    owner = auth.uid()
  );

-- Helper function to generate storage path for quest submissions
create or replace function generate_quest_submission_path(
    p_user_id uuid,
    p_quest_id uuid,
    p_file_name text
)
returns text as $$
begin
    return p_user_id || '/' || p_quest_id || '/' || p_file_name;
end;
$$ language plpgsql;

-- Helper function to generate storage path for profile avatars
create or replace function generate_avatar_path(
    p_user_id uuid,
    p_file_name text
)
returns text as $$
begin
    return p_user_id || '/' || p_file_name;
end;
$$ language plpgsql;


-- Enable RLS on categories table
alter table categories enable row level security;

-- Create policies for categories
create policy "Categories are viewable by everyone"
    on categories for select
    using (true);

create policy "Only authenticated users can insert categories"
    on categories for insert
    with check (auth.role() = 'authenticated');

create policy "Only authenticated users can update categories"
    on categories for update
    using (auth.role() = 'authenticated');

-- Storage Policies for category-images bucket
insert into storage.buckets (id, name, public) 
values ('category-images', 'category-images', true)
ON CONFLICT (id) DO NOTHING;

drop policy if exists "Category images are publicly accessible" on storage.objects;
drop policy if exists "Users can upload category images" on storage.objects;
drop policy if exists "Users can update category images" on storage.objects;
drop policy if exists "Users can delete category images" on storage.objects;

create policy "Category images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'category-images' );

create policy "Users can upload category images"
  on storage.objects for insert
  with check (
    bucket_id = 'category-images' AND
    auth.role() = 'authenticated'
  );

create policy "Users can update category images"
  on storage.objects for update
  using (
    bucket_id = 'category-images' AND
    auth.role() = 'authenticated'
  );

create policy "Users can delete category images"
  on storage.objects for delete
  using (
    bucket_id = 'category-images' AND
    auth.role() = 'authenticated'
  );

-- Function to award XP for completing a quest step
create or replace function award_step_xp(
    p_user_id uuid,
    p_quest_id uuid,
    p_step_id uuid
)
returns void as $$
declare
    v_step_xp integer;
    v_current_xp integer;
begin
    -- Get the step XP reward
    select step_xp_reward into v_step_xp
    from quest_steps
    where id = p_step_id;

    -- Get current user XP
    select xp into v_current_xp
    from profiles
    where user_id = p_user_id;

    -- Update user's XP
    update profiles
    set xp = v_current_xp + v_step_xp
    where user_id = p_user_id;
end;
$$ language plpgsql;

-- Function to award XP for completing an entire quest
create or replace function award_quest_completion_xp(
    p_user_id uuid,
    p_quest_id uuid
)
returns void as $$
declare
    v_base_xp integer;
    v_current_xp integer;
    v_friend_bonus boolean;
    v_total_xp integer;
begin
    -- Get the quest's base XP reward
    select base_xp_reward into v_base_xp
    from quests
    where id = p_quest_id;

    -- Check for friend synergy bonus
    select check_friend_synergy(p_user_id, p_quest_id, now()) into v_friend_bonus;
    
    -- Calculate total XP (with friend bonus if applicable)
    v_total_xp := case 
        when v_friend_bonus then v_base_xp * 1.1 -- 10% bonus
        else v_base_xp
    end;

    -- Get current user XP
    select xp into v_current_xp
    from profiles
    where user_id = p_user_id;

    -- Update user's XP
    update profiles
    set xp = v_current_xp + v_total_xp
    where user_id = p_user_id;
end;
$$ language plpgsql; 