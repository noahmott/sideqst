-- First, let's see the current table structure
\d quest_rewards;

-- Let's try a simple insert with just XP
insert into quest_rewards (quest_id, xp_reward)
select id, 100
from quests
where id = 'your-quest-id-here'
returning *;

-- Let's see what constraints exist
select con.*
from pg_catalog.pg_constraint con
inner join pg_catalog.pg_class rel
on rel.oid = con.conrelid
inner join pg_catalog.pg_namespace nsp
on nsp.oid = connamespace
where rel.relname = 'quest_rewards';

-- Let's see if there are any existing rows
select * from quest_rewards;

-- Try to create a completely new table for testing
create table quest_rewards_test (
    id uuid primary key default uuid_generate_v4(),
    quest_id uuid not null references quests(id),
    xp_reward integer not null default 100,
    badge_id uuid references badges(id),
    title_id uuid references titles(id),
    created_at timestamptz default now(),
    check (not (badge_id is not null and title_id is not null))
);

-- Try inserting into test table
insert into quest_rewards_test (quest_id, xp_reward)
select id, 100
from quests
limit 1
returning *; 