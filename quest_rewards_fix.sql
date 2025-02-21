-- First, let's see what's in the quests table
select id, title from quests limit 5;

-- Drop and recreate with NO constraints first
drop table if exists quest_rewards cascade;

create table quest_rewards (
    id uuid primary key default uuid_generate_v4(),
    quest_id uuid not null references quests(id),
    xp_reward integer not null default 100,
    badge_id uuid references badges(id),
    title_id uuid references titles(id),
    created_at timestamptz default now()
);

-- Try a basic insert with just quest_id (XP will default to 100)
insert into quest_rewards (quest_id)
select id
from quests
limit 1
returning *;

-- If that works, try with explicit XP
insert into quest_rewards (quest_id, xp_reward)
values (
    (select id from quests limit 1),
    150
)
returning *;

-- If those work, then try with a badge
insert into quest_rewards (quest_id, xp_reward, badge_id)
values (
    (select id from quests limit 1),
    200,
    (select id from badges limit 1)
)
returning *;

-- Only after all those work, add the constraint
alter table quest_rewards
    add constraint quest_rewards_exclusive_rewards
    check (
        (badge_id is null or title_id is null)
    );

-- Enable RLS
alter table quest_rewards enable row level security;

-- Recreate the policy
create policy "Quest rewards are viewable by everyone"
    on quest_rewards for select
    using (true);

-- Backup existing data if any
create table if not exists quest_rewards_backup as 
select * from quest_rewards;

-- Restore data if needed (commented out for safety)
/*
insert into quest_rewards (quest_id, xp_reward, badge_id, title_id, created_at)
select quest_id, xp_reward, badge_id, title_id, created_at
from quest_rewards_backup
where badge_id is null or title_id is null;
*/ 