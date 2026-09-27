-- =============================================================================
-- RangerNet - Wildlife Conservation Platform
-- Complete Supabase schema: tables, RLS, RPC functions, storage, realtime, seed.
--
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query.
-- It is written to be re-runnable (idempotent) on the same project.
--
-- Class diagram -> table mapping
--   Ranger / ParkSupervisor / ParkManager /
--   CommunityMember / CommunityLiaisonOfficer  -> profiles (role column)
--   Incident            -> incidents
--   IncidentType        -> incident_types
--   IncidentPhoto       -> incident_photos
--   Location            -> locations
--   Patrol              -> patrols
--   PatrolRoute         -> patrol_routes
--   Waypoint            -> waypoints
--   CommunityReport     -> community_reports
--   ConflictType        -> conflict_types
--   ReportPhoto         -> report_photos
--   ResponseAssignment  -> response_assignments
--   Analytics           -> analytics
--   Report              -> reports
--   LocalStorage / SynchronizationService live on the device (expo-sqlite).
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum (
    'ranger',
    'park_supervisor',
    'community_member',
    'community_liaison_officer',
    'park_manager'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Reference data: parks, zones, settings
-- -----------------------------------------------------------------------------
create table if not exists public.parks (
  park_id     uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  region      text,
  center_lat  double precision not null,
  center_lng  double precision not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.zones (
  zone_id     uuid primary key default gen_random_uuid(),
  park_id     uuid not null references public.parks (park_id) on delete cascade,
  name        text not null,
  center_lat  double precision not null,
  center_lng  double precision not null,
  created_at  timestamptz not null default now(),
  unique (park_id, name)
);

create table if not exists public.app_settings (
  id                        boolean primary key default true check (id),
  allow_staff_self_signup   boolean not null default true,
  duplicate_radius_km       numeric not null default 1.0,
  duplicate_window_hours    integer not null default 24,
  coverage_radius_km        numeric not null default 0.3
);

-- -----------------------------------------------------------------------------
-- Users (all five actors of the use case diagram)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  role            public.app_role not null default 'community_member',
  full_name       text not null default '',
  email           text,
  employee_id     text unique,
  contact_number  text,
  village         text,            -- CommunityMember.village
  assigned_area   text,            -- CommunityLiaisonOfficer.assignedArea
  park_id         uuid references public.parks (park_id) on delete set null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles (role);

-- -----------------------------------------------------------------------------
-- Location (shared by Incident and CommunityReport)
-- -----------------------------------------------------------------------------
create table if not exists public.locations (
  location_id           uuid primary key default gen_random_uuid(),
  latitude              double precision,
  longitude             double precision,
  manually_marked       boolean not null default false,
  location_description  text,
  captured_at           timestamptz not null default now(),
  constraint locations_lat_chk check (latitude is null or latitude between -90 and 90),
  constraint locations_lng_chk check (longitude is null or longitude between -180 and 180)
);

-- -----------------------------------------------------------------------------
-- UC-01 Report Wildlife / Poaching Incident
-- -----------------------------------------------------------------------------
create table if not exists public.incident_types (
  type_id    integer primary key,
  type_name  text not null unique
);

create table if not exists public.incidents (
  incident_id   uuid primary key,                       -- generated on device (offline-safe, idempotent sync)
  incident_no   bigint generated always as identity,
  ranger_id     uuid not null references public.profiles (id) on delete cascade,
  type_id       integer not null references public.incident_types (type_id),
  location_id   uuid not null references public.locations (location_id),
  park_id       uuid references public.parks (park_id) on delete set null,
  zone_id       uuid references public.zones (zone_id) on delete set null,
  description   text not null,
  reported_at   timestamptz not null,                   -- recorded time on the device
  status        text not null default 'Reported'
                check (status in ('Reported', 'Under Review', 'Resolved')),
  is_offline    boolean not null default false,         -- true when it was stored locally before sync
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists incidents_ranger_idx on public.incidents (ranger_id);
create index if not exists incidents_reported_idx on public.incidents (reported_at);
create index if not exists incidents_park_idx on public.incidents (park_id, zone_id);

create table if not exists public.incident_photos (
  photo_id     uuid primary key,
  incident_id  uuid not null references public.incidents (incident_id) on delete cascade,
  photo_path   text not null,                            -- storage path in bucket "incident-photos"
  captured_at  timestamptz not null default now()
);
create index if not exists incident_photos_incident_idx on public.incident_photos (incident_id);

-- -----------------------------------------------------------------------------
-- UC-02 Conduct & Track Patrol
-- -----------------------------------------------------------------------------
create table if not exists public.patrols (
  patrol_id          uuid primary key default gen_random_uuid(),
  patrol_no          bigint generated always as identity,
  ranger_id          uuid not null references public.profiles (id) on delete cascade,
  supervisor_id      uuid references public.profiles (id) on delete set null,
  park_id            uuid references public.parks (park_id) on delete set null,
  zone_id            uuid references public.zones (zone_id) on delete set null,
  title              text not null,
  instructions       text,
  scheduled_for      timestamptz,
  start_time         timestamptz,
  end_time           timestamptz,
  status             text not null default 'Assigned'
                     check (status in ('Assigned', 'In Progress', 'Completed', 'Incomplete')),
  incomplete_reason  text,
  route_updated_at   timestamptz,
  reviewed_at        timestamptz,
  supervisor_note    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists patrols_ranger_idx on public.patrols (ranger_id, status);
create index if not exists patrols_start_idx on public.patrols (start_time);

create table if not exists public.patrol_routes (
  route_id             uuid primary key default gen_random_uuid(),
  patrol_id            uuid not null unique references public.patrols (patrol_id) on delete cascade,
  planned_distance_km  numeric,
  distance_covered     numeric not null default 0,       -- km
  coverage_percent     numeric,
  created_at           timestamptz not null default now()
);

create table if not exists public.waypoints (
  waypoint_id      uuid primary key default gen_random_uuid(),
  route_id         uuid not null references public.patrol_routes (route_id) on delete cascade,
  latitude         double precision not null check (latitude between -90 and 90),
  longitude        double precision not null check (longitude between -180 and 180),
  "timestamp"      timestamptz not null default now(),
  manually_marked  boolean not null default false,
  waypoint_type    text not null default 'TRACK'
                   check (waypoint_type in ('PLANNED', 'TRACK', 'MARKED')),
  sequence_no      integer,
  note             text
);
create index if not exists waypoints_route_idx on public.waypoints (route_id, waypoint_type, "timestamp");

-- -----------------------------------------------------------------------------
-- UC-04 Report Human-Wildlife Conflict
-- -----------------------------------------------------------------------------
create table if not exists public.conflict_types (
  type_id    integer primary key,
  type_name  text not null unique
);

create table if not exists public.community_reports (
  report_id          uuid primary key,                   -- generated on device
  report_no          bigint generated always as identity,
  member_id          uuid references public.profiles (id) on delete set null,
  type_id            integer not null references public.conflict_types (type_id),
  location_id        uuid references public.locations (location_id),
  park_id            uuid references public.parks (park_id) on delete set null,
  zone_id            uuid references public.zones (zone_id) on delete set null,
  description        text not null,
  reported_at        timestamptz not null,
  status             text not null default 'Reported'
                     check (status in ('Reported', 'Under Review', 'Responding', 'Resolved', 'Closed', 'Duplicate')),
  report_channel     text not null default 'APP' check (report_channel in ('APP', 'SMS')),
  is_offline         boolean not null default false,
  severity           text check (severity in ('Low', 'Medium', 'High', 'Critical')),
  is_high_risk       boolean not null default false,
  flagged_duplicate  boolean not null default false,
  duplicate_of       uuid references public.community_reports (report_id) on delete set null,
  sms_sender         text,
  reviewed_by        uuid references public.profiles (id) on delete set null,
  reviewed_at        timestamptz,
  assessment_note    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists community_reports_member_idx on public.community_reports (member_id);
create index if not exists community_reports_status_idx on public.community_reports (status);
create index if not exists community_reports_reported_idx on public.community_reports (reported_at);

create table if not exists public.report_photos (
  photo_id     uuid primary key,
  report_id    uuid not null references public.community_reports (report_id) on delete cascade,
  photo_path   text not null,                            -- storage path in bucket "report-photos"
  captured_at  timestamptz not null default now()
);
create index if not exists report_photos_report_idx on public.report_photos (report_id);

create table if not exists public.response_assignments (
  assignment_id     uuid primary key default gen_random_uuid(),
  report_id         uuid not null unique references public.community_reports (report_id) on delete cascade,
  officer_id        uuid references public.profiles (id) on delete set null,   -- CLO
  ranger_id         uuid not null references public.profiles (id) on delete cascade,
  assigned_at       timestamptz not null default now(),
  response_status   text not null default 'Assigned'
                    check (response_status in ('Assigned', 'Acknowledged', 'Responding', 'Resolved')),
  instructions      text,
  acknowledged_at   timestamptz,
  resolved_at       timestamptz,
  response_notes    text,
  updated_at        timestamptz not null default now()
);
create index if not exists response_assignments_ranger_idx on public.response_assignments (ranger_id);

-- -----------------------------------------------------------------------------
-- UC-03 Data Analysis & Reporting
-- -----------------------------------------------------------------------------
create table if not exists public.analytics (
  analysis_id    uuid primary key default gen_random_uuid(),
  analysis_type  text not null
                 check (analysis_type in ('INCIDENT', 'PATROL_COVERAGE', 'CONFLICT')),
  date_from      date not null,
  date_to        date not null,
  park_ids       uuid[] not null default '{}',
  zone_id        uuid references public.zones (zone_id) on delete set null,
  is_combined    boolean not null default false,          -- "Multiple Parks" combined analysis
  requested_by   uuid not null references public.profiles (id) on delete cascade,
  results        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  constraint analytics_range_chk check (date_from <= date_to)
);

create table if not exists public.reports (
  report_id     uuid primary key default gen_random_uuid(),
  report_no     bigint generated always as identity,
  analysis_id   uuid references public.analytics (analysis_id) on delete set null,
  manager_id    uuid not null references public.profiles (id) on delete cascade,
  report_type   text not null,
  title         text not null,
  format        text not null default 'PDF',
  file_path     text,                                     -- storage path in bucket "conservation-reports"
  parameters    jsonb not null default '{}'::jsonb,
  summary       jsonb not null default '{}'::jsonb,
  generated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- In-app notifications (patrol assigned, high-risk alert, status updates, ...)
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         text not null default 'SYSTEM',
  title        text not null,
  body         text,
  entity_type  text,
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- =============================================================================
-- Helper functions
-- =============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists patrols_touch on public.patrols;
create trigger patrols_touch before update on public.patrols
  for each row execute function public.touch_updated_at();
drop trigger if exists community_reports_touch on public.community_reports;
create trigger community_reports_touch before update on public.community_reports
  for each row execute function public.touch_updated_at();
drop trigger if exists response_assignments_touch on public.response_assignments;
create trigger response_assignments_touch before update on public.response_assignments
  for each row execute function public.touch_updated_at();

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.has_role(p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = any (p_roles))
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role <> 'community_member')
$$;

create or replace function public.owns_community_report(p_report_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_reports where report_id = p_report_id and member_id = auth.uid())
$$;

create or replace function public.is_assigned_ranger(p_report_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.response_assignments where report_id = p_report_id and ranger_id = auth.uid())
$$;

create or replace function public.can_view_patrol(p_patrol_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.patrols p
    where p.patrol_id = p_patrol_id
      and (p.ranger_id = auth.uid()
           or public.has_role(array['park_supervisor', 'park_manager']::public.app_role[]))
  )
$$;

create or replace function public.can_view_location(p_location_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.incidents i
      where i.location_id = p_location_id
        and (i.ranger_id = auth.uid()
             or public.has_role(array['park_supervisor', 'park_manager']::public.app_role[])))
    or exists (
      select 1 from public.community_reports r
      where r.location_id = p_location_id
        and (r.member_id = auth.uid()
             or public.has_role(array['community_liaison_officer', 'park_supervisor', 'park_manager']::public.app_role[])
             or public.is_assigned_ranger(r.report_id)))
$$;

-- Great-circle distance in kilometres
create or replace function public.distance_km(
  lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))
$$;

-- Nearest park zone for a coordinate (used to tag records with park / zone)
create or replace function public.resolve_zone(p_lat double precision, p_lng double precision)
returns table (r_park_id uuid, r_zone_id uuid) language sql stable as $$
  select z.park_id, z.zone_id
  from public.zones z
  where p_lat is not null and p_lng is not null
  order by public.distance_km(p_lat, p_lng, z.center_lat, z.center_lng)
  limit 1
$$;

create or replace function public.notify_user(
  p_user_id uuid, p_kind text, p_title text, p_body text, p_entity_type text, p_entity_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id)
  select p_user_id, p_kind, p_title, p_body, p_entity_type, p_entity_id
  where p_user_id is not null
$$;

create or replace function public.notify_role(
  p_role public.app_role, p_park_id uuid, p_kind text, p_title text, p_body text,
  p_entity_type text, p_entity_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id)
  select p.id, p_kind, p_title, p_body, p_entity_type, p_entity_id
  from public.profiles p
  where p.role = p_role and p.is_active
    and (p_park_id is null or p.park_id is null or p.park_id = p_park_id)
$$;

-- =============================================================================
-- Auth: profile creation on sign-up, login by Employee ID
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role     public.app_role := 'community_member';
  v_allow    boolean;
  v_emp      text := nullif(trim(v_meta ->> 'employee_id'), '');
  v_park     uuid;
  v_prefix   text;
begin
  begin
    v_role := coalesce(nullif(v_meta ->> 'role', '')::public.app_role, 'community_member');
  exception when others then
    v_role := 'community_member';
  end;

  select allow_staff_self_signup into v_allow from public.app_settings where id;
  if v_role <> 'community_member' and not coalesce(v_allow, true) then
    v_role := 'community_member';
  end if;

  begin
    v_park := nullif(v_meta ->> 'park_id', '')::uuid;
  exception when others then
    v_park := null;
  end;

  if v_role = 'community_member' then
    v_emp := null;
  elsif v_emp is null then
    v_prefix := case v_role
      when 'ranger' then 'RNG'
      when 'park_supervisor' then 'SUP'
      when 'community_liaison_officer' then 'CLO'
      else 'MGR' end;
    loop
      v_emp := v_prefix || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
      exit when not exists (select 1 from public.profiles where employee_id = v_emp);
    end loop;
  else
    v_emp := upper(v_emp);
  end if;

  insert into public.profiles (id, role, full_name, email, employee_id, contact_number, village, assigned_area, park_id)
  values (
    new.id,
    v_role,
    coalesce(nullif(trim(v_meta ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    v_emp,
    nullif(trim(v_meta ->> 'contact_number'), ''),
    nullif(trim(v_meta ->> 'village'), ''),
    nullif(trim(v_meta ->> 'assigned_area'), ''),
    v_park
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sign in with Employee ID or e-mail: returns the e-mail to use with signInWithPassword
create or replace function public.resolve_login_email(p_identifier text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_email text;
begin
  if p_identifier is null or trim(p_identifier) = '' then
    return null;
  end if;
  if position('@' in p_identifier) > 0 then
    return lower(trim(p_identifier));
  end if;
  select email into v_email from public.profiles
  where upper(employee_id) = upper(trim(p_identifier)) and is_active;
  return v_email;
end $$;

create or replace function public.is_employee_id_available(p_employee_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where upper(employee_id) = upper(trim(p_employee_id)))
$$;

-- =============================================================================
-- UC-01 RPC: Incident.submitIncident -> Central Operations System.storeIncident
-- Called directly when online, or by the SynchronizationService for records
-- stored locally as "Pending Synchronization". Idempotent on incident_id.
-- =============================================================================
create or replace function public.submit_incident(
  p_incident_id      uuid,
  p_type_id          integer,
  p_description      text,
  p_latitude         double precision,
  p_longitude        double precision,
  p_manually_marked  boolean,
  p_reported_at      timestamptz,
  p_is_offline       boolean default false,
  p_photos           jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_existing  public.incidents;
  v_loc       uuid;
  v_park      uuid;
  v_zone      uuid;
  v_photo     jsonb;
  v_type      text;
  v_row       public.incidents;
begin
  if v_uid is null or not public.has_role(array['ranger']::public.app_role[]) then
    raise exception 'Only rangers can report incidents' using errcode = '42501';
  end if;

  select * into v_existing from public.incidents where incident_id = p_incident_id;
  if found then
    if v_existing.ranger_id <> v_uid then
      raise exception 'Incident id conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('incident_id', v_existing.incident_id, 'incident_no', v_existing.incident_no,
                              'status', v_existing.status, 'already_stored', true);
  end if;

  -- validateIncident
  select type_name into v_type from public.incident_types where type_id = p_type_id;
  if v_type is null then
    raise exception 'Please select an incident type' using errcode = '22023';
  end if;
  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'Please enter a description' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'A valid location is required' using errcode = '22023';
  end if;
  if p_photos is null or jsonb_typeof(p_photos) <> 'array' or jsonb_array_length(p_photos) = 0 then
    raise exception 'At least one incident photo is required' using errcode = '22023';
  end if;

  insert into public.locations (latitude, longitude, manually_marked, captured_at)
  values (p_latitude, p_longitude, coalesce(p_manually_marked, false), coalesce(p_reported_at, now()))
  returning location_id into v_loc;

  select r_park_id, r_zone_id into v_park, v_zone from public.resolve_zone(p_latitude, p_longitude);

  insert into public.incidents (incident_id, ranger_id, type_id, location_id, park_id, zone_id,
                                description, reported_at, is_offline)
  values (p_incident_id, v_uid, p_type_id, v_loc, v_park, v_zone,
          trim(p_description), coalesce(p_reported_at, now()), coalesce(p_is_offline, false))
  returning * into v_row;

  for v_photo in select * from jsonb_array_elements(p_photos) loop
    insert into public.incident_photos (photo_id, incident_id, photo_path, captured_at)
    values ((v_photo ->> 'photo_id')::uuid, p_incident_id, v_photo ->> 'photo_path',
            coalesce((v_photo ->> 'captured_at')::timestamptz, now()))
    on conflict (photo_id) do nothing;
  end loop;

  perform public.notify_role('park_supervisor', v_park, 'INCIDENT',
    'New incident reported: ' || v_type,
    left(trim(p_description), 140), 'incident', p_incident_id);

  return jsonb_build_object('incident_id', v_row.incident_id, 'incident_no', v_row.incident_no,
                            'status', v_row.status, 'already_stored', false);
end $$;

-- =============================================================================
-- UC-02 RPCs: patrol assignment (Park Supervisor) and tracking (Ranger)
-- =============================================================================
-- ParkSupervisor.assignPatrol - creates Patrol + PatrolRoute + planned Waypoints
create or replace function public.assign_patrol(
  p_ranger_id            uuid,
  p_title                text,
  p_park_id              uuid,
  p_zone_id              uuid,
  p_scheduled_for        timestamptz,
  p_instructions         text,
  p_planned_distance_km  numeric,
  p_waypoints            jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_patrol  uuid;
  v_route   uuid;
  v_wp      jsonb;
  v_seq     integer := 0;
begin
  if not public.has_role(array['park_supervisor']::public.app_role[]) then
    raise exception 'Only park supervisors can assign patrols' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_ranger_id and role = 'ranger') then
    raise exception 'Please select a ranger' using errcode = '22023';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Please enter a patrol / route name' using errcode = '22023';
  end if;

  insert into public.patrols (ranger_id, supervisor_id, park_id, zone_id, title, instructions, scheduled_for)
  values (p_ranger_id, v_uid, p_park_id, p_zone_id, trim(p_title), nullif(trim(p_instructions), ''), p_scheduled_for)
  returning patrol_id into v_patrol;

  insert into public.patrol_routes (patrol_id, planned_distance_km)
  values (v_patrol, p_planned_distance_km)
  returning route_id into v_route;

  for v_wp in select * from jsonb_array_elements(coalesce(p_waypoints, '[]'::jsonb)) loop
    v_seq := v_seq + 1;
    insert into public.waypoints (route_id, latitude, longitude, "timestamp", manually_marked, waypoint_type, sequence_no, note)
    values (v_route, (v_wp ->> 'latitude')::double precision, (v_wp ->> 'longitude')::double precision,
            now(), true, 'PLANNED', v_seq, nullif(v_wp ->> 'note', ''));
  end loop;

  perform public.notify_user(p_ranger_id, 'PATROL', 'New patrol assigned: ' || trim(p_title),
    coalesce(nullif(trim(p_instructions), ''), 'Open My Patrols to view the route.'), 'patrol', v_patrol);
  return v_patrol;
end $$;

-- Alternative flow 2a: supervisor updates the route before the patrol starts
create or replace function public.update_patrol_route(
  p_patrol_id            uuid,
  p_ranger_id            uuid,
  p_title                text,
  p_zone_id              uuid,
  p_scheduled_for        timestamptz,
  p_instructions         text,
  p_planned_distance_km  numeric,
  p_waypoints            jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_patrol  public.patrols;
  v_route   uuid;
  v_wp      jsonb;
  v_seq     integer := 0;
begin
  if not public.has_role(array['park_supervisor']::public.app_role[]) then
    raise exception 'Only park supervisors can update patrol routes' using errcode = '42501';
  end if;
  select * into v_patrol from public.patrols where patrol_id = p_patrol_id for update;
  if not found then
    raise exception 'Patrol not found' using errcode = '22023';
  end if;
  if v_patrol.status <> 'Assigned' then
    raise exception 'The route can only be updated before the patrol starts' using errcode = '22023';
  end if;
  if p_ranger_id is not null and not exists (select 1 from public.profiles where id = p_ranger_id and role = 'ranger') then
    raise exception 'Please select a ranger' using errcode = '22023';
  end if;

  update public.patrols set
    ranger_id        = coalesce(p_ranger_id, ranger_id),
    title            = coalesce(nullif(trim(p_title), ''), title),
    zone_id          = p_zone_id,
    scheduled_for    = p_scheduled_for,
    instructions     = nullif(trim(p_instructions), ''),
    route_updated_at = now()
  where patrol_id = p_patrol_id;

  select route_id into v_route from public.patrol_routes where patrol_id = p_patrol_id;
  if v_route is null then
    insert into public.patrol_routes (patrol_id, planned_distance_km)
    values (p_patrol_id, p_planned_distance_km) returning route_id into v_route;
  else
    update public.patrol_routes set planned_distance_km = p_planned_distance_km where route_id = v_route;
  end if;

  delete from public.waypoints where route_id = v_route and waypoint_type = 'PLANNED';
  for v_wp in select * from jsonb_array_elements(coalesce(p_waypoints, '[]'::jsonb)) loop
    v_seq := v_seq + 1;
    insert into public.waypoints (route_id, latitude, longitude, "timestamp", manually_marked, waypoint_type, sequence_no, note)
    values (v_route, (v_wp ->> 'latitude')::double precision, (v_wp ->> 'longitude')::double precision,
            now(), true, 'PLANNED', v_seq, nullif(v_wp ->> 'note', ''));
  end loop;

  perform public.notify_user(coalesce(p_ranger_id, v_patrol.ranger_id), 'PATROL',
    'Patrol route updated: ' || coalesce(nullif(trim(p_title), ''), v_patrol.title),
    'Your supervisor updated the route. Review it before starting.', 'patrol', p_patrol_id);
  return p_patrol_id;
end $$;

-- Patrol.startPatrol - creates the patrol session and records the start time
create or replace function public.start_patrol(p_patrol_id uuid, p_start_time timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_patrol public.patrols;
begin
  select * into v_patrol from public.patrols where patrol_id = p_patrol_id for update;
  if not found or v_patrol.ranger_id <> auth.uid() then
    raise exception 'Patrol not found or not assigned to you' using errcode = '42501';
  end if;
  if v_patrol.status = 'Assigned' then
    update public.patrols set status = 'In Progress', start_time = coalesce(p_start_time, now())
    where patrol_id = p_patrol_id returning * into v_patrol;
  end if;
  return jsonb_build_object('patrol_id', v_patrol.patrol_id, 'status', v_patrol.status, 'start_time', v_patrol.start_time);
end $$;

-- Patrol.recordGPSPosition / PatrolRoute.addWaypoint (TRACK and MARKED points)
create or replace function public.record_patrol_points(p_patrol_id uuid, p_points jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_patrol  public.patrols;
  v_route   uuid;
  v_count   integer;
begin
  select * into v_patrol from public.patrols where patrol_id = p_patrol_id;
  if not found or v_patrol.ranger_id <> auth.uid() then
    raise exception 'Patrol not found or not assigned to you' using errcode = '42501';
  end if;
  if v_patrol.status = 'Assigned' then
    raise exception 'Patrol has not been started' using errcode = '22023';
  end if;

  select route_id into v_route from public.patrol_routes where patrol_id = p_patrol_id;
  if v_route is null then
    insert into public.patrol_routes (patrol_id) values (p_patrol_id) returning route_id into v_route;
  end if;

  insert into public.waypoints (waypoint_id, route_id, latitude, longitude, "timestamp", manually_marked, waypoint_type, note)
  select (pt ->> 'waypoint_id')::uuid,
         v_route,
         (pt ->> 'latitude')::double precision,
         (pt ->> 'longitude')::double precision,
         coalesce((pt ->> 'timestamp')::timestamptz, now()),
         coalesce((pt ->> 'manually_marked')::boolean, false),
         case when pt ->> 'waypoint_type' = 'MARKED' then 'MARKED' else 'TRACK' end,
         nullif(pt ->> 'note', '')
  from jsonb_array_elements(coalesce(p_points, '[]'::jsonb)) pt
  on conflict (waypoint_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Calculates distance covered (km) and coverage (% of planned waypoints visited)
create or replace function public.calculate_patrol_coverage(p_patrol_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_route    public.patrol_routes;
  v_dist     double precision := 0;
  v_planned  integer := 0;
  v_visited  integer := 0;
  v_radius   numeric;
  v_cov      numeric;
begin
  select * into v_route from public.patrol_routes where patrol_id = p_patrol_id;
  if not found then
    return jsonb_build_object('distance_covered', 0, 'coverage_percent', null);
  end if;
  select coalesce(coverage_radius_km, 0.3) into v_radius from public.app_settings where id;
  v_radius := coalesce(v_radius, 0.3);

  select coalesce(sum(public.distance_km(plat, plng, latitude, longitude)), 0) into v_dist
  from (
    select latitude, longitude,
           lag(latitude) over (order by "timestamp") as plat,
           lag(longitude) over (order by "timestamp") as plng
    from public.waypoints
    where route_id = v_route.route_id and waypoint_type in ('TRACK', 'MARKED')
  ) seg
  where plat is not null;

  select count(*),
         count(*) filter (where exists (
           select 1 from public.waypoints t
           where t.route_id = v_route.route_id and t.waypoint_type in ('TRACK', 'MARKED')
             and public.distance_km(p.latitude, p.longitude, t.latitude, t.longitude) <= v_radius))
  into v_planned, v_visited
  from public.waypoints p
  where p.route_id = v_route.route_id and p.waypoint_type = 'PLANNED';

  if v_planned > 0 then
    v_cov := round(100.0 * v_visited / v_planned, 1);
  elsif coalesce(v_route.planned_distance_km, 0) > 0 then
    v_cov := least(100, round((100.0 * v_dist / v_route.planned_distance_km)::numeric, 1));
  else
    v_cov := null;
  end if;

  update public.patrol_routes
  set distance_covered = round(v_dist::numeric, 3), coverage_percent = v_cov
  where route_id = v_route.route_id;

  return jsonb_build_object('distance_covered', round(v_dist::numeric, 3), 'coverage_percent', v_cov,
                            'planned_waypoints', v_planned, 'visited_waypoints', v_visited);
end $$;

-- Complete Patrol (main flow 7) or stop early -> "Incomplete" (exception 14a)
create or replace function public.complete_patrol(
  p_patrol_id  uuid,
  p_end_time   timestamptz,
  p_completed  boolean default true,
  p_reason     text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_patrol  public.patrols;
  v_cov     jsonb;
  v_status  text := case when coalesce(p_completed, true) then 'Completed' else 'Incomplete' end;
begin
  select * into v_patrol from public.patrols where patrol_id = p_patrol_id for update;
  if not found or v_patrol.ranger_id <> auth.uid() then
    raise exception 'Patrol not found or not assigned to you' using errcode = '42501';
  end if;
  if v_patrol.status in ('Completed', 'Incomplete') then
    return jsonb_build_object('patrol_id', p_patrol_id, 'status', v_patrol.status, 'already_completed', true)
           || public.calculate_patrol_coverage(p_patrol_id);
  end if;

  update public.patrols set
    status            = v_status,
    start_time        = coalesce(start_time, p_end_time, now()),
    end_time          = coalesce(p_end_time, now()),
    incomplete_reason = case when v_status = 'Incomplete' then nullif(trim(p_reason), '') else null end
  where patrol_id = p_patrol_id;

  v_cov := public.calculate_patrol_coverage(p_patrol_id);

  if v_patrol.supervisor_id is not null then
    perform public.notify_user(v_patrol.supervisor_id, 'PATROL',
      'Patrol ' || lower(v_status) || ': ' || v_patrol.title,
      case when v_status = 'Incomplete'
           then 'Stopped early' || coalesce(' - ' || nullif(trim(p_reason), ''), '') || '. Review required.'
           else 'Route, waypoints and coverage are available on the dashboard.' end,
      'patrol', p_patrol_id);
  else
    perform public.notify_role('park_supervisor', v_patrol.park_id, 'PATROL',
      'Patrol ' || lower(v_status) || ': ' || v_patrol.title, null, 'patrol', p_patrol_id);
  end if;

  return jsonb_build_object('patrol_id', p_patrol_id, 'status', v_status, 'already_completed', false) || v_cov;
end $$;

-- Supervisor reviews a completed / incomplete patrol
create or replace function public.review_patrol(p_patrol_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['park_supervisor']::public.app_role[]) then
    raise exception 'Only park supervisors can review patrols' using errcode = '42501';
  end if;
  update public.patrols
  set reviewed_at = now(), supervisor_note = nullif(trim(p_note), '')
  where patrol_id = p_patrol_id and status in ('Completed', 'Incomplete');
  if not found then
    raise exception 'Only completed or incomplete patrols can be reviewed' using errcode = '22023';
  end if;
end $$;

-- =============================================================================
-- UC-04 RPCs: community report submission, CLO review, response coordination
-- =============================================================================
create or replace function public.submit_community_report(
  p_report_id             uuid,
  p_type_id               integer,
  p_description           text,
  p_latitude              double precision,
  p_longitude             double precision,
  p_manually_marked       boolean,
  p_location_description  text,
  p_reported_at           timestamptz,
  p_is_offline            boolean default false,
  p_photos                jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_existing  public.community_reports;
  v_type      text;
  v_loc       uuid;
  v_park      uuid;
  v_zone      uuid;
  v_dup       uuid;
  v_dup_no    bigint;
  v_settings  public.app_settings;
  v_photo     jsonb;
  v_row       public.community_reports;
  v_when      timestamptz := coalesce(p_reported_at, now());
begin
  if v_uid is null or not public.has_role(array['community_member']::public.app_role[]) then
    raise exception 'Only community members can submit conflict reports' using errcode = '42501';
  end if;

  select * into v_existing from public.community_reports where report_id = p_report_id;
  if found then
    if v_existing.member_id is distinct from v_uid then
      raise exception 'Report id conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('report_id', v_existing.report_id, 'report_no', v_existing.report_no,
                              'status', v_existing.status, 'flagged_duplicate', v_existing.flagged_duplicate,
                              'already_stored', true);
  end if;

  -- validateReport
  select type_name into v_type from public.conflict_types where type_id = p_type_id;
  if v_type is null then
    raise exception 'Please select a conflict type' using errcode = '22023';
  end if;
  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'Please enter a description' using errcode = '22023';
  end if;
  if (p_latitude is null or p_longitude is null) and coalesce(trim(p_location_description), '') = '' then
    raise exception 'Please provide the location (GPS, map or description)' using errcode = '22023';
  end if;
  if p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180
                                 or (p_latitude = 0 and p_longitude = 0)) then
    raise exception 'Invalid location. Please mark the location again' using errcode = '22023';
  end if;

  insert into public.locations (latitude, longitude, manually_marked, location_description, captured_at)
  values (p_latitude, p_longitude, coalesce(p_manually_marked, false), nullif(trim(p_location_description), ''), v_when)
  returning location_id into v_loc;

  if p_latitude is not null then
    select r_park_id, r_zone_id into v_park, v_zone from public.resolve_zone(p_latitude, p_longitude);
  end if;

  -- Duplicate report: similar conflict at a similar location recently
  select * into v_settings from public.app_settings where id;
  if p_latitude is not null then
    select r.report_id, r.report_no into v_dup, v_dup_no
    from public.community_reports r
    join public.locations l on l.location_id = r.location_id
    where r.type_id = p_type_id
      and r.status not in ('Duplicate', 'Closed')
      and r.reported_at between v_when - make_interval(hours => coalesce(v_settings.duplicate_window_hours, 24)) and v_when + interval '1 hour'
      and l.latitude is not null
      and public.distance_km(l.latitude, l.longitude, p_latitude, p_longitude) <= coalesce(v_settings.duplicate_radius_km, 1.0)
    order by r.reported_at desc
    limit 1;
  end if;

  insert into public.community_reports (report_id, member_id, type_id, location_id, park_id, zone_id, description,
                                        reported_at, report_channel, is_offline, flagged_duplicate, duplicate_of)
  values (p_report_id, v_uid, p_type_id, v_loc, v_park, v_zone, trim(p_description),
          v_when, 'APP', coalesce(p_is_offline, false), v_dup is not null, v_dup)
  returning * into v_row;

  for v_photo in select * from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) loop
    insert into public.report_photos (photo_id, report_id, photo_path, captured_at)
    values ((v_photo ->> 'photo_id')::uuid, p_report_id, v_photo ->> 'photo_path',
            coalesce((v_photo ->> 'captured_at')::timestamptz, now()))
    on conflict (photo_id) do nothing;
  end loop;

  if v_dup is not null then
    perform public.notify_role('community_liaison_officer', v_park, 'DUPLICATE',
      'Possible duplicate: ' || v_type,
      'Report CR-' || v_row.report_no || ' looks similar to CR-' || v_dup_no || '. Flagged for review.',
      'community_report', p_report_id);
  else
    perform public.notify_role('community_liaison_officer', v_park, 'CONFLICT',
      'New conflict report: ' || v_type, left(trim(p_description), 140), 'community_report', p_report_id);
  end if;

  return jsonb_build_object('report_id', v_row.report_id, 'report_no', v_row.report_no, 'status', v_row.status,
                            'flagged_duplicate', v_row.flagged_duplicate, 'already_stored', false);
end $$;

-- SMS alternative flow. Call this from your SMS gateway webhook with the
-- service_role key (never from the app). Expected message format (the app's
-- "Report by SMS" button pre-fills it):
--   RANGERNET CONFLICT
--   Type: Elephant Sighting
--   Location: <description or lat,lng>
--   Details: <description>
create or replace function public.ingest_sms_report(p_sender text, p_message text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_member    uuid;
  v_type_txt  text;
  v_type      integer;
  v_loc_txt   text;
  v_desc      text;
  v_lat       double precision;
  v_lng       double precision;
  v_loc       uuid;
  v_park      uuid;
  v_zone      uuid;
  v_id        uuid := gen_random_uuid();
  v_no        bigint;
  v_digits    text := regexp_replace(coalesce(p_sender, ''), '\D', '', 'g');
begin
  v_type_txt := trim(substring(p_message from '(?i)type:\s*([^\n\r]+)'));
  v_loc_txt  := trim(substring(p_message from '(?i)location:\s*([^\n\r]+)'));
  v_desc     := trim(substring(p_message from '(?i)details:\s*(.+)$'));

  select type_id into v_type from public.conflict_types where lower(type_name) = lower(coalesce(v_type_txt, ''));
  if v_type is null then
    select type_id into v_type from public.conflict_types
    where lower(coalesce(v_type_txt, p_message)) like '%' || lower(split_part(type_name, ' ', 1)) || '%'
    order by type_id limit 1;
  end if;
  if v_type is null then
    raise exception 'Unknown conflict type in SMS' using errcode = '22023';
  end if;
  if coalesce(v_desc, '') = '' then
    v_desc := trim(p_message);
  end if;

  if v_loc_txt ~ '^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$' then
    v_lat := split_part(v_loc_txt, ',', 1)::double precision;
    v_lng := split_part(v_loc_txt, ',', 2)::double precision;
    select r_park_id, r_zone_id into v_park, v_zone from public.resolve_zone(v_lat, v_lng);
  end if;

  if length(v_digits) >= 7 then
    select id into v_member from public.profiles
    where role = 'community_member'
      and right(regexp_replace(coalesce(contact_number, ''), '\D', '', 'g'), 9) = right(v_digits, 9)
    limit 1;
  end if;

  insert into public.locations (latitude, longitude, manually_marked, location_description)
  values (v_lat, v_lng, v_lat is not null, case when v_lat is null then v_loc_txt end)
  returning location_id into v_loc;

  insert into public.community_reports (report_id, member_id, type_id, location_id, park_id, zone_id, description,
                                        reported_at, report_channel, sms_sender)
  values (v_id, v_member, v_type, v_loc, v_park, v_zone, v_desc, now(), 'SMS', p_sender)
  returning report_no into v_no;

  perform public.notify_role('community_liaison_officer', v_park, 'CONFLICT',
    'New SMS conflict report', left(v_desc, 140), 'community_report', v_id);
  return jsonb_build_object('report_id', v_id, 'report_no', v_no);
end $$;

-- CommunityLiaisonOfficer.reviewCommunityReport
create or replace function public.review_community_report(p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['community_liaison_officer']::public.app_role[]) then
    raise exception 'Only community liaison officers can review reports' using errcode = '42501';
  end if;
  update public.community_reports
  set status = case when status = 'Reported' then 'Under Review' else status end,
      reviewed_by = coalesce(reviewed_by, auth.uid()),
      reviewed_at = coalesce(reviewed_at, now())
  where report_id = p_report_id;
end $$;

-- CommunityLiaisonOfficer.assessConflictSeverity / CommunityReport.assessSeverity
create or replace function public.assess_conflict_severity(
  p_report_id uuid, p_severity text, p_is_high_risk boolean, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.community_reports;
begin
  if not public.has_role(array['community_liaison_officer']::public.app_role[]) then
    raise exception 'Only community liaison officers can assess severity' using errcode = '42501';
  end if;
  if p_severity not in ('Low', 'Medium', 'High', 'Critical') then
    raise exception 'Please select a severity level' using errcode = '22023';
  end if;
  update public.community_reports
  set severity = p_severity,
      is_high_risk = coalesce(p_is_high_risk, p_severity in ('High', 'Critical')),
      assessment_note = nullif(trim(p_note), ''),
      status = case when status = 'Reported' then 'Under Review' else status end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where report_id = p_report_id
  returning * into v_row;
  if not found then
    raise exception 'Report not found' using errcode = '22023';
  end if;
  return jsonb_build_object('report_id', v_row.report_id, 'severity', v_row.severity,
                            'is_high_risk', v_row.is_high_risk, 'status', v_row.status);
end $$;

-- Duplicate report exception: CLO confirms or clears the duplicate flag
create or replace function public.resolve_duplicate_flag(p_report_id uuid, p_is_duplicate boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['community_liaison_officer']::public.app_role[]) then
    raise exception 'Only community liaison officers can resolve duplicates' using errcode = '42501';
  end if;
  if p_is_duplicate then
    update public.community_reports
    set status = 'Duplicate', flagged_duplicate = true, reviewed_by = auth.uid(), reviewed_at = now()
    where report_id = p_report_id;
  else
    update public.community_reports
    set flagged_duplicate = false, duplicate_of = null, reviewed_by = auth.uid(), reviewed_at = now()
    where report_id = p_report_id;
  end if;
end $$;

-- CommunityLiaisonOfficer.coordinateResponse / ResponseAssignment.assignRanger
-- "Mark report as high risk -> Notify ranger"
create or replace function public.coordinate_response(p_report_id uuid, p_ranger_id uuid, p_instructions text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_report  public.community_reports;
  v_type    text;
  v_id      uuid;
begin
  if not public.has_role(array['community_liaison_officer']::public.app_role[]) then
    raise exception 'Only community liaison officers can coordinate responses' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_ranger_id and role = 'ranger') then
    raise exception 'Please select a ranger' using errcode = '22023';
  end if;
  select * into v_report from public.community_reports where report_id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = '22023';
  end if;
  if v_report.status in ('Resolved', 'Closed', 'Duplicate') then
    raise exception 'This report is already %', lower(v_report.status) using errcode = '22023';
  end if;
  select type_name into v_type from public.conflict_types where type_id = v_report.type_id;

  insert into public.response_assignments (report_id, officer_id, ranger_id, instructions)
  values (p_report_id, auth.uid(), p_ranger_id, nullif(trim(p_instructions), ''))
  on conflict (report_id) do update
    set ranger_id = excluded.ranger_id,
        officer_id = excluded.officer_id,
        instructions = excluded.instructions,
        assigned_at = now(),
        response_status = 'Assigned',
        acknowledged_at = null,
        resolved_at = null
  returning assignment_id into v_id;

  update public.community_reports
  set status = 'Responding', is_high_risk = true,
      reviewed_by = coalesce(reviewed_by, auth.uid()), reviewed_at = coalesce(reviewed_at, now())
  where report_id = p_report_id;

  perform public.notify_user(p_ranger_id, 'RESPONSE', 'High-risk conflict: ' || v_type,
    coalesce(nullif(trim(p_instructions), ''), 'Please acknowledge and coordinate a field response.'),
    'response_assignment', v_id);
  perform public.notify_user(v_report.member_id, 'CONFLICT', 'A ranger has been assigned to your report',
    'CR-' || v_report.report_no || ' is being responded to.', 'community_report', p_report_id);
  return v_id;
end $$;

-- ResponseAssignment.updateResponseStatus (assigned Ranger or CLO)
create or replace function public.update_response_status(p_assignment_id uuid, p_status text, p_notes text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_a       public.response_assignments;
  v_report  public.community_reports;
begin
  select * into v_a from public.response_assignments where assignment_id = p_assignment_id for update;
  if not found then
    raise exception 'Assignment not found' using errcode = '22023';
  end if;
  if not (v_a.ranger_id = auth.uid() or public.has_role(array['community_liaison_officer']::public.app_role[])) then
    raise exception 'You are not allowed to update this response' using errcode = '42501';
  end if;
  if p_status not in ('Acknowledged', 'Responding', 'Resolved') then
    raise exception 'Invalid response status' using errcode = '22023';
  end if;

  update public.response_assignments set
    response_status = p_status,
    acknowledged_at = coalesce(acknowledged_at, now()),
    resolved_at     = case when p_status = 'Resolved' then now() else null end,
    response_notes  = coalesce(nullif(trim(p_notes), ''), response_notes)
  where assignment_id = p_assignment_id
  returning * into v_a;

  update public.community_reports
  set status = case when p_status = 'Resolved' then 'Resolved' else 'Responding' end
  where report_id = v_a.report_id
  returning * into v_report;

  if v_a.ranger_id = auth.uid() then
    perform public.notify_user(v_a.officer_id, 'RESPONSE', 'Response ' || lower(p_status),
      'CR-' || v_report.report_no || coalesce(': ' || nullif(trim(p_notes), ''), ''), 'community_report', v_a.report_id);
  else
    perform public.notify_user(v_a.ranger_id, 'RESPONSE', 'Response status set to ' || p_status,
      'CR-' || v_report.report_no, 'response_assignment', v_a.assignment_id);
  end if;
  if p_status = 'Resolved' then
    perform public.notify_user(v_report.member_id, 'CONFLICT', 'Your conflict report was resolved',
      'CR-' || v_report.report_no, 'community_report', v_a.report_id);
  end if;

  return jsonb_build_object('assignment_id', v_a.assignment_id, 'response_status', v_a.response_status,
                            'report_status', v_report.status);
end $$;

-- CommunityReport.updateStatus - "No field response required -> store assessed status"
create or replace function public.update_report_status(p_report_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_report public.community_reports;
begin
  if not public.has_role(array['community_liaison_officer']::public.app_role[]) then
    raise exception 'Only community liaison officers can update report status' using errcode = '42501';
  end if;
  if p_status not in ('Under Review', 'Resolved', 'Closed') then
    raise exception 'Invalid report status' using errcode = '22023';
  end if;
  update public.community_reports
  set status = p_status,
      assessment_note = coalesce(nullif(trim(p_note), ''), assessment_note),
      reviewed_by = coalesce(reviewed_by, auth.uid()),
      reviewed_at = coalesce(reviewed_at, now())
  where report_id = p_report_id
  returning * into v_report;
  if not found then
    raise exception 'Report not found' using errcode = '22023';
  end if;
  if p_status in ('Resolved', 'Closed') then
    perform public.notify_user(v_report.member_id, 'CONFLICT', 'Your conflict report is ' || lower(p_status),
      coalesce(nullif(trim(p_note), ''), 'CR-' || v_report.report_no), 'community_report', p_report_id);
  end if;
end $$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.parks                enable row level security;
alter table public.zones                enable row level security;
alter table public.app_settings         enable row level security;
alter table public.profiles             enable row level security;
alter table public.locations            enable row level security;
alter table public.incident_types       enable row level security;
alter table public.incidents            enable row level security;
alter table public.incident_photos      enable row level security;
alter table public.patrols              enable row level security;
alter table public.patrol_routes        enable row level security;
alter table public.waypoints            enable row level security;
alter table public.conflict_types       enable row level security;
alter table public.community_reports    enable row level security;
alter table public.report_photos        enable row level security;
alter table public.response_assignments enable row level security;
alter table public.analytics            enable row level security;
alter table public.reports              enable row level security;
alter table public.notifications        enable row level security;

-- Lookup tables: readable by everyone (register screen needs parks)
drop policy if exists parks_read on public.parks;
create policy parks_read on public.parks for select to anon, authenticated using (true);
drop policy if exists zones_read on public.zones;
create policy zones_read on public.zones for select to anon, authenticated using (true);
drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to anon, authenticated using (true);
drop policy if exists incident_types_read on public.incident_types;
create policy incident_types_read on public.incident_types for select to anon, authenticated using (true);
drop policy if exists conflict_types_read on public.conflict_types;
create policy conflict_types_read on public.conflict_types for select to anon, authenticated using (true);

-- Profiles
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Locations
drop policy if exists locations_read on public.locations;
create policy locations_read on public.locations for select to authenticated
  using (public.can_view_location(location_id));

-- Incidents (written only through submit_incident)
drop policy if exists incidents_read on public.incidents;
create policy incidents_read on public.incidents for select to authenticated
  using (ranger_id = auth.uid()
         or public.has_role(array['park_supervisor', 'park_manager']::public.app_role[]));
drop policy if exists incident_photos_read on public.incident_photos;
create policy incident_photos_read on public.incident_photos for select to authenticated
  using (exists (select 1 from public.incidents i where i.incident_id = incident_photos.incident_id));

-- Patrols
drop policy if exists patrols_read on public.patrols;
create policy patrols_read on public.patrols for select to authenticated
  using (ranger_id = auth.uid()
         or public.has_role(array['park_supervisor', 'park_manager']::public.app_role[]));
drop policy if exists patrols_delete_assigned on public.patrols;
create policy patrols_delete_assigned on public.patrols for delete to authenticated
  using (status = 'Assigned' and public.has_role(array['park_supervisor']::public.app_role[]));
drop policy if exists patrol_routes_read on public.patrol_routes;
create policy patrol_routes_read on public.patrol_routes for select to authenticated
  using (public.can_view_patrol(patrol_id));
drop policy if exists waypoints_read on public.waypoints;
create policy waypoints_read on public.waypoints for select to authenticated
  using (exists (select 1 from public.patrol_routes r
                 where r.route_id = waypoints.route_id and public.can_view_patrol(r.patrol_id)));

-- Community reports
drop policy if exists community_reports_read on public.community_reports;
create policy community_reports_read on public.community_reports for select to authenticated
  using (member_id = auth.uid()
         or public.has_role(array['community_liaison_officer', 'park_supervisor', 'park_manager']::public.app_role[])
         or public.is_assigned_ranger(report_id));
drop policy if exists report_photos_read on public.report_photos;
create policy report_photos_read on public.report_photos for select to authenticated
  using (public.owns_community_report(report_id)
         or public.has_role(array['community_liaison_officer', 'park_supervisor', 'park_manager']::public.app_role[])
         or public.is_assigned_ranger(report_id));
drop policy if exists response_assignments_read on public.response_assignments;
create policy response_assignments_read on public.response_assignments for select to authenticated
  using (ranger_id = auth.uid()
         or public.has_role(array['community_liaison_officer', 'park_supervisor', 'park_manager']::public.app_role[])
         or public.owns_community_report(report_id));

-- Analytics & reports (Park Manager; supervisors may view)
drop policy if exists analytics_read on public.analytics;
create policy analytics_read on public.analytics for select to authenticated
  using (requested_by = auth.uid()
         or public.has_role(array['park_manager', 'park_supervisor']::public.app_role[]));
drop policy if exists analytics_insert on public.analytics;
create policy analytics_insert on public.analytics for insert to authenticated
  with check (requested_by = auth.uid() and public.has_role(array['park_manager']::public.app_role[]));
drop policy if exists analytics_delete on public.analytics;
create policy analytics_delete on public.analytics for delete to authenticated
  using (requested_by = auth.uid());

drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select to authenticated
  using (manager_id = auth.uid()
         or public.has_role(array['park_manager', 'park_supervisor']::public.app_role[]));
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (manager_id = auth.uid() and public.has_role(array['park_manager']::public.app_role[]));
drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update to authenticated
  using (manager_id = auth.uid()) with check (manager_id = auth.uid());
drop policy if exists reports_delete on public.reports;
create policy reports_delete on public.reports for delete to authenticated
  using (manager_id = auth.uid());

-- Notifications
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- Privileges (RLS still applies on top of these)
-- =============================================================================
grant usage on schema public to anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.parks, public.zones, public.app_settings,
                public.incident_types, public.conflict_types to anon, authenticated;
grant select on public.profiles, public.locations, public.incidents, public.incident_photos,
                public.patrols, public.patrol_routes, public.waypoints,
                public.community_reports, public.report_photos, public.response_assignments,
                public.analytics, public.reports, public.notifications to authenticated;
grant update (full_name, contact_number, village, assigned_area, park_id) on public.profiles to authenticated;
grant delete on public.patrols to authenticated;
grant insert, delete on public.analytics to authenticated;
grant insert, update, delete on public.reports to authenticated;
grant update (read_at), delete on public.notifications to authenticated;

-- Internal helpers (notify_*, calculate_patrol_coverage, triggers) stay private.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.resolve_login_email(text) to anon, authenticated;
grant execute on function public.is_employee_id_available(text) to anon, authenticated;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.has_role(public.app_role[]) to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.owns_community_report(uuid) to authenticated;
grant execute on function public.is_assigned_ranger(uuid) to authenticated;
grant execute on function public.can_view_patrol(uuid) to authenticated;
grant execute on function public.can_view_location(uuid) to authenticated;
grant execute on function public.distance_km(double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.resolve_zone(double precision, double precision) to authenticated;

grant execute on function public.submit_incident(uuid, integer, text, double precision, double precision, boolean, timestamptz, boolean, jsonb) to authenticated;
grant execute on function public.assign_patrol(uuid, text, uuid, uuid, timestamptz, text, numeric, jsonb) to authenticated;
grant execute on function public.update_patrol_route(uuid, uuid, text, uuid, timestamptz, text, numeric, jsonb) to authenticated;
grant execute on function public.start_patrol(uuid, timestamptz) to authenticated;
grant execute on function public.record_patrol_points(uuid, jsonb) to authenticated;
grant execute on function public.complete_patrol(uuid, timestamptz, boolean, text) to authenticated;
grant execute on function public.review_patrol(uuid, text) to authenticated;
grant execute on function public.submit_community_report(uuid, integer, text, double precision, double precision, boolean, text, timestamptz, boolean, jsonb) to authenticated;
grant execute on function public.review_community_report(uuid) to authenticated;
grant execute on function public.assess_conflict_severity(uuid, text, boolean, text) to authenticated;
grant execute on function public.resolve_duplicate_flag(uuid, boolean) to authenticated;
grant execute on function public.coordinate_response(uuid, uuid, text) to authenticated;
grant execute on function public.update_response_status(uuid, text, text) to authenticated;
grant execute on function public.update_report_status(uuid, text, text) to authenticated;

grant execute on function public.ingest_sms_report(text, text) to service_role;

-- =============================================================================
-- Storage buckets (private) + policies. Files are stored under "<user id>/..."
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('incident-photos', 'incident-photos', false),
       ('report-photos', 'report-photos', false),
       ('conservation-reports', 'conservation-reports', false)
on conflict (id) do nothing;

drop policy if exists "rangernet upload own folder" on storage.objects;
create policy "rangernet upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('incident-photos', 'report-photos', 'conservation-reports')
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "rangernet update own folder" on storage.objects;
create policy "rangernet update own folder" on storage.objects for update to authenticated
  using (bucket_id in ('incident-photos', 'report-photos', 'conservation-reports')
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "rangernet delete own folder" on storage.objects;
create policy "rangernet delete own folder" on storage.objects for delete to authenticated
  using (bucket_id in ('incident-photos', 'report-photos', 'conservation-reports')
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "rangernet read files" on storage.objects;
create policy "rangernet read files" on storage.objects for select to authenticated
  using (
    ((storage.foldername(name))[1] = auth.uid()::text
      and bucket_id in ('incident-photos', 'report-photos', 'conservation-reports'))
    or (bucket_id = 'incident-photos'
        and public.has_role(array['park_supervisor', 'park_manager']::public.app_role[]))
    or (bucket_id = 'report-photos'
        and public.has_role(array['community_liaison_officer', 'park_supervisor', 'park_manager', 'ranger']::public.app_role[]))
    or (bucket_id = 'conservation-reports'
        and public.has_role(array['park_manager', 'park_supervisor']::public.app_role[]))
  );

-- =============================================================================
-- Realtime (live dashboards + in-app notifications)
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['notifications', 'patrols', 'community_reports', 'response_assignments', 'incidents'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;

-- =============================================================================
-- Seed data
-- =============================================================================
insert into public.app_settings (id) values (true) on conflict (id) do nothing;

insert into public.incident_types (type_id, type_name) values
  (1, 'Snare'),
  (2, 'Carcass'),
  (3, 'Illegal Campsite'),
  (4, 'Footprints')
on conflict (type_id) do update set type_name = excluded.type_name;

insert into public.conflict_types (type_id, type_name) values
  (1, 'Elephant Sighting'),
  (2, 'Crop-Raiding'),
  (3, 'Animal Entering Farmland'),
  (4, 'Animal Near Settlement')
on conflict (type_id) do update set type_name = excluded.type_name;

insert into public.parks (code, name, region, center_lat, center_lng) values
  ('YALA', 'Yala National Park', 'Southern / Uva', 6.3728, 81.5169),
  ('UDA',  'Udawalawe National Park', 'Sabaragamuwa / Uva', 6.4745, 80.8986),
  ('WIL',  'Wilpattu National Park', 'North Western', 8.4560, 80.0138),
  ('MIN',  'Minneriya National Park', 'North Central', 8.0333, 80.8333)
on conflict (code) do nothing;

insert into public.zones (park_id, name, center_lat, center_lng)
select p.park_id, z.name, z.lat, z.lng
from public.parks p
join (values
  ('YALA', 'Block I',                  6.3300, 81.4500),
  ('YALA', 'Block II',                 6.3700, 81.5200),
  ('YALA', 'Buffer Zone East',         6.4000, 81.6000),
  ('YALA', 'Palatupana Sector',        6.2750, 81.3900),
  ('YALA', 'Kataragama Boundary',      6.4300, 81.3600),
  ('YALA', 'Community Boundary North', 6.4700, 81.4700),
  ('UDA',  'Reservoir Sector',         6.4400, 80.8700),
  ('UDA',  'Northern Boundary',        6.5200, 80.9100),
  ('WIL',  'Villu Sector',             8.4300, 80.0500),
  ('WIL',  'Kala Oya Boundary',        8.3200, 79.9300),
  ('MIN',  'Tank Area',                8.0300, 80.8400),
  ('MIN',  'Elephant Corridor East',   8.0700, 80.9100)
) as z(code, name, lat, lng) on z.code = p.code
on conflict (park_id, name) do nothing;

-- =============================================================================
-- Done. Create users from the app's Register screen. To change a user's role
-- later:  update public.profiles set role = 'park_manager' where email = '...';
-- =============================================================================
