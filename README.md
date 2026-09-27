# RangerNet – Wildlife Conservation Platform

React Native (Expo SDK 57) + Supabase implementation of the RangerNet system described in the Group 11 report.
Use cases, class diagram and sequence diagrams are followed as written; the UI follows our Magic Patterns design.

| Use case | Actors | Where it lives |
|---|---|---|
| UC-01 Report Poaching Incident | Ranger | `src/roles/ranger` |
| UC-02 Conduct Patrol & Track Coverage | Ranger, Park Supervisor | `src/roles/ranger`, `src/roles/park-supervisor` |
| UC-03 Data Analysis & Reporting | Park Manager | `src/roles/park-manager` |
| UC-04 Report Human-Wildlife Conflict | Community Member, Community Liaison Officer, Ranger | `src/roles/community-member`, `src/roles/community-liaison-officer`, `src/roles/ranger` |

## 1. Set up Supabase (once)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the whole of `supabase/migrations/0001_rangernet_schema.sql` and run it.
   It creates every table, enum, RLS policy, RPC function, storage bucket, realtime publication and the seed data
   (incident types, conflict types, parks, zones). It is safe to run again.
3. **Authentication → Sign In / Providers → Email**: for testing, turn **Confirm email** off so new accounts can sign in immediately.
   (With it on, users must click the confirmation link before signing in – the app tells them so.)
4. **Authentication → Emails → Reset Password** template: the app resets passwords with a 6-digit code, so the template
   must contain `{{ .Token }}`, e.g. `Your RangerNet reset code is {{ .Token }}`.
5. **Project Settings → API**: copy the **Project URL** and the **publishable key** (`sb_publishable_…`, or the legacy `anon` key).

Never put the database password or the `service_role` / secret key in the app or in `.env`.

## 2. Run the app

```bash
cd RangerNet
npm install
# fill in .env (see below)
npx expo start
```

Open it in **Expo Go** (Android / iOS) or an emulator. Every native module used is included in Expo Go.

### Environment variables (`.env`)

| Variable | Required | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | yes | `https://<project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | publishable / anon key only |
| `EXPO_PUBLIC_SMS_REPORT_NUMBER` | no | number of your SMS gateway; empty hides "Report by SMS" |
| `EXPO_PUBLIC_INCIDENT_PHOTO_BUCKET`, `EXPO_PUBLIC_REPORT_PHOTO_BUCKET` | no | defaults match the migration |
| `EXPO_PUBLIC_SYNC_RETRY_INTERVAL_MS` | no | retry interval for pending offline records (default 30000) |
| `GOOGLE_MAPS_API_KEY` | no | only for standalone builds; read by `app.config.ts` at build time |

Restart `npx expo start` after editing `.env`. Until the URL and key are set the app shows a "Connect RangerNet to Supabase" screen.

### Accounts and roles

- **Register** in the app and pick the role. Community members sign in with e-mail; staff get an Employee ID
  (typed in or generated, e.g. `RNG-1234`) and can sign in with it.
- Staff self-registration is controlled by `app_settings.allow_staff_self_signup` (default `true`). Turn it off for production:
  `update public.app_settings set allow_staff_self_signup = false;` – new sign-ups then become community members only.
- Change a role later with SQL: `update public.profiles set role = 'park_supervisor' where email = 'someone@example.com';`
  Roles: `ranger`, `park_supervisor`, `community_member`, `community_liaison_officer`, `park_manager`.

A quick end-to-end test: register one account per role → the supervisor assigns a patrol to the ranger → the ranger starts,
tracks and completes it → the community member reports a conflict → the CLO assesses it as high risk and assigns the ranger →
the ranger acknowledges/responds/resolves → the park manager runs an analysis and generates a PDF report.

## 3. Project structure

```
src/
  app/                    App root: providers, auth gate, role registry (the only place that knows all roles)
  shared/                 Used by every role – owned jointly
    auth/                 Welcome, sign in, register, password recovery, field-setup permissions
    components/           Design-system UI (buttons, cards, app bars, maps, location picker …)
    sync/                 LocalStorage (expo-sqlite outbox) + SynchronizationService + Sync Center screen
    location/ media/      GPS (LocationService) and camera/photo helpers
    models/               Shared class-diagram models (Location)
    notifications/ profile/ lookups/ config/ lib/ theme/ types/ utils/
  roles/
    ranger/                    UC-01, UC-02 (ranger side), UC-04 high-risk response
    park-supervisor/           UC-02 (assign routes, monitor, review coverage)
    community-member/          UC-04 (report in app / by SMS, track reports)
    community-liaison-officer/ UC-04 (review, assess severity, coordinate response)
    park-manager/              UC-03 (analysis, PDF conservation reports)
supabase/migrations/      The single migration to run in Supabase
```

Each role folder is self-contained (`models/`, `services/`, `screens/`, `navigation/`, `index.ts`) and imports only from
`@shared/*`, never from another role. Its `index.ts` exports a `RoleModule` (navigator, optional offline sync handlers,
whether field permissions are needed) that `src/app/roleRegistry.ts` plugs in. A group member can therefore own one role
folder and push/merge it independently; changes to `src/shared` should be agreed by the group.

Navigation uses React Navigation (one native-stack + bottom-tab navigator per role) rather than Expo Router, because
file-based routes would force every role's screens into one shared `app/` tree and break the per-role folder ownership.

## 4. Offline behaviour, GPS and synchronization

- **LocalStorage** (`src/shared/sync/LocalStorage.ts`) is an expo-sqlite outbox on the device. When there is no connection
  (or the server can't be reached), incidents (UC-01 alt. 8a), community reports (UC-04), patrol start / GPS points /
  completion (UC-02) and ranger response updates are saved there with status **Pending Synchronization**.
- **SynchronizationService** retries automatically when the connection returns, when the app comes to the foreground and
  every `EXPO_PUBLIC_SYNC_RETRY_INTERVAL_MS` while records are pending. Records for the same patrol/assignment are sent in
  order. Validation errors from the server mark a record **Failed** (visible with the reason in the Sync Center, where it can
  be retried or discarded); network errors keep it pending. All writes go through idempotent RPCs, so a retry never duplicates data.
- **Patrol tracking** records GPS positions while the patrol screen is running (foreground tracking), keeps them in a local
  session that survives app restarts, and uploads them in batches. If GPS is unavailable the ranger can retry or mark a
  waypoint manually. Locations for incidents/reports fall back to manual marking (map pin or typed coordinates) when GPS fails.
- **Sync Center** (More → Sync Center) shows pending, failed and recently synced records and has a **Simulate offline**
  switch for demonstrating the offline flows without disabling the network.
- Office roles are online-first: supervisor screens fall back to the last copy saved on the device (marked as offline);
  CLO and park manager actions need a connection and show a retry option when it is missing.

## 5. SMS reports (UC-04 alternative flow)

The "Report by SMS" button opens the phone's SMS app with a pre-filled message:

```
RANGERNET CONFLICT
Type: Elephant Sighting
Location: <description or lat,lng>
Details: <what is happening>
```

An SMS gateway (e.g. Twilio, Dialog, Notify.lk) must call the database function `ingest_sms_report(p_sender, p_message)`
from **your server-side webhook** using the `service_role` key – never from the app. The sender number is matched to the
community member's registered contact number.

## 6. Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npx expo-doctor
```
