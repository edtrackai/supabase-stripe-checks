create table public.profiles (id uuid primary key, plan text);
create table public.notes (id bigint primary key, user_id uuid, body text);
alter table public.notes enable row level security;
create policy "read all" on public.notes for select using (true);
create policy "anon insert" on public.notes for insert to anon with check ((select auth.uid()) = user_id);
create policy "owner update" on public.notes for update using ((select auth.uid()) = user_id);
create function public.make_admin(uid uuid) returns void language sql security definer as $$ update public.profiles set plan = 'admin' where id = uid $$;
