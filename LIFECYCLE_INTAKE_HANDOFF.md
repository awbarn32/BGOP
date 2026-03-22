# BGOP Lifecycle / Intake Handoff

## Context

This document summarizes the lifecycle and intake changes made in this session and the application issues observed afterward. It is intended as a handoff artifact for a fresh chat. It does not propose a solution.

## Goal Of The Work

Implement the non-messaging portion of the lifecycle/intake alignment plan:

- enforce section 3.4 job lifecycle transitions
- stop raw job bucket/status writes through generic PATCH
- improve intake data capture and dedup
- sync driver work orders with job lifecycle
- keep all LINE/messaging logic out of scope

## Changes Made

### 1. Lifecycle enforcement

Added a shared lifecycle service in:

- `src/lib/jobs/lifecycle.ts`

This service now handles:

- validated job transitions using the existing transition map
- automatic move from `confirmed` into Intake
- automatic move from `received_at_shop` into Available Jobs
- automatic move from `work_completed` into Outbound
- archive/service-history side effects when returned to customer
- mechanic assignment transitions into or out of workflow states
- syncing job state from driver work-order progression

### 2. Generic job PATCH tightened

Updated:

- `src/app/api/jobs/[id]/route.ts`
- `src/lib/utils/validation.ts`

Changes:

- removed raw `bucket` and `status` from `UpdateJobSchema`
- generic job PATCH now updates non-lifecycle fields only
- mechanic assignment goes through lifecycle-aware logic
- added support for `pickup_address` and `intake_photos` in job updates

### 3. Dedicated transition route refactor

Reworked:

- `src/app/api/jobs/[id]/transition/route.ts`

Changes:

- route now applies lifecycle transitions through the shared lifecycle service
- route intentionally avoids adding new messaging behavior

### 4. Board / drawer / mechanic lifecycle rewiring

Updated:

- `src/app/(dashboard)/board/page.tsx`
- `src/components/jobs/JobDrawer.tsx`
- `src/app/mechanic/page.tsx`
- `src/app/api/quotes/[id]/authorize/route.ts`

Changes:

- board drag/drop now calls `/api/jobs/[id]/transition`
- drawer status actions / send quote / confirm job / completion flow use lifecycle transitions
- quote authorization now updates invoice status and transitions job flow
- mechanic status actions now use lifecycle transition API instead of raw PATCH

### 5. Driver work-order lifecycle sync

Updated:

- `src/app/api/driver/orders/route.ts`
- `src/app/api/driver/orders/[id]/route.ts`

Changes:

- pickup and delivery order creation now attempts to move the related job into the expected lifecycle state
- driver status progression now attempts to move the job through intake/outbound states

### 6. Intake API and public intake form

Reworked:

- `src/app/api/intake/route.ts`
- `src/app/request/page.tsx`

Changes:

- intake API now supports:
  - phone-based dedup
  - optional existing `vehicle_id`
  - vehicle matching/reuse
  - `email`
  - `color`
  - `pickup_address`
  - optional `intake_photos`
  - phone-based rate limiting
- public intake form now supports:
  - customer lookup by phone
  - existing-vehicle selection
  - new-vehicle entry
  - pickup address
  - bike photo capture/upload
  - review screen with expanded intake details

Note:

- photo handling currently stores data URLs in `jobs.intake_photos`

### 7. Scope change schema alignment

Updated:

- `src/app/api/scope-changes/[id]/route.ts`
- `src/types/domain.ts`

Added migration:

- `supabase/migrations/009_lifecycle_intake_alignment.sql`

Changes:

- added support in code/migration for:
  - `jobs.pickup_address`
  - `scope_changes.reviewed_by`
  - `scope_changes.reviewed_at`
  - `scope_changes.pa_notes`
- scope approval route now attempts to resume a paused approval job back to WIP

### 8. Session lookup changes started

Updated:

- `src/lib/supabase/server.ts`
- `src/lib/supabase/middleware.ts`
- `src/app/(dashboard)/layout.tsx`
- several dashboard API routes

Changes:

- added `getSessionUser(...)` helper using cookie-backed session lookup
- began replacing server-side `supabase.auth.getUser()` calls with `getSession()`-based session reads in routes used by the dashboard

This conversion was in progress when the session was interrupted.

## Other Files Touched

The following file also showed up as modified but was not intentionally changed as part of the lifecycle/intake feature work:

- `src/app/layout.tsx`

That file should be treated as unrelated unless independently verified.

## Verification Performed

These checks passed during the session:

- `npm run lint`
- `npx tsc --noEmit`

## Current Problem State

After the lifecycle/intake changes, the app entered a degraded state in local dev.

### Observed symptoms

- Job Board initially got stuck on an infinite spinner.
- After a follow-up hardening change in the board loader, Job Board renders shell UI but shows `0 active` and no jobs from the database.
- Sidebar navigation to other dashboard pages does not load correctly.
- Pages such as Vehicles / Products / Templates trigger client console errors during navigation.
- Messages is the only other area that partially loads, but it also reports console errors and does not load correctly.

### Browser console behavior reported

Observed in the browser:

- `Failed to fetch RSC payload for http://localhost:3001/vehicles. Falling back to browser navigation. TypeError: NetworkError when attempting to fetch resource.`
- equivalent RSC payload failures for:
  - `/templates`
  - `/products`
- job board showing empty columns with `0 active`

### Runtime characterization from debugging

During debugging, the following was established:

- the board was hardened so an initial jobs fetch can no longer keep the page in a permanent loading spinner
- the board now fails closed into an empty state instead of spinning forever
- there appears to be a broader request/navigation failure affecting dashboard route loads, not only the board component
- a systemic auth/session/network dependency on server requests was suspected, and a partial conversion from `getUser()` to session-backed reads was started

## State Of The Repository At Handoff

Implemented and present in the repo:

- lifecycle service
- transition route refactor
- intake API rewrite
- request form rewrite
- driver/job sync changes
- scope-change schema/code alignment
- migration `009_lifecycle_intake_alignment.sql`
- partial session-auth refactor in middleware/layout/routes

Current known bad state:

- dashboard route navigation unstable
- board data not loading
- messages unstable
- root cause not fully isolated in this session

## Recommended Use Of This File

Use this file in a fresh chat as:

- a summary of what was already attempted
- a list of concrete files changed
- a statement of the current broken state

It intentionally excludes proposed fixes.
