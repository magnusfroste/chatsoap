-- 1. Inbjudningslänkar: alla (även utloggade) kunde lista och skriva över
--    oanvända länkar. Nu hämtas och löses en länk in bara via token med
--    funktionerna get_chat_invite / claim_chat_invite.
create or replace function public.get_chat_invite(p_token text)
returns table (id uuid, conversation_id uuid, conversation_name text, created_by uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.conversation_id, l.conversation_name, l.created_by, l.created_at
    from public.chat_invite_links l
   where l.token = p_token and l.used_by is null
$$;

create or replace function public.claim_chat_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update public.chat_invite_links
     set used_by = auth.uid(), used_at = now()
   where token = p_token and used_by is null
  returning conversation_id into v_conversation;
  if v_conversation is null then
    return null;
  end if;
  insert into public.conversation_members (conversation_id, user_id)
  select v_conversation, auth.uid()
  where not exists (
    select 1 from public.conversation_members
     where conversation_id = v_conversation and user_id = auth.uid()
  );
  return v_conversation;
end;
$$;

revoke execute on function public.get_chat_invite(text) from public;
revoke execute on function public.claim_chat_invite(text) from public, anon;
grant execute on function public.get_chat_invite(text) to anon, authenticated;
grant execute on function public.claim_chat_invite(text) to authenticated;

drop policy if exists "Anyone can view unused invite links" on public.chat_invite_links;
drop policy if exists "Anyone can use invite links" on public.chat_invite_links;

-- 2. Inbjudningskoder: appen använder dem inte; ingen ska kunna lista eller
--    ta andras koder.
drop policy if exists "Anyone can view unused invite codes to validate" on public.invite_codes;
drop policy if exists "Authenticated users can use invite codes" on public.invite_codes;
drop policy if exists "Creators can view their invite codes" on public.invite_codes;
create policy "Creators can view their invite codes" on public.invite_codes
  for select to authenticated using (created_by = auth.uid());

-- 3. Konversationer: användare kunde lägga till sig själva i vilken
--    konversation som helst och läsa den. Nu lägger bara skaparen till
--    medlemmar; inbjudna kommer in via claim_chat_invite.
drop policy if exists "Conversation creators can add members" on public.conversation_members;
create policy "Conversation creators can add members" on public.conversation_members
  for insert with check (
    exists (select 1 from public.conversations c
             where c.id = conversation_members.conversation_id and c.created_by = auth.uid())
  );

-- 4. Rum som hör till en konversation (samma id) kräver medlemskap i den.
--    Fristående rum fungerar som förut: den som har länken kan gå med.
drop policy if exists "Room creators can add members" on public.room_members;
create policy "Room creators can add members" on public.room_members
  for insert to authenticated with check (
    exists (select 1 from public.rooms r where r.id = room_members.room_id and r.created_by = auth.uid())
    or (
      user_id = auth.uid()
      and (
        not exists (select 1 from public.conversations c where c.id = room_members.room_id)
        or public.is_conversation_member(room_members.room_id, auth.uid())
      )
    )
  );
