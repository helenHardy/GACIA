-- Create a join table for Users <-> Branches
create table if not exists public.user_branches (
  user_id uuid references auth.users(id) on delete cascade not null,
  branch_id bigint references public.branches(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, branch_id)
);

-- Enable RLS
alter table public.user_branches enable row level security;

-- Policies
-- 1. Admins (or everyone for simplicity in this MVP) can view assignments
create policy "Enable read access for authenticated users"
  on public.user_branches for select
  using ( auth.role() = 'authenticated' );

-- 2. Admins can insert/delete (simplified: authenticated users can edit for MVP)
create policy "Enable all access for authenticated users"
  on public.user_branches for all
  using ( auth.role() = 'authenticated' );

-- Optional: Add useful index
create index if not exists user_branches_user_id_idx on public.user_branches(user_id);
