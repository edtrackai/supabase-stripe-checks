-- create table public.ignored (id int);  comments are ignored
create table public.notes (id bigint primary key, user_id uuid not null, body text);
alter table public.notes enable row level security;
create policy "owner read" on public.notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "owner insert" on public.notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "owner update" on public.notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create table private.audit (id bigint);
create function public.is_owner(nid bigint) returns boolean language sql security definer set search_path = '' as $$ select exists (select 1 from public.notes where id = nid and user_id = (select auth.uid())) $$;
