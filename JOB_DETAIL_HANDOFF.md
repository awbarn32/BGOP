# Job Detail Handoff

Date: 2026-03-22

## What was changed

The board no longer uses the old right-side drawer flow.

- Added a dedicated full-page job detail route at `/jobs/[id]`.
- Added a client page shell for that route.
- Reworked the job detail UI into a full-page spec-style layout.
- Added an explicit button on each job card to open the full-page detail view.
- Restarted the local dev server on port `3001`.

## Current server state

- Local dev server is running at `http://localhost:3001`.
- The job card button now routes to `/jobs/[id]`.

## Files changed

- `src/components/jobs/JobCard.tsx`
- `src/app/(dashboard)/board/page.tsx`
- `src/app/(dashboard)/jobs/[id]/page.tsx`
- `src/components/jobs/JobDetailPage.tsx`
- `src/components/jobs/JobDrawer.tsx`
- `src/app/api/jobs/[id]/route.ts`

## Intended behavior now

- Each job card shows a bottom action button: `See More Details`.
- Clicking that button opens the full-page detail view at `/jobs/[id]`.
- The old slide-over drawer implementation was removed from the active flow.

## Current blocker

The button works, but the job detail page is not loading data.

Observed behavior:

- Navigating to `/jobs/48a490fc-37db-4836-b954-ceb3f30f5ac0` shows:
  - `Job detail unavailable`
  - `The selected job could not be loaded.`

Confirmed from the live dev server log:

- `GET /api/jobs/48a490fc-37db-4836-b954-ceb3f30f5ac0 404`

Important detail:

- `/api/jobs` is successfully returning board cards.
- The same job ID from the board is failing on `/api/jobs/[id]`.

That means the routing/button is working.
The current failure is in the detail data load path, not the navigation.

## Most likely place to debug next

Start with `src/app/api/jobs/[id]/route.ts`.

Current behavior there:

- It selects a detailed job record with joins.
- If Supabase returns `error` or no `data`, it returns `notFoundError('Job')`.

Most likely causes:

1. The detail query is failing because of one of the joined fields/tables.
2. RLS or auth context differs between `/api/jobs` and `/api/jobs/[id]`.
3. The job row exists, but the detailed `.single()` query is erroring.

## Recommended next debugging step

Add temporary logging inside `GET /api/jobs/[id]` to print:

- `id`
- `error`
- whether `data` is null

Specifically inspect the Supabase error from:

- `.from('jobs').select(DETAIL_SELECT).eq('id', id).single()`

Right now the client swallows the non-OK response and just renders the fallback card, so the actual server-side error needs to be surfaced.

## Notes about the current UI implementation

The current full-page layout lives in:

- `src/components/jobs/JobDrawer.tsx`

Even though the file name still says `JobDrawer`, it is now the active full-page detail implementation.
There is no active drawer route anymore.

If desired in the next chat, this file can be renamed to something clearer like:

- `JobDetailView.tsx`

## Build status

`npm run build` passes after the current changes.

## Git/worktree state

Modified:

- `src/app/(dashboard)/board/page.tsx`
- `src/app/api/jobs/[id]/route.ts`
- `src/components/jobs/JobCard.tsx`
- `src/components/jobs/JobDrawer.tsx`

Untracked:

- `src/app/(dashboard)/jobs/[id]/page.tsx`
- `src/components/jobs/JobDetailPage.tsx`

## Short summary for the next chat

The explicit card button and full-page detail routing are done.
The remaining blocker is that `/api/jobs/[id]` returns `404` for an existing board job, so the detail page cannot load its data.
