-- Fix households insert policy
-- Run this in Supabase SQL Editor

drop policy if exists "households_insert" on households;
drop policy if exists "households_select" on households;

-- Allow any authenticated user to insert a household
create policy "households_insert"
  on households for insert
  with check (auth.role() = 'authenticated');

-- Allow reading if you created it OR you're a member
create policy "households_select"
  on households for select
  using (
    created_by = auth.uid()
    or id = get_my_household_id()
  );
