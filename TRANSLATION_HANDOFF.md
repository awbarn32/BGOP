# Translation Handoff

## Goal

This project is adding an AI-assisted Thai/English messaging workflow for the messages inbox.

Target workflow:

- Store all inbound and outbound text messages durably in the DB.
- Automatically translate inbound English customer messages into Thai for the PA.
- Show the original English message with the Thai translation underneath.
- Let the PA draft/edit in Thai.
- Default outbound send language to the customer's `preferred_language`.
- Allow manual override of outbound language.
- Generate a suggested reply from full conversation context when the PA presses a button.

## What Has Been Implemented

### Transcript foundation

Existing transcript model was kept and extended:

- `conversation_threads`
- `conversation_messages`
- `conversation_thread_user_state`

New AI-related migration was added:

- [supabase/migrations/008_conversation_ai_foundation.sql](/Users/johnrosplock/Projects/BGOP/supabase/migrations/008_conversation_ai_foundation.sql)

This migration adds:

- `conversation_message_localizations`
- `conversation_thread_ai_state`
- `conversation_ai_runs`
- GIN search index on `conversation_messages.body_text`

### AI service

Main AI logic is in:

- [src/lib/messaging/ai.ts](/Users/johnrosplock/Projects/BGOP/src/lib/messaging/ai.ts)

Implemented there:

- `persistMessageLocalization(...)`
- `hydrateThreadAssist(...)`
- `draftReply(...)`
- GPT model set to `gpt-5-mini`
- Responses API usage with structured JSON output
- AI run logging into `conversation_ai_runs`
- Thread summary persistence into `conversation_thread_ai_state`

### Messaging send path

Updated files:

- [src/lib/messaging/service.ts](/Users/johnrosplock/Projects/BGOP/src/lib/messaging/service.ts)
- [src/lib/messaging/conversations.ts](/Users/johnrosplock/Projects/BGOP/src/lib/messaging/conversations.ts)
- [src/app/api/messages/route.ts](/Users/johnrosplock/Projects/BGOP/src/app/api/messages/route.ts)
- [src/app/api/jobs/[id]/send-message/route.ts](/Users/johnrosplock/Projects/BGOP/src/app/api/jobs/[id]/send-message/route.ts)

Implemented there:

- outbound messages are recorded into `conversation_messages`
- outbound messages keep `sent_by_user_id`
- outbound direct messages call `persistMessageLocalization(...)`
- translation context uses recent thread messages when available

### Thread assist endpoints

Added:

- [src/app/api/messages/threads/[id]/assist/hydrate/route.ts](/Users/johnrosplock/Projects/BGOP/src/app/api/messages/threads/[id]/assist/hydrate/route.ts)
- [src/app/api/messages/threads/[id]/assist/reply/route.ts](/Users/johnrosplock/Projects/BGOP/src/app/api/messages/threads/[id]/assist/reply/route.ts)

Implemented there:

- `assist/hydrate` should translate uncached messages and refresh summaries
- `assist/reply` should generate Thai draft + customer-facing preview

### Message loading API

Updated:

- [src/app/api/messages/threads/[id]/messages/route.ts](/Users/johnrosplock/Projects/BGOP/src/app/api/messages/threads/[id]/messages/route.ts)

Implemented there:

- returns joined localization row
- adds `translation_status`

### Inbox UI

Main UI file:

- [src/app/(dashboard)/messages/page.tsx](/Users/johnrosplock/Projects/BGOP/src/app/(dashboard)/messages/page.tsx)

Current intended UI behavior:

- center pane shows transcript
- inbound English should display as:
  - original English first
  - Thai translation underneath
- center pane includes a Thai reply composer
- right pane has:
  - top customer info card
  - bottom reply assistant
- suggested reply is button-triggered, not auto-generated
- center pane and right pane share the same draft state
- outbound language defaults from `customer.preferred_language` with manual toggle override

## Verified So Far

These passed after implementation:

- `./node_modules/.bin/tsc --noEmit`
- `npm run lint`

Supabase CLI state:

- CLI login was completed successfully
- `supabase db push --linked` reported `Remote database is up to date`

## What Is Not Working Right Now

These are the top issues the next chat should debug first:

1. Automatic translation display for inbound English messages is not working as expected.
   Expected:
   - English inbound message visible
   - Thai translation visible directly underneath
   Actual:
   - user reports this is not displaying/working

2. `Generate reply` is not working.
   Expected:
   - pressing the button should call `assist/reply`
   - the Thai draft should populate
   - preview should populate
   Actual:
   - user reports it is not working

## Most Likely Debug Areas

The next chat should inspect these first.

### 1. Hydration path

Check whether `assist/hydrate` is actually producing rows in `conversation_message_localizations`.

Relevant files:

- [src/app/api/messages/threads/[id]/assist/hydrate/route.ts](/Users/johnrosplock/Projects/BGOP/src/app/api/messages/threads/[id]/assist/hydrate/route.ts)
- [src/lib/messaging/ai.ts](/Users/johnrosplock/Projects/BGOP/src/lib/messaging/ai.ts)

Likely checks:

- Is `OPENAI_API_KEY` available in the runtime that serves these routes?
- Is `client.responses.create(...)` succeeding?
- Is `response.output_text` valid JSON?
- Are rows being written to `conversation_message_localizations`?
- Is `fetchMessages()` in `ai.ts` getting joined localization rows correctly?

### 2. Message display logic

Check whether the UI is receiving the localization fields and rendering them as intended.

Relevant files:

- [src/app/api/messages/threads/[id]/messages/route.ts](/Users/johnrosplock/Projects/BGOP/src/app/api/messages/threads/[id]/messages/route.ts)
- [src/app/(dashboard)/messages/page.tsx](/Users/johnrosplock/Projects/BGOP/src/app/(dashboard)/messages/page.tsx)

Likely checks:

- Does the API response include `localization.text_th`, `localization.text_en`, and `source_language`?
- Is the relation returned as an array or object in the runtime response?
- Is `getMessageDisplay(...)` computing `primary`/`secondary` as intended?
- Is the transcript rendering the secondary text when it exists?

### 3. Suggested reply endpoint

Check whether `assist/reply` is failing server-side or whether the UI is swallowing an error.

Relevant files:

- [src/app/api/messages/threads/[id]/assist/reply/route.ts](/Users/johnrosplock/Projects/BGOP/src/app/api/messages/threads/[id]/assist/reply/route.ts)
- [src/lib/messaging/ai.ts](/Users/johnrosplock/Projects/BGOP/src/lib/messaging/ai.ts)
- [src/app/(dashboard)/messages/page.tsx](/Users/johnrosplock/Projects/BGOP/src/app/(dashboard)/messages/page.tsx)

Likely checks:

- Does the button fire the POST request?
- Does `draftReply(...)` return `null`?
- Is `hydrateThreadAssist(...)` inside the reply route failing first?
- Is the response shape `json.data.draft_th` / `json.data.preview_for_customer` correct?
- Are errors visible in browser devtools or server logs?

### 4. Runtime environment mismatch

Very possible issue:

- typecheck/lint pass, but the feature fails at runtime due to env, response parsing, or DB row shape

The next chat should prefer actual runtime validation over static review.

## Suggested Debug Plan For New Chat

1. Open this file first for context.
2. Reproduce with a real thread in the browser.
3. Inspect network calls for:
   - `GET /api/messages/threads/:id/messages`
   - `POST /api/messages/threads/:id/assist/hydrate`
   - `POST /api/messages/threads/:id/assist/reply`
4. Check server logs for failures in `src/lib/messaging/ai.ts`.
5. Query Supabase directly to verify whether:
   - `conversation_message_localizations` rows are being inserted
   - `conversation_thread_ai_state` rows are being inserted
   - `conversation_ai_runs` records show success/error
6. Fix runtime issues first, then adjust UX polish second.

## Important Scope Reminder

Do not expand into marketing automation yet.

Current scope is only:

- transcript durability
- translation display
- suggested reply generation
- human-reviewed sending
