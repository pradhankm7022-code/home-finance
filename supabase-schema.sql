-- Run this in your Supabase SQL Editor

-- Households table
create table households (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  invite_code text unique not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Profiles table (extends auth.users)
create table profiles (
  id uuid references auth.users(id) primary key,
  name text not null,
  household_id uuid references households(id),
  created_at timestamptz default now()
);

-- Transactions table
create table transactions (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references households(id) not null,
  user_id uuid references auth.users(id) not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  category text not null,
  date date not null,
  created_at timestamptz default now()
);

-- Row Level Security

alter table households enable row level security;
alter table profiles enable row level security;
alter table transactions enable row level security;

-- Households: members can read their own household
create policy "household members can read"
  on households for select
  using (
    id in (select household_id from profiles where id = auth.uid())
  );

create policy "authenticated users can insert"
  on households for insert
  with check (auth.uid() = created_by);

-- Profiles: users can read all profiles in their household
create policy "read same household profiles"
  on profiles for select
  using (
    household_id in (select household_id from profiles where id = auth.uid())
    or id = auth.uid()
  );

create policy "users can insert own profile"
  on profiles for insert
  with check (id = auth.uid());

create policy "users can update own profile"
  on profiles for update
  using (id = auth.uid());

-- Transactions: household members can read/write
create policy "household members can read transactions"
  on transactions for select
  using (
    household_id in (select household_id from profiles where id = auth.uid())
  );

create policy "household members can insert transactions"
  on transactions for insert
  with check (
    household_id in (select household_id from profiles where id = auth.uid())
    and user_id = auth.uid()
  );

create policy "transaction owner can update"
  on transactions for update
  using (user_id = auth.uid());

create policy "transaction owner can delete"
  on transactions for delete
  using (user_id = auth.uid());

-- Enable realtime for transactions
alter publication supabase_realtime add table transactions;
