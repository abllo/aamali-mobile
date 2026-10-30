-- =====================================================================
--  أعمالي (نسخة الجوال) — الحضور والانصراف
--  جداول، صلاحيات RLS، قراءة شاشة حاضر+ من الاختصار، الموقع، والإشعارات.
--  الحسابات نفسها (السماح 6:59، الدوام المرن، الخطة) في الواجهة ودالة push (rules.ts)،
--  وقاعدة البيانات تحفظ الأوقات ومصدرها بس.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------- الجداول ----------
create table if not exists public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  settings   jsonb not null default '{}',
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create table if not exists public.days (
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  date           date not null,
  enter          text check (enter ~ '^\d{2}:\d{2}(:\d{2})?$'),
  exit           text check (exit ~ '^\d{2}:\d{2}(:\d{2})?$'),
  enter_source   text,
  exit_source    text,
  kind           text check (kind in ('excuse', 'leave', 'external', 'training', 'holiday')),
  excuse_minutes int check (excuse_minutes >= 0),
  excuse_state   text check (excuse_state in ('submitted', 'approved')),
  note           text,
  arrived_at     text,
  left_at        text,
  updated_at     timestamptz not null default now(),
  primary key (user_id, date)
);

-- ما قرأه الاختصار (القيم المستخرجة بس، بدون نص الشاشة)
create table if not exists public.evidence (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  at      timestamptz not null default now(),
  kind    text not null,
  data    jsonb not null default '{}'
);
create index if not exists evidence_user_at on public.evidence (user_id, at desc);

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  p256dh     text not null,
  auth       text not null,
  device     text,
  created_at timestamptz not null default now(),
  last_ok    timestamptz
);

create table if not exists public.push_sent (
  user_id uuid not null references auth.users on delete cascade,
  key     text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.push_config (
  id            int primary key default 1 check (id = 1),
  vapid_public  text,
  vapid_private jsonb,
  hook_secret   text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  function_url  text,
  subject       text not null default 'mailto:aamali@example.com'
);
insert into public.push_config (id) values (1) on conflict do nothing;

-- ---------- الصلاحيات ----------
alter table public.profiles enable row level security;
alter table public.days enable row level security;
alter table public.evidence enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_sent enable row level security;
alter table public.push_config enable row level security;

drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles for select using (user_id = auth.uid());
drop policy if exists own_days on public.days;
create policy own_days on public.days for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own_evidence on public.evidence;
create policy own_evidence on public.evidence for select using (user_id = auth.uid());
-- push_subscriptions / push_sent / push_config: بدون سياسات = ما أحد يوصلها إلا الدوال

revoke all on public.push_config from anon, authenticated;

-- ---------- أدوات ----------
create or replace function public.riyadh_now() returns timestamp language sql stable as $$
  select now() at time zone 'Asia/Riyadh'
$$;

create or replace function public.hm_to_min(t text) returns int language sql immutable as $$
  select case when t ~ '^\d{2}:\d{2}' then split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int end
$$;

create or replace function public.src_rank(s text) returns int language sql immutable as $$
  select case s when 'manual' then 5 when 'hadir' then 4 when 'last' then 3 when 'success' then 2 when 'open' then 1 else 0 end
$$;

-- يطلب من دالة push تفحص الإشعارات الحين (لمستخدم واحد أو للكل)
create or replace function public.tick_call(p_user uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare c push_config;
begin
  select * into c from push_config where id = 1;
  if c.function_url is null then return; end if;
  perform net.http_post(
    url := c.function_url,
    body := jsonb_build_object('secret', c.hook_secret, 'kind', 'tick', 'user', p_user),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000);
end $$;

-- ---------- من التطبيق ----------
create or replace function public.my_profile() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into profiles (user_id) values (auth.uid()) on conflict do nothing;
  select * into p from profiles where user_id = auth.uid();
  return jsonb_build_object('settings', p.settings, 'token', p.token);
end $$;

create or replace function public.save_settings(p_settings jsonb) returns void
language sql security definer set search_path = public as $$
  update profiles set settings = coalesce(p_settings, '{}') where user_id = auth.uid();
$$;

create or replace function public.rotate_token() returns text
language sql security definer set search_path = public as $$
  update profiles set token = replace(gen_random_uuid()::text, '-', '') where user_id = auth.uid() returning token;
$$;

-- حفظ يوم من التطبيق (التعديل اليدوي)
create or replace function public.save_day(p_day jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into days (user_id, date, enter, exit, enter_source, exit_source, kind, excuse_minutes, excuse_state, note, updated_at)
  values (auth.uid(), (p_day->>'date')::date, nullif(p_day->>'enter', ''), nullif(p_day->>'exit', ''),
          p_day->>'enter_source', p_day->>'exit_source', nullif(p_day->>'kind', ''),
          (p_day->>'excuse_minutes')::int, nullif(p_day->>'excuse_state', ''), nullif(p_day->>'note', ''), now())
  on conflict (user_id, date) do update set
    enter = excluded.enter, exit = excluded.exit, enter_source = excluded.enter_source, exit_source = excluded.exit_source,
    kind = excluded.kind, excuse_minutes = excluded.excuse_minutes, excuse_state = excluded.excuse_state,
    note = excluded.note, updated_at = now();
  perform tick_call(auth.uid());
end $$;

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_device text default null) returns void
language sql security definer set search_path = public as $$
  insert into push_subscriptions (endpoint, user_id, p256dh, auth, device)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, p_device)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device;
$$;

create or replace function public.push_unsubscribe(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- ---------- قراءة شاشة حاضر+ ----------
-- يحط وقت دخول أو خروج حسب قوة المصدر: يدوي > حاضر+ > آخر بصمة > لحظة النجاح
create or replace function public.apply_punch(p_user uuid, p_date date, p_field text, p_time text, p_src text) returns boolean
language plpgsql security definer set search_path = public as $$
declare d days; cur text; cur_src text;
begin
  if p_time !~ '^\d{2}:\d{2}(:\d{2})?$' then return false; end if;
  insert into days (user_id, date) values (p_user, p_date) on conflict do nothing;
  select * into d from days where user_id = p_user and date = p_date for update;
  cur := case when p_field = 'enter' then d.enter else d.exit end;
  cur_src := case when p_field = 'enter' then d.enter_source else d.exit_source end;
  -- نفس الدقيقة: نضيف الثواني لو وصلت (من «تاريخ آخر بصمة») ونحتفظ بالمصدر الأقوى
  if cur is not null and left(cur, 5) = left(p_time, 5) then
    if length(p_time) > length(cur) or src_rank(p_src) > src_rank(cur_src) then
      if p_field = 'enter' then
        update days set enter = case when length(p_time) > length(cur) then p_time else cur end,
               enter_source = case when src_rank(p_src) > src_rank(cur_src) then p_src else cur_src end, updated_at = now()
        where user_id = p_user and date = p_date;
      else
        update days set exit = case when length(p_time) > length(cur) then p_time else cur end,
               exit_source = case when src_rank(p_src) > src_rank(cur_src) then p_src else cur_src end, updated_at = now()
        where user_id = p_user and date = p_date;
      end if;
    end if;
    return false;
  end if;
  if cur is not null and src_rank(cur_src) > src_rank(p_src) then return false; end if;
  if p_field = 'enter' then
    update days set enter = p_time, enter_source = p_src, updated_at = now(),
      kind = case when p_src in ('hadir', 'last') then null else kind end
    where user_id = p_user and date = p_date;
  else
    update days set exit = p_time, exit_source = p_src, updated_at = now() where user_id = p_user and date = p_date;
  end if;
  return true;
end $$;

-- الاختصار يرسل النص المقروء من الشاشة: { token, text }
create or replace function public.hadir_ingest(token text, text text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_now timestamp := riyadh_now();
  v_today date := v_now::date;
  v_hm text := to_char(v_now, 'HH24:MI');
  t text := translate(left(coalesce($2, ''), 20000), '٠١٢٣٤٥٦٧٨٩', '0123456789');
  seg text; i int; j int;
  v_times text[];
  m text[];
  v_last_date date; v_last_time text;
  d days;
  v_changed boolean := false;
  v_rest text;
  v_success boolean;
begin
  select user_id into v_user from profiles p where p.token = $1;
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'token'); end if;

  -- ١) الشاشة الرئيسية: الوقت تحت «بصمة الدخول» و«بصمة الخروج» (أدق مصدر)
  i := position('بصمة الدخول' in t);
  if i > 0 then
    seg := substr(t, i + length('بصمة الدخول'));
    j := position('تاريخ اخر بصمة' in seg);
    if j = 0 then j := position('تاريخ آخر بصمة' in seg); end if;
    seg := case when j > 0 then left(seg, j - 1) else left(seg, 160) end;
    seg := regexp_replace(seg, '\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}', '', 'g'); -- وقت الوردية
    select array_agg(x[1] || ':' || x[2]) into v_times
      from regexp_matches(seg, '(?<![\d:])([01]\d|2[0-3]):([0-5]\d)(?![\d:])', 'g') as x;
    if v_times is not null then
      if array_length(v_times, 1) >= 1 then v_changed := apply_punch(v_user, v_today, 'enter', v_times[1], 'hadir') or v_changed; end if;
      if array_length(v_times, 1) >= 2 and hm_to_min(v_times[2]) > hm_to_min(v_times[1]) then
        v_changed := apply_punch(v_user, v_today, 'exit', v_times[2], 'hadir') or v_changed;
      end if;
    end if;
  end if;

  -- ٢) «تاريخ آخر بصمة»: رسمي بالثانية، ويصحح الأيام اللي فاتت
  m := regexp_match(t, '(20\d\d-\d\d-\d\d)\s+(\d\d):(\d\d)(?::(\d\d))?');
  if m is not null then
    v_last_date := m[1]::date;
    v_last_time := m[2] || ':' || m[3] || coalesce(':' || m[4], '');
    if v_last_date between v_today - 14 and v_today then
      select * into d from days where user_id = v_user and date = v_last_date;
      if v_last_date = v_today and (d is null or d.enter is null) then
        v_changed := apply_punch(v_user, v_today, 'enter', v_last_time, 'last') or v_changed;
      elsif d.enter is not null and left(d.enter, 5) = left(v_last_time, 5) then
        perform apply_punch(v_user, v_last_date, 'enter', v_last_time, 'last'); -- يضيف ثواني الحضور
      elsif d.enter is not null and hm_to_min(v_last_time) >= hm_to_min(d.enter) + 30 then
        v_changed := apply_punch(v_user, v_last_date, 'exit', v_last_time, 'last') or v_changed;
      end if;
    end if;
  end if;

  -- ٣) رسالة النجاح (مؤقت لين يجي الرسمي)
  v_success := t ~ '(تم\s*(بنجاح|تسجيل|اثبات|إثبات))|بنجاح' and t !~ 'فشل';
  if v_success then
    select * into d from days where user_id = v_user and date = v_today;
    if d is null or d.enter is null then
      v_changed := apply_punch(v_user, v_today, 'enter', v_hm, 'success') or v_changed;
    elsif d.exit is null and hm_to_min(v_hm) >= hm_to_min(d.enter) + 30 then
      v_changed := apply_punch(v_user, v_today, 'exit', v_hm, 'success') or v_changed;
    end if;
  end if;

  -- ٤) «انت اليوم في راحة/إجازة»
  if t ~ 'انت اليوم في' then
    v_rest := case when t ~ '(إ|ا)جازة' then 'leave' when t ~ 'راحة' then 'holiday' end;
    if v_rest is not null then
      update days set kind = v_rest, updated_at = now()
        where user_id = v_user and date = v_today and enter is null and kind is null;
      if not found and not exists (select 1 from days where user_id = v_user and date = v_today) then
        insert into days (user_id, date, kind) values (v_user, v_today, v_rest);
        v_changed := true;
      end if;
    end if;
  end if;

  if v_changed then
    insert into evidence (user_id, kind, data) values (v_user, 'hadir', jsonb_build_object(
      'times', v_times, 'last', case when m is not null then m[1] || ' ' || v_last_time end, 'success', v_success, 'rest', v_rest, 'at', v_hm));
    perform tick_call(v_user);
  end if;
  select * into d from days where user_id = v_user and date = v_today;
  return jsonb_build_object('ok', true, 'changed', v_changed, 'enter', d.enter, 'exit', d.exit);
end $$;

-- الموقع: { token, kind: 'arrive' | 'leave' }
create or replace function public.geo_event(token text, kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_now timestamp := riyadh_now();
begin
  select user_id into v_user from profiles p where p.token = $1;
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'token'); end if;
  insert into days (user_id, date) values (v_user, v_now::date) on conflict do nothing;
  if $2 = 'arrive' then
    update days set arrived_at = coalesce(arrived_at, to_char(v_now, 'HH24:MI')) where user_id = v_user and date = v_now::date;
  elsif $2 = 'leave' then
    update days set left_at = to_char(v_now, 'HH24:MI') where user_id = v_user and date = v_now::date;
  else
    return jsonb_build_object('ok', false, 'error', 'kind');
  end if;
  insert into evidence (user_id, kind, data) values (v_user, 'geo', jsonb_build_object('kind', $2, 'at', to_char(v_now, 'HH24:MI')));
  perform tick_call(v_user);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- لدالة push (مفتاح الخادم فقط) ----------
create or replace function public.push_config_get() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('vapid_public', vapid_public, 'vapid_private', vapid_private, 'hook_secret', hook_secret,
                            'function_url', function_url, 'subject', subject)
  from push_config where id = 1;
$$;

create or replace function public.push_config_set(p_public text, p_private jsonb, p_function_url text) returns jsonb
language sql security definer set search_path = public as $$
  update push_config set vapid_public = coalesce(p_public, vapid_public), vapid_private = coalesce(p_private, vapid_private),
         function_url = coalesce(p_function_url, function_url)
  where id = 1;
  select push_config_get();
$$;

-- كل اللي تحتاجه الدالة عشان تقرر الإشعارات: الإعدادات + آخر ٧٠ يوم + الأجهزة + اللي انرسل
create or replace function public.tick_inputs(p_user uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', p.user_id,
    'settings', p.settings,
    'days', (select coalesce(jsonb_agg(jsonb_build_object(
        'date', d.date, 'enter', d.enter, 'exit', d.exit, 'enterSource', d.enter_source, 'exitSource', d.exit_source,
        'kind', d.kind, 'excuseMinutes', d.excuse_minutes, 'excuseState', d.excuse_state, 'note', d.note,
        'arrivedAt', d.arrived_at, 'leftAt', d.left_at)), '[]')
      from days d where d.user_id = p.user_id and d.date >= (riyadh_now()::date - 70)),
    'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]')
      from push_subscriptions s where s.user_id = p.user_id),
    'sent', (select coalesce(jsonb_agg(x.key), '[]') from push_sent x where x.user_id = p.user_id and x.sent_at > now() - interval '40 days')
  )), '[]')
  from profiles p
  where (p_user is null or p.user_id = p_user)
    and exists (select 1 from push_subscriptions s where s.user_id = p.user_id);
$$;

-- يسجل المفاتيح ويرجع الجديد منها بس (يمنع التكرار لو اشتغلت الدالة مرتين بنفس اللحظة)
create or replace function public.push_mark_sent(p_user uuid, p_keys text[]) returns text[]
language sql security definer set search_path = public as $$
  with ins as (
    insert into push_sent (user_id, key) select p_user, k from unnest(p_keys) k
    on conflict do nothing returning key
  ) select coalesce(array_agg(key), '{}') from ins;
$$;

create or replace function public.push_result(p_endpoint text, p_ok boolean) returns void
language sql security definer set search_path = public as $$
  update push_subscriptions set last_ok = now() where p_ok and endpoint = p_endpoint;
  delete from push_subscriptions where not p_ok and endpoint = p_endpoint;
$$;

create or replace function public.push_test_messages(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth,
    'payload', jsonb_build_object('title', 'أعمالي ✓', 'body', 'الإشعارات شغالة على هذا الجهاز', 'tag', 'test', 'url', './'))), '[]')
  from push_subscriptions where user_id = p_user;
$$;

-- ---------- من يقدر ينادي وش ----------
revoke execute on function public.apply_punch(uuid, date, text, text, text) from public, anon, authenticated;
revoke execute on function public.tick_call(uuid) from public, anon, authenticated;
revoke execute on function public.push_config_get() from public, anon, authenticated;
revoke execute on function public.push_config_set(text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.tick_inputs(uuid) from public, anon, authenticated;
revoke execute on function public.push_mark_sent(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.push_result(text, boolean) from public, anon, authenticated;
revoke execute on function public.push_test_messages(uuid) from public, anon, authenticated;
grant execute on function public.hadir_ingest(text, text) to anon, authenticated;
grant execute on function public.geo_event(text, text) to anon, authenticated;
revoke execute on function public.my_profile() from anon;
revoke execute on function public.save_settings(jsonb) from anon;
revoke execute on function public.rotate_token() from anon;
revoke execute on function public.save_day(jsonb) from anon;
revoke execute on function public.push_subscribe(text, text, text, text) from anon;
revoke execute on function public.push_unsubscribe(text) from anon;

-- ---------- كل ٥ دقائق ----------
select cron.unschedule('aamali-tick') where exists (select 1 from cron.job where jobname = 'aamali-tick');
select cron.schedule('aamali-tick', '*/5 * * * *', $$ select public.tick_call(null) $$);
