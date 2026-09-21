-- Nuclear reset: drop all policies and recreate cleanly
-- Run this in Supabase SQL Editor

-- Drop ALL existing policies
drop policy if exists "household members can read" on households;
drop policy if exists "authenticated users can insert" on households;
drop policy if exists "read same household profiles" on profiles;
drop policy if exists "users can insert own profile" on profiles;
drop policy if exists "users can update own profile" on profiles;
drop policy if exists "household members can read transactions" on transactions;
drop policy if exists "household members can insert transactions" on transactions;
drop policy if exists "transaction owner can update" on transactions;
drop policy if exists "transaction owner can delete" on transactions;

-- Drop old function if exists
drop function if exists get_my_household_id();

-- Create security definer function (bypasses RLS, no recursion)
create or replace function get_my_household_id()
returns uuid
language sql
security definer
stable
as $$
  select household_id from profiles where id = auth.uid()
$$;

-- HOUSEHOLDS policies
create policy "households_select"
  on households for select
  using (id = get_my_household_id());

create policy "households_insert"
  on households for insert
  with check (auth.uid() = created_by);

-- PROFILES policies
create policy "profiles_select"
  on profiles for select
  using (
    id = auth.uid()
    or household_id = get_my_household_id()
  );

create policy "profiles_insert"
  on profiles for insert
  with check (id = auth.uid());

create policy "profiles_update"
  on profiles for update
  using (id = auth.uid());

-- TRANSACTIONS policies
create policy "transactions_select"
  on transactions for select
  using (household_id = get_my_household_id());

create policy "transactions_insert"
  on transactions for insert
  with check (
    household_id = get_my_household_id()
    and user_id = auth.uid()
  );

create policy "transactions_update"
  on transactions for update
  using (user_id = auth.uid());

create policy "transactions_delete"
  on transactions for delete
  using (user_id = auth.uid());
