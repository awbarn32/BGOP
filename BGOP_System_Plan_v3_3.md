# BUTLER GARAGE OPERATIONS PLATFORM
## Comprehensive System Plan & Build Specification
### Version 3.3 — Active Build

**Date:** March 2026
**Author:** Barnes and Company Consulting
**Status:** In Active Build — Supersedes v3.2
**Target Builder:** Claude Code
**Technical Partner:** John Rosplock

---

# WHAT'S NEW IN v3.3

This version updates the build specification to reflect work completed since v3.2. All architecture, data model, build sequence, and design decisions from previous versions are fully preserved.

**Completed since v3.2:**
- **Products Admin CRUD Page:** Fully active products management
- **Job Templates CRUD Page:** Editable templates integrated natively 
- **Customer-Facing Intake Form (/request):** 6-step public form completed
- **Expenses Module:** PA recording with receipt upload 
- **Deposit Payment UI:** Added directly inside the JobDrawer invoice panel
- **Phone Normalization Refactor:** Enhancing contact deduplication
- **Owner Approval Workflow:** Streamlining approval statuses
- **Dark Mode UI Pass:** Refining the Job Drawer appearance
- **Image Message Support:** Mechanics and customers can exchange photos via LINE
- **Quote Fixing:** The `Send Quote` and `Confirm Job` workflow buttons have been restored after migration issues.
- **Form Error Debugging:** Added verbose form logging for frontend error tracking.

**External blocker confirmed:**
- LINE Messaging API activation is gated on the owner upgrading the LINE OA account. All CRON wiring and automated notification testing waits on this.

---

# BUILD STATUS (as of March 2026)

| Component | Detail | Status |
|-----------|--------|--------|
| Kanban Board (5 buckets, drag-and-drop) | useSortable, toolbar (search/mechanic/stream), position badge, scope dot, column colors | ✅ Complete |
| Job Card / DrawerPanel | Full detail slide-over: invoice at top, quote builder, scope review, timeline, photos | ✅ Complete |
| Quote / Invoice Lifecycle | Auto-create on job creation, line item total sync, Send Quote, Confirm Job | ✅ Complete |
| Scope Change Workflow | Mechanic flags → PA enters → approve/decline → line item sync | ✅ Complete |
| Messages Inbox | Two-panel thread view, EN/TH toggle, bubble UI, sidebar nav | ✅ Complete |
| Template Items Preview | Preview panel on NewJobForm, items copied to job on creation | ✅ Complete |
| Line Item Management | Add (product search + ad-hoc), delete, PATCH, total sync | ✅ Complete |
| Products / Price Book (CRUD) | Schema + product search API working. Admin CRUD page active | ✅ Complete |
| Job Templates CRUD Page | Create/edit templates with inline item editor | ✅ Complete |
| LINE Messaging Stack | Push, Flex, webhook, consent, rate limit, demo mode — OA upgrade pending | ⏳ Partial |
| Customer-Facing Intake Form (/request) | 6-step public form. Rate-limited | ✅ Complete |
| Driver Role & Work Orders | No driver role, work orders table, or driver mobile view | ❌ Not Started |
| Job Status History Logging | Trigger defined in schema spec. Trigger deployed and active | ✅ Complete |
| Deposit Payment Recording | Schema has deposit_amount/deposit_paid_at. UI active in JobDrawer | ✅ Complete |
| Bilingual / i18n | Most strings hardcoded English. Full translation files mostly pending | ⏳ Partial |
| CRON Automation (edge functions) | Edge functions stubbed with queries. LINE dispatch not wired | ⏳ Stubbed |
| PDF Invoice Generation | Not built. Deferred to Phase G | ❌ Deferred |
| Enhanced Dashboard / EOD | Basic stats exist. Revenue-by-stream, AR aging, time-in-stage not built | ⏳ Partial |
| Expenses Module | PA records expenses | ✅ Complete |
| Schema Migration Verification | Verified all tables in Supabase | ✅ Complete |

---

# REMAINING BUILD — PRIORITY ORDER

P0 = must verify/complete before adding new features. P1 = required for Phase 1 launch. P2 = Phase 1 polish. P3 = launch gate.

| # | Task | Acceptance Criteria | Pri | Owner |
|---|------|---------------------|-----|-------|
| 1 | Shareable intake link + QR code | PA copies /request URL. QR code generatable and printable. Butler Garage logo + bilingual prompt | P1 | John + Andy |
| 2 | Driver role + RLS policies | Driver can log in. Sees only own driver_work_orders. Cannot access jobs, invoices, or customers | P1 | John |
| 3 | Driver Work Orders: create, assign, status updates | PA creates pickup/delivery orders from job detail. Driver sees queue. Status updates trigger LINE notifications | P1 | John |
| 4 | Driver mobile view (/driver) — Thai | Thai-only. Work order queue. Address, vehicle, order type. Status update buttons. No access to job details | P1 | John |
| 5 | LINE OA account upgrade | Owner upgrades LINE OA to Messaging API tier. Webhook URL confirmed. Test message sent | P1 | Andy + Owner |
| 6 | Mechanic mobile view hardening | Thai-only. Only assigned jobs. Start / Complete / Flag buttons. Notes textarea. No pricing visible | P2 | John |
| 7 | Wire CRON edge functions | Service reminder (11-month). AR follow-up (7d LINE, 14d PA alert). Dormant segmentation (330+ days). All bilingual. All logged | P2 | John |
| 8 | Bilingual i18n (en.json + th.json + toggle) | Translation files. preferred_language drives active file. LanguageToggle works. No hardcoded English in staff UI | P2 | John + Andy |
| 9 | EOD summary + reporting exports | Today revenue, invoices, payments by method, jobs by bucket. CSV export for all 37 KPIs. Reporting role verified | P2 | John |
| 10 | PDF invoice / quote generation | Bilingual. Butler Garage branding. Downloadable from invoice detail | P2 | John |
| 11 | End-to-end QA | Full lifecycle: intake form → PA review → quote → confirm → shop floor → scope change → outbound → payment | P3 | John + Andy |
| 12 | Production deployment | Live Vercel URL. Env vars set. Production Supabase. Test users all 4 roles | P3 | John |

---

# COMPLETED WORK LOG

Detailed record of what was built, for session continuity.

## CW-1: Kanban Board

**JobCard.tsx**
- Changed from `useDraggable` to `useSortable` (@dnd-kit/sortable). Cards are both arrow-sortable and draggable between columns
- Orange dot indicator: shows when job has pending scope_changes (status = 'flagged' or 'pending')
- Position badge: `#{n}` in gray-700 rounded badge, hidden on `isDragOverlay`

**board/page.tsx — board toolbar**
- Search: filters by customer.full_name, vehicle.model, vehicle.make, job.description (case-insensitive)
- Mechanic filter: dropdown, filters by mechanic_id
- Revenue stream filter: dropdown with all 8 streams (service, sourcing, track_day, transport, dlt, bike_hotel, ecu, commission)
- `filteredJobs` computed client-side from all three active filters simultaneously

## CW-2: Messages Inbox

**GET /api/messages**
- Returns message_log joined with customers, ordered by sent_at DESC
- Query params: customer_id (filter to thread), limit (default 200)

**/messages page**
- Left panel: customer thread list with search, ordered by most recent message
- Right panel: conversation view. Outbound — indigo background, right-aligned. Inbound — gray background, left-aligned
- Reply box: language toggle (EN/TH), Ctrl+Enter to send, via POST /api/jobs/[id]/send-message
- Claude AI translation note shown below language toggle

**Sidebar.tsx**
- Messages nav item added: `{ href: '/messages', label: 'Messages', icon: '💬', roles: ['owner', 'pa'] }`

## CW-3: Quote / Invoice Lifecycle

**POST /api/jobs (job creation)**
- If `template_id` provided: fetches `job_template_items` with product join (sale_price, cost_price). Copies to `job_line_items`. Calculates `invoiceTotal` from product sale prices × quantities
- After job creation: auto-inserts invoice record with `status='quote'`, `total_amount=invoiceTotal` (0 if no template), linked to job_id, customer_id, vehicle_id, revenue_stream

**GET /api/jobs/[id] — DETAIL_SELECT additions**
```
invoice:invoices(id, invoice_number, status, total_amount, deposit_amount, paid_amount)
scope_changes(id, description, amount_thb, status, mechanic_notes, created_at)
```

**POST /api/jobs/[id]/line-items — invoice total sync**
- After insert: fetches all line items for job, recalculates `SUM(sale_price × quantity)`, updates `invoices.total_amount` WHERE `job_id = id AND status NOT IN ('paid','void')`
- Non-blocking — errors do not fail the line item creation

**DELETE /api/jobs/[id]/line-items/[itemId] — invoice total sync**
- Same pattern after delete

**PATCH /api/jobs/[id]/line-items/[itemId]**
- Updates qty, price, description on individual line item

**JobDrawer.tsx — invoice section**
- Invoice type added to JobDetail interface: `id, invoice_number, status, total_amount, deposit_amount | null, paid_amount | null`
- Invoice section moved to position 2 (immediately after customer/vehicle header, before status controls)
- Status badge color map: `quote=blue-900/40, approved=emerald-900/40, deposit_paid=teal-900/40, pending=amber-900/40, paid=green-900/40, void=gray-800`
- Status label map: `quote='Quote — Draft', approved='Confirmed', deposit_paid='Deposit Paid', pending='Awaiting Payment', paid='Paid ✓', void='Void'`
- `handleSendQuote()`: confirms → PATCH job status to `'quote_sent'`. Guard: line items must exist
- `handleConfirmJob()`: confirms → PATCH job status to `'confirmed'` → PATCH invoice status to `'approved'` → refreshes job from API
- Contextual buttons: Send Quote (invoice=quote + has items + not yet quote_sent), Confirm Job (status=quote_sent), Confirmed badge (invoice=approved)

## CW-4: Scope Change Workflow

**GET + POST /api/jobs/[id]/scope-changes**
- GET: returns scope changes for the job
- POST: mechanic creates flag (`status='flagged'`, `flagged_by=auth.uid()`)

**PATCH /api/scope-changes/[id]**
- Body: `{ action: 'approve' | 'decline', pa_notes?: string }`
- On approve: sets `status='approved'`, `entered_by=auth.uid()` → inserts `job_line_item` for the scope amount → recalculates and syncs invoice total
- On decline: sets `status='declined'`

**JobDrawer.tsx — scope change review UI**
- List of scope changes per job. Each pending item shows: description, amount, mechanic_notes, Approve / Decline buttons
- `handleScopeAction(scopeId, 'approve' | 'decline')`: calls PATCH then refreshes job

**types/kanban.ts**
- `scope_changes: { id: string; status: string }[]` added to JobCard type

**GET /api/jobs (board query)**
- CARD_SELECT updated to include `scope_changes(id, status)` for the orange dot indicator

## CW-5: Template Items Preview

**NewJobForm.tsx**
- `templateItems` state: `{ description: string; line_type: string }[]`
- `handleTemplateChange`: on selection, fetches GET /api/templates/[id] to retrieve items
- Blue preview panel renders below template selector, listing L/P type badges + item descriptions
- Preview cleared when template is deselected

## CW-6: Product Search in Quote Builder

**JobDrawer.tsx — line item add form**
- `productSearch` state with 300ms debounce using `useRef` timeout
- Queries `GET /api/products?search={term}&active=true&pageSize=8`
- Dropdown shows matching products. `selectProduct(p)` auto-fills description, sale_price, cost_price from catalog
- Manual entry still available (clear search to add ad-hoc item)
- `handleAddLineItem()`: POST /api/jobs/[id]/line-items then refreshes job
- `handleDeleteLineItem(itemId)`: DELETE /api/jobs/[id]/line-items/[itemId] then refreshes job

---

# 1. Executive Summary

This document is the single, authoritative build specification for the Butler Garage Operations Platform (BGOP). It supersedes all previous planning documents and incorporates: the Client Brief, Discovery Guide v5, Data Analysis Report (37 KPIs), Planning Session Summary, System Design v1.0, Comprehensive System Plan v2.0, Competitive Intelligence Summary (Tekmetric, Shopmonkey, Shop Boss analysis), and a complete review of the existing GitHub codebase (GarageCRM-main).

Butler Garage is a specialist motorcycle service shop in Bangkok, Thailand generating approximately 3.74M THB annually (311K THB/month) across eight revenue streams, with 432 invoices in 2025 and 122 in Q1 2026. The owner spends five hours per day relaying messages between customers and mechanics. This structural bottleneck prevents him from pursuing the highest-margin growth activities: bike trading (15K THB/flip), track day development (27.5K THB avg/event), and transport expansion.

The BGOP is a custom web-based operations platform that eliminates this bottleneck through: a Kanban-based job management system with five operational workflow buckets, job templates for common services, automated customer notifications via LINE, financial visibility with mandatory cost price tracking across all revenue streams, and a foundation for automated service reminders to re-engage 280+ dormant customers.

This document is structured for direct implementation by Claude Code. Every section provides the specificity needed to build without ambiguity: exact SQL schemas, file-by-file project structure, component specifications with field-level UI controls, and a sequenced build order optimized for velocity.

**Key Design Decisions:**
- Clean build (not evolving existing codebase) — cherry-picking proven patterns from GarageCRM-main
- Five-bucket Kanban system: New Requests → Intake → Available Jobs → WIP → Outbound (no "Closed" column — completed jobs leave the board)
- Kanban board is the PA's default landing page (not a separate dashboard)
- Job Templates (canned jobs) for common services — saves 20-30 min per estimate
- Real-time Kanban board updates via Supabase Realtime
- Bilingual support via single-field delimiter format (Thai / English)
- Mandatory cost_price on all new parts (reject if null) — estimated flag for legacy items
- Export-friendly data architecture for external BI tools (Looker Studio, Power BI) with all 37 tracked KPIs
- Payment architecture planned in schema but not built (manual recording only in Phase 1)
- Reference data import only (customers, vehicles, products) — no historical invoice migration
- Deployment target: Vercel free tier
- Tech stack: Next.js 14 + Supabase + LINE Messaging API + Supabase Realtime

---

# 2. Business Context & Architectural Drivers

## 2.1 The Business

Butler Garage is a specialist big-bike motorcycle service shop in Bangkok. Staff: 2 full-time mechanics, 1 PA, 1 media/content creator, 1 local driver. The owner is an English-speaking expat; mechanics are Thai-speaking. Customers are a mix of Thai nationals and expats. The garage ranks #1 on ChatGPT for motorcycle garages in Bangkok and acquires ~60% of customers through word of mouth.

**Revenue Streams (Full Year 2025 — Confirmed):**

| Stream | Invoices | Revenue (THB) | Avg (THB) | Mix % |
|--------|----------|---------------|-----------|-------|
| Service & Repair | 280 | 2,160,117 | 7,715 | 57.8% |
| ECU / Tuning | 17 | 685,574 | 40,328 | 18.4% |
| Bike Sourcing / Commission | 45 | 676,078 | 15,024 | 18.1% |
| Track Day / Rental | 15 | 413,741 | 27,583 | 11.1% |
| Transport | 53 | 352,872 | 6,658 | 9.4% |
| DLT / Documents | 33 | 219,937 | 6,665 | 5.9% |
| Bike Hotel / Storage | 9 | 54,100 | 6,011 | 1.4% |
| **TOTAL** | **432** | **3,735,560** | **8,647** | **100%** |

**Operating Costs:** 155,000 THB/month (97K staff + 58K overhead). Estimated net profit: ~195-205K THB/month.

**Seasonality:** Two peaks — January (771K THB, 85 invoices) and December (356K, 50 invoices). Low: April (138K, Songkran). Service reminder campaigns should launch in November AND June to capture both demand waves.

## 2.2 The Core Problem

The owner is a single point of failure in every customer communication. Every message in, every update out, every scope change approval goes through him. At January 2025 peak (85 invoices, 56 mechanic jobs), this meant ~30+ relay messages per day. This is the structural constraint that prevents every growth initiative.

**The Governing Question:** How does Butler Garage systematically remove the owner from routine operational communications and financial blindspots, so he can redirect his time toward the high-margin activities that determine whether the business scales from 3.7M to 5M+ THB annually?

## 2.3 Architectural Drivers

| Priority | Quality Attribute | Scenario | Target |
|----------|-------------------|----------|--------|
| H,M | Usability | Thai-speaking mechanic updates job status on phone | Complete in < 2 taps, Thai UI, no training manual needed |
| H,M | Workflow Integrity | PA manages 20+ concurrent jobs across 5 buckets | Kanban board loads < 2s, real-time updates, drag-drop reorder |
| H,H | Real-time Sync | Multiple staff view Kanban simultaneously | Status changes visible to all users within 500ms (Supabase Realtime) |
| H,L | Data Completeness | Every job captures cost price, revenue stream, mileage | Required fields enforced at data entry — cost_price mandatory on new parts |
| H,H | Integration | Automated LINE messages on job status changes | LINE OA integration, bilingual templates, consent-checked, rate-limited |
| M,M | Bilingual | Owner English, mechanics Thai, customers both | i18n for UI chrome, delimiter for data, bilingual LINE messages |
| M,L | Reporting | Owner exports data for Power BI / Looker Studio | Clean schema, reporting role, CSV export for all 37 KPIs |
| M,M | Extensibility | DVI module, payment processing, calendar view added later | Schema accommodates future tables without migration |
| L,L | Cost | Infrastructure under 400 THB/month | Supabase free tier + Vercel free tier |

## 2.4 Design Principles

1. **The PA is the operational brain.** The system is built around the PA's workflow. The Kanban board is their home screen. The PA manages all five buckets, builds quotes from templates, enters scope changes, assigns mechanics, and coordinates drivers.

2. **Mechanics touch the system minimally.** Two buttons: Start Work, Complete Work. One flag: Additional Work Found. Everything in Thai. No pricing, no reordering, no customer interaction through the system.

3. **The owner sees exceptions only.** Scope change declined. Invoice overdue 14+ days. Job value exceeds threshold. Otherwise, the owner reviews exports in Power BI.

4. **Every status transition is recorded.** Timestamps on every bucket/status change. This is the #1 dashboard requirement — time-in-stage analytics for identifying process bottlenecks.

5. **The vehicle is the anchor.** Vehicles own job history. Customers are linked to vehicles. When the system needs a primary entity, it's the vehicle, not the customer.

6. **Build for data export, not dashboards.** Basic in-app stats for operational awareness (EOD summary, AR aging). Rich analytics happen in external BI tools via clean schema and reporting role.

7. **Templates accelerate everything.** Job templates (canned jobs) for common services. LINE message templates for notifications. Inspection templates (Phase 2). Every repetitive task should have a one-click template path.

8. **Real-time is not optional.** The Kanban board is the screen the PA looks at all day. If it does not update in real-time when a mechanic changes status, the PA is working from stale information. Supabase Realtime subscriptions on the jobs table.

---

# 3. System Architecture

## 3.1 Technology Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Frontend | Next.js (App Router) | 14.x | SSR for mobile performance, TypeScript, React ecosystem |
| Styling | Tailwind CSS | 3.x | Utility-first, fast development, responsive by default |
| Database | Supabase (Postgres) | Latest | Consolidates DB + auth + real-time + edge functions + storage |
| Real-time | Supabase Realtime | — | WebSocket subscriptions for Kanban board live updates |
| Auth | Supabase Auth | — | JWT + role claims in app_metadata + Row Level Security |
| CRON Jobs | Supabase Edge Functions + pg_cron | — | Service reminders, AR aging, dormant segmentation |
| Messaging | LINE Messaging API | — | LINE OA already set up. Push messages, Flex Messages, webhooks |
| File Storage | Supabase Storage | — | Intake photos, vehicle photos, invoice PDFs |
| i18n | next-intl or custom (en.json / th.json) | — | Lightweight. Two languages only |
| Hosting | Vercel | Free tier | Zero-config Next.js deployment, edge functions |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable | Latest | Lightweight, accessible Kanban library |
| PDF Generation | @react-pdf/renderer or jsPDF | Latest | Invoice/quote PDF generation |

## 3.2 Architecture Pattern

**Modular Monolith on Supabase with Real-time Layer.** Single Next.js application with clear internal module boundaries (jobs, customers, vehicles, invoices, products, messaging, reporting). Supabase Realtime provides WebSocket subscriptions for the Kanban board — every job status change broadcasts to all connected clients.

**Competitive Pattern Alignment:** All three analyzed competitors (Tekmetric, Shopmonkey, Shop Boss) use the same pattern: a centralized web application with the Repair Order (Job) as the hub entity, real-time board sync, and a composable messaging layer. BGOP follows this proven architecture adapted for Supabase instead of custom infrastructure.

## 3.3 System Context (C4 Level 1)

**Users:**
- PA / Garage Manager — Full system access via browser (desktop + mobile). Kanban board is home screen.
- Mechanics (2) — Mobile-only, Thai UI, assigned jobs only
- Driver (1) — Mobile-only, Thai UI, pickup/delivery queue only
- Owner — Full access + reporting, English UI, exception alerts
- Customers — Public intake form (no auth), LINE notifications, LINE-based quote approval

**External Systems:**
- LINE Messaging API — Automated notifications, scope change approval, service reminders
- Supabase — Database, authentication, real-time subscriptions, edge functions, file storage
- Vercel — Hosting, deployment, serverless functions
- External BI Tools (Looker Studio / Power BI) — Connects to Supabase Postgres via reporting role

## 3.4 Data Flow: Complete Job Lifecycle

**Bucket 1 — New Requests:**
Customer submits intake form (public, no auth) OR PA creates job manually (optionally from a Job Template). System creates customer (dedup on phone), vehicle (if new), and job record (bucket=new_requests, status=new). Invoice created with status=quote (auto on job creation). PA reviews, builds quote from product catalog (or from template pre-populated items). PA clicks unified "Send Quote" → LINE message sent to customer. Customer approves. Deposit paid if applicable (PA records manually). PA clicks "Confirm" → job auto-moves to Intake bucket. Invoice status → approved.

**Bucket 2 — Intake:**
PA sets logistics type (drop_off or pickup). If pickup: Driver Work Order created. Vehicle arrives → PA or driver marks "Received at Shop" → LINE notification → job auto-moves to Available Jobs.

**Bucket 3 — Available Jobs:**
Vehicle on lot, awaiting mechanic assignment. PA assigns mechanic → job auto-moves to WIP. Jobs may return here from WIP if paused.

**Bucket 4 — WIP:**
Mechanic sees assigned job(s) in Thai mobile view. Taps เริ่มงาน (Start Work). If additional work found: mechanic taps พบงานเพิ่ม (Flag Additional Work) with brief Thai description. PA notified, enters formal scope change with catalog pricing, clicks "Send for Approval" → LINE Flex Message to customer with Approve/Decline buttons. Mechanic taps งานเสร็จ (Work Completed) → final invoice generated → LINE notification → job auto-moves to Outbound.

**Bucket 5 — Outbound:**
Completed jobs awaiting vehicle return. Customer pickup or driver delivery. PA marks "Returned to Customer" → invoice status → pending (if not already paid) → vehicle service date/mileage updated → job leaves the board (archived_at set).

**Post-Board (Archived):**
Accessible via job search, customer profile, vehicle history, and reporting exports.

---

# 4. Five-Bucket Kanban Model

## 4.1 Bucket and Status Mapping

| Bucket | Valid Statuses | Key Actor | Exit Trigger |
|--------|---------------|-----------|--------------|
| new_requests | new, under_review, awaiting_customer, quote_sent, confirmed | PA, Customer | PA confirms after quote approved + deposit paid |
| intake | awaiting_drop_off, driver_assigned, picked_up, in_transit, received_at_shop | PA, Driver | Vehicle marked "Received at Shop" |
| available_jobs | awaiting_assignment, awaiting_parts, awaiting_approval | PA | PA assigns mechanic |
| wip | work_started, paused_parts, paused_approval, work_completed | Mechanic, PA | Mechanic marks "Work Completed" |
| outbound | awaiting_pickup, driver_assigned_delivery, out_for_delivery, returned_to_customer | PA, Driver | Vehicle returned to customer |

**Terminal statuses (job leaves the board):**
- `returned_to_customer` in outbound → archived (archived_at set)
- `withdrawn` — customer cancelled (new_requests or intake)
- `rejected` — garage declined (new_requests only)

## 4.2 Valid Status Transitions

The transition validation function (`lib/jobs/transitions.ts`) is the single source of truth.

```
NEW_REQUESTS:
  new → under_review
  new → withdrawn | rejected
  under_review → awaiting_customer | quote_sent | withdrawn | rejected
  awaiting_customer → under_review | quote_sent | withdrawn
  quote_sent → confirmed | withdrawn
  confirmed → [AUTO-MOVE to intake: awaiting_drop_off OR driver_assigned]

INTAKE:
  awaiting_drop_off → received_at_shop | withdrawn
  driver_assigned → picked_up | withdrawn
  picked_up → in_transit
  in_transit → received_at_shop
  received_at_shop → [AUTO-MOVE to available_jobs: awaiting_assignment]

AVAILABLE_JOBS:
  awaiting_assignment → [AUTO-MOVE to wip: work_started] (when mechanic assigned)
  awaiting_assignment → awaiting_parts
  awaiting_parts → awaiting_assignment
  awaiting_approval → awaiting_assignment | awaiting_parts

WIP:
  work_started → paused_parts | paused_approval | work_completed
  paused_parts → work_started
  paused_parts → [RETURN to available_jobs: awaiting_parts] (mechanic unassigned)
  paused_approval → work_started
  paused_approval → [RETURN to available_jobs: awaiting_approval] (mechanic unassigned)
  work_completed → [AUTO-MOVE to outbound: awaiting_pickup OR driver_assigned_delivery]

OUTBOUND:
  awaiting_pickup → returned_to_customer
  driver_assigned_delivery → out_for_delivery
  out_for_delivery → returned_to_customer
  returned_to_customer → [ARCHIVED — job leaves board]
```

## 4.3 Automatic Transitions & Side Effects

| Trigger | From | To | Side Effects |
|---------|------|----|-------------|
| PA clicks "Confirm" | new_requests / confirmed | intake / awaiting_drop_off or driver_assigned | LINE: "Job confirmed" · Invoice status → approved |
| Vehicle marked received | intake / received_at_shop | available_jobs / awaiting_assignment | LINE: "Bike received at shop" |
| PA assigns mechanic | available_jobs / awaiting_assignment | wip / work_started | Mechanic sees job in their view |
| Mechanic clicks "Work Completed" | wip / work_completed | outbound / awaiting_pickup or driver_assigned_delivery | LINE: "Bike ready for pickup" · Invoice finalized |
| PA marks "Returned to Customer" | outbound / returned_to_customer | [archived] | Vehicle service date/mileage updated · archived_at set |
| Customer approves scope change (LINE webhook) | — | — | Line items added · Invoice amount updated · Job unpaused if paused_approval |
| Customer declines scope change (LINE webhook) | — | — | PA notified · Owner notified if amount > threshold |

## 4.4 Kanban Board UI Specification

**Route:** /board (PA default landing page after login)

**Layout:** Five columns, left-to-right, horizontal scroll on mobile.

**Column Header Colors:**
| Bucket | Color | Hex |
|--------|-------|-----|
| New Requests | Blue | #3B82F6 |
| Intake | Amber | #F59E0B |
| Available Jobs | Purple | #8B5CF6 |
| WIP | Green | #10B981 |
| Outbound | Teal | #14B8A6 |

**Job Card Contents:**
- Customer name (truncated if long)
- Vehicle: "Make Model Year"
- Status badge (pill-shaped, color-coded per Section 4.5)
- Revenue stream badge (color-coded per Section 4.5)
- Mechanic name (if assigned, with avatar initial circle)
- Time in current bucket (from job_status_history: "2d 4h" or "45m")
- Priority indicator (up-arrow if manually reordered to top)
- Scope change indicator (orange dot if pending scope change exists)
- Photo thumbnail (first intake photo if available)

**Job Card Interactions:**
- Drag between columns → transition validation. If invalid, card snaps back with toast error
- Drag to reorder within column → updates priority field
- Click → opens job detail slide-over panel (board stays visible)
- Quick-action buttons on hover/long-press: "Send Quote" (new_requests), "Assign Mechanic" dropdown (available_jobs), "Mark Returned" (outbound)

**Board Toolbar (implemented ✅):**
- Search: customer name, vehicle make/model, description
- Mechanic filter: dropdown
- Revenue stream filter: dropdown (all 8 streams)
- Date range filter: created after / before
- Toggle: "Show archived" (off by default)
- "New Job" button + "From Template" submenu

**Real-time Updates:**
- Supabase Realtime subscription on jobs table (bucket, status, priority, mechanic_id)
- Card animates to new position/column on remote change
- Toast: "Job #BG-001 moved to WIP by [PA name]"
- Optimistic UI: local update immediate, server confirms async

**Mobile Behavior:**
- Single column view with bucket tabs (horizontal scrollable tab bar)
- Swipe left/right to switch buckets
- Pull-to-refresh
- Quick-action buttons always visible (not hover-dependent)

## 4.5 Status Color Coding

| Color | Hex (bg/text) | Statuses |
|-------|---------------|----------|
| Blue (New/Waiting) | #DBEAFE / #1E40AF | new, under_review, awaiting_customer |
| Amber (Action Needed) | #FEF3C7 / #92400E | quote_sent, awaiting_assignment, awaiting_parts, awaiting_approval, awaiting_drop_off, awaiting_pickup |
| Green (In Progress) | #D1FAE5 / #065F46 | confirmed, work_started, picked_up, in_transit, out_for_delivery, driver_assigned, driver_assigned_delivery |
| Red (Paused/Blocked) | #FEE2E2 / #991B1B | paused_parts, paused_approval |
| Dark Green (Complete) | #A7F3D0 / #064E3B | work_completed, received_at_shop, returned_to_customer |
| Gray (Terminal) | #F3F4F6 / #374151 | withdrawn, rejected, archived |

**Revenue Stream Colors:**

| Stream | Color | Hex |
|--------|-------|-----|
| service | Green | #10B981 |
| ecu | Purple | #8B5CF6 |
| sourcing | Blue | #3B82F6 |
| commission | Indigo | #6366F1 |
| track_day | Red | #EF4444 |
| transport | Amber | #F59E0B |
| dlt | Gray | #6B7280 |
| bike_hotel | Teal | #14B8A6 |

---

# 5. Data Model (Complete SQL Schema)

## 5.1 customers

```sql
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) UNIQUE,
  line_id VARCHAR(100) UNIQUE,
  email VARCHAR(255),
  nationality VARCHAR(50),
  preferred_language VARCHAR(5) NOT NULL DEFAULT 'th',
  consent_to_message BOOLEAN NOT NULL DEFAULT false,
  acquisition_source VARCHAR(30) CHECK (acquisition_source IN (
    'word_of_mouth', 'seo', 'chatgpt', 'walk_in', 'referral', 'social_media', 'repeat', 'other'
  )),
  related_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  notes TEXT,
  dormant BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Field-level UI spec:**
- `full_name`: required, placeholder "ชื่อ-นามสกุล / Full Name"
- `phone`: required, Thai format hint (+66), dedup key
- `line_id`: optional, helper "เพื่อรับแจ้งสถานะงาน / For job status updates"
- `email`: optional, email validation
- `nationality`: dropdown — Thai, British, American, Australian, German, Japanese, Norwegian, Other
- `preferred_language`: radio — "ภาษาไทย" / "English", default Thai
- `consent_to_message`: checkbox — "ยินยอมรับข้อความ / Consent to receive messages" (PDPA)
- `acquisition_source`: dropdown — Word of Mouth, SEO/Google, ChatGPT, Walk-in, Referral, Social Media, Repeat Customer, Other
- `related_customer_id`: customer search/select, optional, label "Linked Customer (household)"
- `dormant`: read-only badge, set by CRON — "Active" (green) or "Dormant" (gray)

## 5.2 users

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'pa', 'mechanic', 'driver')),
  preferred_language VARCHAR(5) NOT NULL DEFAULT 'th',
  line_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 5.3 vehicles

```sql
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INT NOT NULL,
  vin VARCHAR(50) UNIQUE,
  engine_number VARCHAR(50),
  color VARCHAR(50),
  license_plate VARCHAR(20),
  ownership_status VARCHAR(20) NOT NULL DEFAULT 'customer_owned'
    CHECK (ownership_status IN ('customer_owned', 'for_sale', 'for_rent')),
  last_service_date DATE,
  last_service_mileage INT,
  current_mileage INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Field-level UI spec:**
- `make`: dropdown — Honda, Yamaha, Kawasaki, KTM, Ducati, BMW, Triumph, Suzuki, Harley-Davidson, Royal Enfield, Other. (Honda 44, Yamaha 43, Kawasaki 23, KTM 21 are volume leaders from data)
- `model`: text with autocomplete from existing models for selected make
- `year`: number, min 1970, max current+1
- `vin`: optional, 17 chars, uppercase auto-format
- `color`: dropdown — Black, White, Red, Blue, Green, Silver, Orange, Yellow, Custom
- `ownership_status`: radio — Customer Owned (default), For Sale, For Rent

## 5.4 products

```sql
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,           -- Bilingual: 'Thai / English'
  description TEXT,                      -- Bilingual: 'Thai / English'
  category VARCHAR(50) NOT NULL
    CHECK (category IN ('parts', 'labour', 'service_package')),
  subcategory VARCHAR(50),
  cost_price NUMERIC(10,2),             -- NULL only for legacy imports
  sale_price NUMERIC(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'each'
    CHECK (unit IN ('each', 'hour', 'set', 'litre', 'metre')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Cost price validation rule:** For ALL new products created through UI, `cost_price` is REQUIRED. Column nullable only for legacy data imports — those records get `cost_estimated = true` on any line items using them.

**Field-level UI spec:**
- `sku`: auto-generated suggestion (e.g. PRT-FLT-001), editable, unique validation
- `name`: required, placeholder "ชื่อไทย / English Name"
- `category`: radio — Parts, Labour, Service Package
- `subcategory`: dropdown (changes by category):
  - Parts: Filters, Fluids, Electrical, Brakes, Tyres, Chain/Sprocket, Suspension, Engine, Exhaust, Body/Frame, Other
  - Labour: General, Inspection, Specialist, ECU
  - Service Package: Oil Change, Full Service, Valve Clearance, Fork Service
- `cost_price`: number with THB prefix, REQUIRED for new products
- `sale_price`: number with THB prefix, required
- `unit`: dropdown — Each, Hour, Set, Litre, Metre
- `active`: toggle, default on

## 5.5 job_templates

```sql
CREATE TABLE public.job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,           -- Bilingual: 'Thai / English'
  description TEXT,                      -- Bilingual
  revenue_stream VARCHAR(30) NOT NULL CHECK (revenue_stream IN (
    'service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel'
  )),
  estimated_duration_hours NUMERIC(4,1),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.job_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.job_templates(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  line_type VARCHAR(10) NOT NULL CHECK (line_type IN ('labour', 'part')),
  description VARCHAR(255) NOT NULL,    -- Bilingual
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Initial templates to create (from Data Analysis Report):**
- Oil Change / Basic Service
- General Service/Repair
- Full 20-Point Inspection
- Valve Clearance Service
- Fork Service / Rebuild
- Brake Service
- Tyre Replacement
- Chain & Sprocket
- ECU Tuning / Dyno
- Transport — Solo
- Transport — Shared
- DLT Document Transfer

## 5.6 jobs

```sql
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  mechanic_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.job_templates(id) ON DELETE SET NULL,

  -- Kanban fields
  bucket VARCHAR(20) NOT NULL DEFAULT 'new_requests'
    CHECK (bucket IN ('new_requests', 'intake', 'available_jobs', 'wip', 'outbound')),
  status VARCHAR(30) NOT NULL DEFAULT 'new'
    CHECK (status IN (
      'new', 'under_review', 'awaiting_customer', 'quote_sent', 'confirmed',
      'awaiting_drop_off', 'driver_assigned', 'picked_up', 'in_transit', 'received_at_shop',
      'awaiting_assignment', 'awaiting_parts', 'awaiting_approval',
      'work_started', 'paused_parts', 'paused_approval', 'work_completed',
      'awaiting_pickup', 'driver_assigned_delivery', 'out_for_delivery', 'returned_to_customer',
      'withdrawn', 'rejected', 'archived'
    )),
  priority INT NOT NULL DEFAULT 0,

  -- Logistics
  logistics_type VARCHAR(15) CHECK (logistics_type IN ('drop_off', 'pickup')),

  -- Classification
  revenue_stream VARCHAR(30) CHECK (revenue_stream IN (
    'service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel'
  )),

  -- Job details
  description TEXT NOT NULL,              -- Bilingual delimiter format
  mechanic_notes TEXT,
  intake_mileage INT,
  completion_mileage INT,
  intake_photos TEXT[],

  -- Thresholds
  owner_notify_threshold_thb INT NOT NULL DEFAULT 2000,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);
```

**Validation rules (enforced in API routes):**
- `revenue_stream` REQUIRED before job can move to `confirmed`
- `description` required on creation
- `mechanic_id` can only be set by owner or PA role
- Job cannot move to `work_completed` if zero line items → warning modal, PA override allowed
- Scope change approved but no line items added → block completion, notify PA

## 5.7 job_status_history

```sql
CREATE TABLE public.job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  from_bucket VARCHAR(20),
  from_status VARCHAR(30),
  to_bucket VARCHAR(20) NOT NULL,
  to_status VARCHAR(30) NOT NULL,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
```

**Display:** Vertical timeline on job detail panel. Each entry: timestamp, from→to status (translated via i18n), who changed it, optional notes. Most recent at top.

## 5.8 job_line_items

```sql
CREATE TABLE public.job_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  line_type VARCHAR(10) NOT NULL CHECK (line_type IN ('labour', 'part')),
  description VARCHAR(255) NOT NULL,
  sku VARCHAR(50),
  quantity NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2),
  sale_price NUMERIC(10,2) NOT NULL,
  cost_estimated BOOLEAN NOT NULL DEFAULT false,
  dlt_passthrough BOOLEAN NOT NULL DEFAULT false,
  is_scope_change BOOLEAN NOT NULL DEFAULT false,
  scope_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Cost price validation:** When `product_id` references a product, `cost_price` is auto-populated from catalog. For ad-hoc items (`product_id IS NULL`), `cost_price` is required for parts (API rejects if null for `line_type='part'`) and optional for labour. If referenced product has no cost_price (legacy import), `cost_estimated` is set true and cost calculated at 30% markup estimate.

**Quote Builder UI:**
- Product search with autocomplete (name, SKU, description)
- "Add from Catalog" → search modal with category filters
- "Add Custom Item" → manual entry row
- Each row: line_type toggle (Labour/Part), description, quantity (stepper), cost_price (auto-filled or manual), sale_price (auto-filled or manual), delete button
- Running totals: Subtotal, Margin (if cost_price available), Total
- DLT passthrough checkbox (only shown when revenue_stream = 'dlt')
- Scope change items shown with orange left-border

## 5.9 invoices

```sql
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  revenue_stream VARCHAR(30) NOT NULL CHECK (revenue_stream IN (
    'service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel'
  )),
  invoice_number VARCHAR(20) UNIQUE,    -- Auto-generated: BG-YYYY-NNNN
  invoice_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'quote' CHECK (status IN (
    'quote', 'approved', 'deposit_paid', 'pending', 'paid', 'void'
  )),
  total_amount NUMERIC(10,2) NOT NULL,
  deposit_amount NUMERIC(10,2),
  deposit_paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(10,2),
  payment_method VARCHAR(30) CHECK (payment_method IN (
    'cash', 'bank_transfer', 'promptpay', 'credit_card', 'other'
  )),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Invoice lifecycle UI:**
- Quote: "Send Quote" button (blue) → LINE message with summary + approval link
- Approved: "Record Deposit" button (if applicable)
- Pending: "Record Payment" button (green) → method dropdown + amount + date
- Paid: green "PAID" badge, read-only
- Void: red "VOID" badge

## 5.10 scope_changes

```sql
CREATE TABLE public.scope_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  flagged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  entered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  mechanic_notes TEXT,
  amount_thb NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'flagged'
    CHECK (status IN ('flagged', 'pending', 'approved', 'declined')),
  customer_response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 5.11 driver_work_orders

```sql
CREATE TABLE public.driver_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('pickup', 'delivery')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'assigned', 'en_route', 'arrived', 'loaded', 'in_transit', 'delivered', 'cancelled')),
  pickup_address TEXT,
  delivery_address TEXT,
  scheduled_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 5.12 message_log

```sql
CREATE TABLE public.message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  channel VARCHAR(10) NOT NULL DEFAULT 'line',
  message_type VARCHAR(30) NOT NULL,
  content TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered'))
);
```

## 5.13 reminder_log

```sql
CREATE TABLE public.reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  channel VARCHAR(10) NOT NULL DEFAULT 'line',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminder_type VARCHAR(20) NOT NULL CHECK (reminder_type IN ('service', 'ar'))
);
```

## 5.14 expenses

```sql
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  vendor VARCHAR(255),
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Field-level UI spec:**
- `category`: dropdown — Rent, Utilities, SEO/Marketing, Staff Salary, Insurance, Supplies, Vehicle (shop), Other
- `amount`: number with THB prefix
- `date`: date picker, default today
- `vendor`: text with autocomplete from previous entries
- `receipt_url`: file upload to Supabase Storage, thumbnail preview
- List view: table with date, category, amount, vendor, description. Filter by date range and category.

## 5.15 Supporting Database Objects

```sql
-- Extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Apply to all tables with updated_at
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER vehicles_set_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER expenses_set_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER jobs_set_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER driver_work_orders_set_updated_at BEFORE UPDATE ON public.driver_work_orders FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER job_templates_set_updated_at BEFORE UPDATE ON public.job_templates FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Auto-record job status changes via trigger
CREATE OR REPLACE FUNCTION public.record_job_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.job_status_history (job_id, to_bucket, to_status)
    VALUES (NEW.id, NEW.bucket, NEW.status);
  ELSIF (OLD.bucket IS DISTINCT FROM NEW.bucket OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.job_status_history (job_id, from_bucket, from_status, to_bucket, to_status)
    VALUES (NEW.id, OLD.bucket, OLD.status, NEW.bucket, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_record_status_change
AFTER INSERT OR UPDATE OF bucket, status ON public.jobs
FOR EACH ROW EXECUTE PROCEDURE public.record_job_status_change();

-- User role helpers
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'mechanic');
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_pa()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT public.get_user_role() IN ('owner', 'pa');
$$;

CREATE OR REPLACE FUNCTION public.is_mechanic_for_job(job_uuid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.jobs WHERE id = job_uuid AND mechanic_id = auth.uid());
$$;

-- Auth user sync trigger
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, full_name, role, preferred_language, line_id)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    coalesce(NEW.raw_app_meta_data ->> 'role', 'mechanic'),
    coalesce(NEW.raw_user_meta_data ->> 'preferred_language', 'th'),
    NEW.raw_user_meta_data ->> 'line_id'
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name, role = EXCLUDED.role,
        preferred_language = EXCLUDED.preferred_language, line_id = EXCLUDED.line_id, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_auth_user_sync();

-- Invoice number auto-generation
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE next_num INT;
BEGIN
  IF NEW.invoice_number IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INT)), 0) + 1
    INTO next_num FROM public.invoices
    WHERE invoice_number LIKE 'BG-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%';
    NEW.invoice_number := 'BG-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoices_generate_number BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE PROCEDURE public.generate_invoice_number();

-- Dormant customer marking
CREATE OR REPLACE FUNCTION public.mark_dormant_customers(cutoff_date DATE)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE public.customers SET dormant = true, updated_at = now()
  WHERE id IN (
    SELECT c.id FROM public.customers c
    LEFT JOIN public.jobs j ON j.customer_id = c.id
    LEFT JOIN public.invoices i ON i.customer_id = c.id
    GROUP BY c.id
    HAVING coalesce(max(j.created_at::date), date '1900-01-01') <= cutoff_date
       AND coalesce(max(i.invoice_date), date '1900-01-01') <= cutoff_date
  );
$$;

-- Indexes
CREATE INDEX idx_jobs_bucket_priority ON public.jobs(bucket, priority);
CREATE INDEX idx_jobs_bucket_status ON public.jobs(bucket, status);
CREATE INDEX idx_jobs_mechanic ON public.jobs(mechanic_id);
CREATE INDEX idx_jobs_customer ON public.jobs(customer_id);
CREATE INDEX idx_jobs_vehicle ON public.jobs(vehicle_id);
CREATE INDEX idx_jobs_created ON public.jobs(created_at);
CREATE INDEX idx_jobs_archived ON public.jobs(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX idx_job_status_history_job ON public.job_status_history(job_id);
CREATE INDEX idx_job_status_history_changed ON public.job_status_history(changed_at);
CREATE INDEX idx_invoices_customer_status ON public.invoices(customer_id, status);
CREATE INDEX idx_invoices_stream_date ON public.invoices(revenue_stream, invoice_date);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_vehicles_last_service ON public.vehicles(last_service_date);
CREATE INDEX idx_vehicles_customer ON public.vehicles(customer_id);
CREATE INDEX idx_customers_dormant ON public.customers(dormant);
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_scope_changes_status ON public.scope_changes(status);
CREATE INDEX idx_scope_changes_job ON public.scope_changes(job_id);
CREATE INDEX idx_message_log_sent ON public.message_log(sent_at);
CREATE INDEX idx_message_log_customer ON public.message_log(customer_id);
CREATE INDEX idx_driver_work_orders_job ON public.driver_work_orders(job_id);
CREATE INDEX idx_driver_work_orders_driver ON public.driver_work_orders(driver_id);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_active ON public.products(active) WHERE active = true;
CREATE INDEX idx_job_templates_active ON public.job_templates(active) WHERE active = true;
CREATE INDEX idx_expenses_date ON public.expenses(date);

-- Reporting role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'garage_reporting') THEN
    CREATE ROLE garage_reporting NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO garage_reporting;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO garage_reporting;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO garage_reporting;
```

---

# 6. Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_template_items ENABLE ROW LEVEL SECURITY;

-- CUSTOMERS
CREATE POLICY "customers_owner_pa" ON public.customers FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());
CREATE POLICY "customers_mechanic_read" ON public.customers FOR SELECT
  USING (public.get_user_role() = 'mechanic' AND id IN (
    SELECT customer_id FROM public.jobs WHERE mechanic_id = auth.uid()));

-- USERS
CREATE POLICY "users_owner_pa_read" ON public.users FOR SELECT
  USING (public.is_owner_or_pa() OR id = auth.uid());
CREATE POLICY "users_owner_manage" ON public.users FOR ALL
  USING (public.get_user_role() = 'owner') WITH CHECK (public.get_user_role() = 'owner');

-- VEHICLES
CREATE POLICY "vehicles_owner_pa" ON public.vehicles FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());
CREATE POLICY "vehicles_mechanic_read" ON public.vehicles FOR SELECT
  USING (public.get_user_role() = 'mechanic' AND EXISTS (
    SELECT 1 FROM public.jobs WHERE jobs.vehicle_id = vehicles.id AND jobs.mechanic_id = auth.uid()));

-- PRODUCTS
CREATE POLICY "products_owner_pa" ON public.products FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());
CREATE POLICY "products_staff_read" ON public.products FOR SELECT
  USING (public.get_user_role() IN ('mechanic', 'driver'));

-- JOB_TEMPLATES
CREATE POLICY "templates_owner_pa" ON public.job_templates FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());
CREATE POLICY "templates_staff_read" ON public.job_templates FOR SELECT
  USING (true);
CREATE POLICY "template_items_owner_pa" ON public.job_template_items FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());
CREATE POLICY "template_items_staff_read" ON public.job_template_items FOR SELECT
  USING (true);

-- JOBS
CREATE POLICY "jobs_owner_pa" ON public.jobs FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());
CREATE POLICY "jobs_mechanic_read" ON public.jobs FOR SELECT
  USING (public.get_user_role() = 'mechanic' AND mechanic_id = auth.uid());
CREATE POLICY "jobs_mechanic_update" ON public.jobs FOR UPDATE
  USING (public.get_user_role() = 'mechanic' AND mechanic_id = auth.uid())
  WITH CHECK (public.get_user_role() = 'mechanic' AND mechanic_id = auth.uid());
CREATE POLICY "jobs_driver_read" ON public.jobs FOR SELECT
  USING (public.get_user_role() = 'driver' AND EXISTS (
    SELECT 1 FROM public.driver_work_orders WHERE job_id = jobs.id AND driver_id = auth.uid()));

-- JOB_LINE_ITEMS
CREATE POLICY "line_items_owner_pa" ON public.job_line_items FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());
CREATE POLICY "line_items_mechanic_read" ON public.job_line_items FOR SELECT
  USING (public.get_user_role() = 'mechanic' AND public.is_mechanic_for_job(job_id));

-- JOB_STATUS_HISTORY
CREATE POLICY "history_owner_pa" ON public.job_status_history FOR SELECT
  USING (public.is_owner_or_pa());
CREATE POLICY "history_mechanic_read" ON public.job_status_history FOR SELECT
  USING (public.get_user_role() = 'mechanic' AND EXISTS (
    SELECT 1 FROM public.jobs WHERE id = job_status_history.job_id AND mechanic_id = auth.uid()));

-- INVOICES
CREATE POLICY "invoices_owner_pa" ON public.invoices FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

-- SCOPE_CHANGES
CREATE POLICY "scope_owner_pa" ON public.scope_changes FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());
CREATE POLICY "scope_mechanic_read" ON public.scope_changes FOR SELECT
  USING (public.get_user_role() = 'mechanic' AND public.is_mechanic_for_job(job_id));
CREATE POLICY "scope_mechanic_flag" ON public.scope_changes FOR INSERT
  WITH CHECK (public.get_user_role() = 'mechanic' AND public.is_mechanic_for_job(job_id));

-- DRIVER_WORK_ORDERS
CREATE POLICY "dwo_owner_pa" ON public.driver_work_orders FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());
CREATE POLICY "dwo_driver_read" ON public.driver_work_orders FOR SELECT
  USING (public.get_user_role() = 'driver' AND driver_id = auth.uid());
CREATE POLICY "dwo_driver_update" ON public.driver_work_orders FOR UPDATE
  USING (public.get_user_role() = 'driver' AND driver_id = auth.uid())
  WITH CHECK (public.get_user_role() = 'driver' AND driver_id = auth.uid());

-- MESSAGE_LOG, REMINDER_LOG
CREATE POLICY "message_log_owner_pa" ON public.message_log FOR SELECT USING (public.is_owner_or_pa());
CREATE POLICY "reminder_log_owner_pa" ON public.reminder_log FOR SELECT USING (public.is_owner_or_pa());

-- EXPENSES
CREATE POLICY "expenses_owner_pa" ON public.expenses FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());
```

---

# 7. Project Structure

```
bgop/
├── .env.local                          # Supabase URL, anon key, LINE secrets
├── .env.example
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── middleware.ts                        # Auth + role routing
│
├── public/
│   └── locales/
│       ├── en.json                     # English UI strings — NOT YET BUILT
│       └── th.json                     # Thai UI strings — NOT YET BUILT
│
├── supabase/
│   ├── config.toml
│   ├── seed.sql                        # Demo data + initial job templates
│   ├── migrations/
│   │   ├── 001_initial_schema.sql      # All tables from Section 5
│   │   ├── 002_indexes.sql
│   │   ├── 003_rls_policies.sql        # All RLS from Section 6
│   │   └── 004_functions_triggers.sql
│   └── functions/
│       ├── service-reminder/index.ts   # Daily 09:00 ICT — STUBBED
│       ├── ar-followup/index.ts        # Weekly Mon 08:00 ICT — STUBBED
│       └── dormant-segmentation/index.ts  # Monthly 1st 07:00 ICT — STUBBED
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout with i18n provider
│   │   ├── page.tsx                    # Redirect to /login or /board
│   │   │
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   │
│   │   ├── (dashboard)/               # Protected routes (owner + PA)
│   │   │   ├── layout.tsx              # Sidebar + header
│   │   │   ├── board/page.tsx          # ★ KANBAN BOARD — ✅ IMPLEMENTED
│   │   │   ├── messages/page.tsx       # ★ MESSAGES INBOX — ✅ IMPLEMENTED
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx            # Job list/search (all jobs including archived)
│   │   │   │   ├── [id]/page.tsx       # Job detail view
│   │   │   │   └── new/page.tsx        # PA manual job creation (+ from template)
│   │   │   ├── customers/
│   │   │   │   ├── page.tsx            # Customer list/search
│   │   │   │   └── [id]/page.tsx       # Customer profile
│   │   │   ├── vehicles/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── products/
│   │   │   │   └── page.tsx            # ★ CRUD NOT YET BUILT (API exists)
│   │   │   ├── templates/
│   │   │   │   └── page.tsx            # ★ CRUD NOT YET BUILT (API exists)
│   │   │   ├── invoices/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── expenses/
│   │   │   │   └── page.tsx            # ★ NOT YET BUILT
│   │   │   └── reports/
│   │   │       ├── page.tsx            # EOD summary + basic stats
│   │   │       └── export/page.tsx     # CSV export — NOT YET BUILT
│   │   │
│   │   ├── mechanic/                   # Protected (mechanic role)
│   │   │   └── page.tsx                # Thai mobile view — PARTIAL, needs hardening
│   │   │
│   │   ├── driver/                     # Protected (driver role)
│   │   │   └── page.tsx                # ★ NOT YET BUILT
│   │   │
│   │   ├── request/                    # PUBLIC — no auth required
│   │   │   └── page.tsx                # ★ Customer intake form — NOT YET BUILT
│   │   │
│   │   └── api/
│   │       ├── customers/route.ts + [id]/route.ts
│   │       ├── vehicles/route.ts + [id]/route.ts
│   │       ├── products/route.ts + [id]/route.ts     # ✅ API exists
│   │       ├── templates/route.ts + [id]/route.ts    # ✅ API exists
│   │       ├── messages/route.ts                     # ✅ IMPLEMENTED
│   │       ├── jobs/
│   │       │   ├── route.ts                          # ✅ IMPLEMENTED (auto-creates invoice)
│   │       │   ├── [id]/route.ts                     # ✅ IMPLEMENTED (includes invoice + scope_changes)
│   │       │   ├── [id]/transition/route.ts          # ✅ Validated transitions
│   │       │   ├── [id]/line-items/route.ts          # ✅ IMPLEMENTED (syncs invoice total)
│   │       │   ├── [id]/line-items/[itemId]/route.ts # ✅ IMPLEMENTED (DELETE + PATCH + sync)
│   │       │   ├── [id]/scope-changes/route.ts       # ✅ IMPLEMENTED
│   │       │   ├── [id]/assign/route.ts
│   │       │   └── [id]/send-quote/route.ts          # ✅ IMPLEMENTED
│   │       ├── scope-changes/[id]/route.ts           # ✅ IMPLEMENTED (approve/decline)
│   │       ├── invoices/route.ts + [id]/route.ts + [id]/payment/route.ts
│   │       ├── driver-work-orders/route.ts + [id]/route.ts  # NOT YET BUILT
│   │       ├── expenses/route.ts + [id]/route.ts            # NOT YET BUILT
│   │       ├── intake/route.ts                              # NOT YET BUILT
│   │       ├── reports/eod/route.ts + revenue-by-stream/route.ts + export/route.ts
│   │       └── webhooks/line/route.ts
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx, Modal.tsx, SlideOver.tsx, FormField.tsx
│   │   │   ├── DataTable.tsx, StatusBadge.tsx, RevenueStreamBadge.tsx
│   │   │   ├── StatCard.tsx, EmptyState.tsx, LanguageToggle.tsx
│   │   │   ├── Toast.tsx, PhotoCapture.tsx
│   │   ├── layout/Sidebar.tsx, Header.tsx, MobileNav.tsx
│   │   ├── kanban/
│   │   │   ├── KanbanBoard.tsx         # ✅ Five columns + realtime (realtime pending)
│   │   │   ├── KanbanColumn.tsx        # ✅
│   │   │   ├── JobCard.tsx             # ✅ useSortable, badges, scope dot
│   │   │   └── JobCardDetail.tsx       # ✅ Full drawer, invoice at position 2
│   │   ├── jobs/
│   │   │   ├── JobForm.tsx             # ✅
│   │   │   ├── JobTimeline.tsx         # ✅ (needs history data from trigger)
│   │   │   ├── QuoteBuilder.tsx        # ✅ Product search + ad-hoc + totals
│   │   │   ├── SendQuoteButton.tsx     # ✅
│   │   │   ├── ScopeChangeForm.tsx     # ✅
│   │   │   ├── MechanicFlagForm.tsx    # ✅
│   │   │   └── TemplateSelector.tsx   # ✅ With preview panel
│   │   ├── customers/CustomerForm.tsx, CustomerProfile.tsx
│   │   ├── vehicles/VehicleForm.tsx
│   │   ├── invoices/InvoiceForm.tsx, InvoiceDetail.tsx, PaymentRecordForm.tsx
│   │   ├── products/ProductForm.tsx     # NOT YET BUILT
│   │   ├── templates/TemplateForm.tsx   # NOT YET BUILT
│   │   ├── expenses/ExpenseForm.tsx     # NOT YET BUILT
│   │   ├── intake/IntakeForm.tsx        # NOT YET BUILT
│   │   ├── mechanic/MechanicJobView.tsx # PARTIAL
│   │   ├── driver/DriverQueue.tsx       # NOT YET BUILT
│   │   └── reports/EODSummary.tsx, ExportPanel.tsx
│   │
│   ├── lib/
│   │   ├── supabase/client.ts, server.ts, admin.ts, middleware.ts
│   │   ├── supabase/realtime.ts         # ★ NOT YET BUILT — needed for C11
│   │   ├── line/client.ts, templates.ts
│   │   ├── messaging/service.ts
│   │   ├── jobs/transitions.ts          # ★ Single source of truth for valid transitions
│   │   ├── jobs/helpers.ts
│   │   ├── i18n/config.ts, useTranslation.ts  # NOT YET BUILT
│   │   ├── data/queries.ts
│   │   └── utils/format.ts, validation.ts, permissions.ts, export.ts
│   │
│   └── types/domain.ts                  # TypeScript types for all entities
```

---

# 8. Role-Based Access & Views

| Role | Default Lang | Landing Page | Access | Capabilities |
|------|-------------|-------------|--------|-------------|
| Owner | English | /board | Full system + reporting | All modules, exports, user mgmt, exception alerts |
| PA | Bilingual | /board | Full operational | Kanban, jobs, quotes, invoices, scope changes, customers, templates, expenses |
| Mechanic | Thai | /mechanic | Assigned jobs only | Start/Complete Work, Flag Additional Work, add notes. No pricing, no reorder |
| Driver | Thai | /driver | Pickup/delivery queue | View/update own work orders only. No jobs, invoices, customers |

**Mechanic View (/mechanic) — detailed spec:**
- Shows jobs in WIP bucket where mechanic_id = current user
- Thai language only, large touch targets (min 48px), mobile-optimized
- Per job card: vehicle photo (if available), make/model/year, job description (Thai portion parsed from delimiter)
- Three large action buttons (full-width, stacked):
  - เริ่มงาน (Start Work) — green, shown when status = work_started or returned from pause
  - งานเสร็จ (Complete Work) — blue, shown when status = work_started
  - พบงานเพิ่ม (Flag Additional Work) — amber, always shown during WIP
- Flag form: single textarea for Thai notes (no pricing)
- General notes field: textarea บันทึกช่าง / Mechanic Notes — persists on jobs.mechanic_notes
- No access to: customer contact info, pricing/cost data, other mechanics' jobs, Kanban board

**Driver View (/driver) — detailed spec:**
- Shows driver_work_orders where driver_id = current user, ordered by scheduled_date
- Thai language only, mobile-optimized
- Per work order: vehicle (from linked job), order_type badge (Pickup/Delivery), address, scheduled date, status
- Status update buttons: กำลังไป (En Route) → ถึงแล้ว (Arrived) → โหลดแล้ว (Loaded) → กำลังส่ง (In Transit) → ส่งแล้ว (Delivered)

---

# 9. Customer Intake Form Specification

**Route:** /request (public, no authentication required)

**Step 1 — Language:** Two large buttons — ภาษาไทย | English. Sets preferred_language.

**Step 2 — Contact Info:**
- Phone (required, Thai format hint, large keypad input)
- Full name (required)
- LINE ID (optional, helper: เพื่อรับแจ้งสถานะงาน / To receive status updates)
- Email (optional)

**Step 3 — Vehicle:**
- If phone matches existing customer: show their vehicles as selectable cards + "เพิ่มรถใหม่ / Add New Vehicle"
- Make (dropdown), Model (text), Year (number), License plate (optional), Color (optional)

**Step 4 — Service Request:**
- Service type: multi-select — General Service, Inspection, Repair, Tyres, Brakes, Fork Service, Valve Clearance, ECU Tuning, Transport, DLT/Documents, Other
- Description: textarea, required
- Current mileage: optional but encouraged

**Step 5 — Logistics:**
- 🏍️ นำมาเอง / I'll bring it → logistics_type = drop_off
- 🚛 ต้องการรับรถ / I need pickup → logistics_type = pickup + address textarea

**Step 6 — Confirm:**
- Summary card. PDPA consent checkbox. Submit button.
- Success screen with checkmark animation
- If LINE ID provided: send confirmation LINE message

**Dedup logic (POST /api/intake):**
1. Search customers by phone (exact match)
2. If match: use existing, update LINE ID + preferred_language if new
3. If no match: create new customer (acquisition_source = 'walk_in')
4. Search vehicles for customer by make + model + year (fuzzy)
5. If match: use existing vehicle
6. If no match: create new vehicle
7. Create job: bucket=new_requests, status=new, logistics_type from form
8. Rate limiting: max 5 submissions per phone per hour

**QR Code:** Generate static QR pointing to /request. Printable card for counter. Butler Garage logo + "Scan to book / สแกนเพื่อจอง".

---

# 10. LINE Messaging Integration

## 10.1 Notification Triggers

| Trigger Event | Message Type | Bucket Transition | Phase |
|---------------|-------------|-------------------|-------|
| Intake form submitted | Confirmation to customer (if LINE ID) | — | 1 |
| Job confirmed by PA | "Your job has been confirmed" | new_requests → intake | 1 |
| Vehicle received at shop | "Your bike has arrived at Butler Garage" | intake → available_jobs | 1 |
| Work completed | "Your bike is ready for pickup/delivery" | wip → outbound | 1 |
| Scope change requires approval | LINE Flex Message with Approve/Decline | (within wip) | 1 |
| Scope change approved/declined | Status update | — | 1 |
| Quote sent to customer | LINE message with quote summary + total | (within new_requests) | 1 |
| Invoice payment recorded | "Payment received — thank you" | — | 1 |
| Driver en route (pickup) | "Our driver is on the way to collect your bike" | — | 2 |
| Driver en route (delivery) | "Your bike is on its way back to you" | — | 2 |
| Invoice overdue 7 days | "Friendly reminder — invoice outstanding" | — | 1 |
| Invoice overdue 14 days | Alert to PA (no customer message) | — | 1 |
| Service reminder (11 months) | "Time for your next service at Butler Garage" | — | 2 |

## 10.2 Message Format

All automated messages are bilingual:
```
🔧 Butler Garage

[Thai message]

[English message]

—
Butler Garage | Bangkok
```

## 10.3 "Send Quote" Button — Unified Send UX

When PA clicks "Send Quote":
1. Modal: quote summary (line items, total), customer name, LINE ID, preview of LINE message
2. "Send" → LINE message sent + invoice status updated + job status → quote_sent + message logged
3. Success toast: "Quote sent to [customer name] via LINE"

## 10.4 Scope Change LINE Flow

1. Mechanic flags → PA sees visual indicator on Kanban card
2. PA enters scope change: bilingual description + amount from catalog
3. PA clicks "Send for Approval" → LINE Flex Message: description, amount, Approve/Decline buttons
4. Customer taps → LINE webhook → POST /api/webhooks/line
5. Webhook validates X-Line-Signature, parses `scope_approve:{id}` or `scope_decline:{id}`
6. On approve: line items added, invoice total updated. On decline: PA + owner notified
7. No response after 24h: NO auto-remind (PA follows up manually)

## 10.5 Rate Limiting & Compliance

- Messages only sent: consent_to_message = true AND line_id IS NOT NULL
- Maximum 3 automated status messages per job (excludes scope change interactions)
- LINE free tier: 500 messages/month. Alert PA at 80% threshold. Budget paid tier at 1,500 THB/mo
- All messages logged in message_log
- Demo mode: log without sending (NEXT_PUBLIC_DEMO_MODE env var)

---

# 11. Bilingual Architecture

## 11.1 Three Layers

**Layer 1 — UI Chrome:** en.json / th.json. Components use `useTranslation()` hook. `preferred_language` field drives active file. LanguageToggle for switching.

**Layer 2 — Data Fields:** `'Thai text / English text'` with ` / ` delimiter. Staff UI displays full string. `parseBilingual(text, 'th')` helper extracts one language for customer-facing outputs.

**Layer 3 — Customer-facing:** LINE messages always bilingual. Intake form in customer's language. PDF invoices bilingual by default.

## 11.2 Translation File Structure

```json
{
  "nav": { "board": "Job Board", "jobs": "Jobs", "customers": "Customers", "vehicles": "Vehicles", "products": "Products", "templates": "Templates", "invoices": "Invoices", "expenses": "Expenses", "reports": "Reports" },
  "buckets": { "new_requests": "New Requests", "intake": "Intake", "available_jobs": "Available Jobs", "wip": "Work in Progress", "outbound": "Outbound" },
  "status": {
    "new": "New", "under_review": "Under Review", "awaiting_customer": "Awaiting Customer",
    "quote_sent": "Quote Sent", "confirmed": "Confirmed",
    "awaiting_drop_off": "Awaiting Drop-off", "driver_assigned": "Driver Assigned",
    "picked_up": "Picked Up", "in_transit": "In Transit", "received_at_shop": "Received",
    "awaiting_assignment": "Awaiting Assignment", "awaiting_parts": "Awaiting Parts",
    "awaiting_approval": "Awaiting Approval",
    "work_started": "Work Started", "paused_parts": "Paused - Parts",
    "paused_approval": "Paused - Approval", "work_completed": "Work Completed",
    "awaiting_pickup": "Awaiting Pickup", "driver_assigned_delivery": "Driver Assigned",
    "out_for_delivery": "Out for Delivery", "returned_to_customer": "Returned",
    "withdrawn": "Withdrawn", "rejected": "Rejected", "archived": "Archived"
  },
  "revenue_streams": { "service": "Service & Repair", "ecu": "ECU / Tuning", "sourcing": "Bike Sourcing", "commission": "Sales Commission", "track_day": "Track Day", "transport": "Transport", "dlt": "DLT / Documents", "bike_hotel": "Bike Hotel" },
  "mechanic": { "start_work": "Start Work", "complete_work": "Complete Work", "flag_additional": "Flag Additional Work", "notes": "Mechanic Notes" },
  "driver": { "en_route": "En Route", "arrived": "Arrived", "loaded": "Loaded", "in_transit": "In Transit", "delivered": "Delivered" },
  "actions": { "send_quote": "Send Quote", "confirm": "Confirm", "assign_mechanic": "Assign Mechanic", "mark_returned": "Mark Returned", "record_payment": "Record Payment", "new_job": "New Job", "from_template": "From Template", "export_csv": "Export CSV" }
}
```

Thai translations (th.json) mirror this structure. Andy provides with owner review.

---

# 12. Build Sequence

## Phase A: Foundation — ✅ Complete (except A5 i18n)

| # | Task | Status |
|---|------|--------|
| A1 | Initialize Next.js 14: TypeScript, Tailwind, App Router, @dnd-kit | ✅ |
| A2 | Supabase project + apply all migrations | ⚠️ Verify all tables deployed |
| A3 | Supabase clients (browser, server, admin, middleware, realtime) | ✅ |
| A4 | Auth middleware with role-based routing | ✅ |
| A5 | i18n setup (en.json + th.json + useTranslation + toggle) | ❌ Pending |
| A6 | TypeScript domain types matching all schema tables | ✅ |
| A7 | Layout: Sidebar, Header, MobileNav | ✅ |
| A8 | Login page with role-appropriate redirect | ✅ |

## Phase B: Core Data Modules — Partial

| # | Task | Status |
|---|------|--------|
| B1 | Products CRUD: list, create (cost_price required), edit, soft delete | ⏳ API only, no admin page |
| B2 | Job Templates CRUD: list, create with inline item editor | ⏳ API only, no admin page |
| B3 | Customers CRUD: list, create, edit | ✅ |
| B4 | Customer Profile: vehicles, job history, invoice history, messages | ✅ |
| B5 | Vehicles CRUD: list, create, edit, customer linking | ✅ |
| B6 | Expenses CRUD: list, create, edit, delete | ❌ Not built |
| B7 | Server-side data queries layer (React cache) | ✅ |
| B8 | API routes with Zod validation | ✅ |

## Phase C: Job System & Kanban — Mostly Complete

| # | Task | Status |
|---|------|--------|
| C1 | Job creation: manual | ✅ |
| C2 | Job creation from template: pre-populated items | ✅ |
| C3 | Job detail SlideOver panel | ✅ |
| C4 | JobTimeline: job_status_history as vertical timeline | ✅ (needs trigger firing) |
| C5 | Status transition API with full validation | ✅ |
| C6 | Validation guards: 0 items / revenue_stream | ✅ |
| C7 | Kanban board: 5 columns with @dnd-kit | ✅ |
| C8 | Job cards: all fields, badges, scope dot | ✅ |
| C9 | Drag between columns: validation, snap back | ✅ |
| C10 | Drag to reorder within column: priority | ✅ |
| C11 | Real-time Kanban: Supabase Realtime subscription | ⏳ Not yet implemented |
| C12 | Board toolbar: search, filters, New Job + From Template | ✅ |
| C13 | Quick-action buttons on cards | ✅ |
| C14 | Quote builder: product search + ad-hoc + totals + margin | ✅ |
| C15 | "Send Quote": LINE + job status + message log | ✅ (LINE pending OA upgrade) |
| C16 | Mechanic assignment from Available Jobs | ✅ |
| C17 | Photo capture: camera/file → Supabase Storage | ⏳ Not yet implemented |

## Phase D: Role-Specific Views — Partial

| # | Task | Status |
|---|------|--------|
| D1 | Mechanic mobile view: Start/Complete/Flag + notes (Thai, large buttons) | ⏳ Basic exists, needs hardening |
| D2 | MechanicFlagForm: Thai textarea → scope_change flagged | ✅ |
| D3 | Scope change PA flow: flagged → enter → send for approval | ✅ |
| D4 | Driver mobile view: work order queue, status buttons (Thai) | ❌ Not built |
| D5 | Driver work order creation by PA | ❌ Not built |

## Phase E: Customer Form & LINE Integration — Not Started

| # | Task | Status |
|---|------|--------|
| E1 | Public intake form /request: 6 steps, bilingual, progress bar | ❌ |
| E2 | Phone-based dedup + vehicle matching on submission | ❌ |
| E3 | Form creates customer + vehicle + job, rate-limited | ❌ |
| E4 | QR code generation for /request URL | ❌ |
| E5 | LINE client: push, Flex, webhook verification | ⚠️ Needs OA upgrade |
| E6 | All Phase 1 LINE templates (bilingual) | ⏳ Templates exist, wire pending |
| E7 | Wire LINE notifications to job transitions | ❌ |
| E8 | Scope change Flex Message with Approve/Decline buttons | ❌ |
| E9 | LINE webhook handler: scope change responses | ⏳ Handler exists, needs testing |
| E10 | Quote delivery via LINE (from Send Quote button) | ⏳ Flow built, LINE pending |

## Phase F: Invoicing & Reporting — Partial

| # | Task | Status |
|---|------|--------|
| F1 | Invoice list: status filter tabs, AR aging | ⏳ Basic list exists |
| F2 | Invoice detail: full info + line items + payment form | ⏳ Partial |
| F3 | Invoice lifecycle: quote → approved → deposit_paid → pending → paid | ⏳ Quote/approved done. Deposit pending. |
| F4 | Auto-generated invoice numbers (BG-2026-0001) | ✅ (trigger in schema) |
| F5 | Payment recording: method dropdown + amount + date | ❌ |
| F6 | End-of-Day summary: today's revenue, invoices, jobs by bucket | ⏳ Basic stats only |
| F7 | CSV export for all entities + job_status_history | ❌ |
| F8 | KPI export: all 37 metrics | ❌ |
| F9 | Reporting role database access verified | ⚠️ Verify in Supabase |

## Phase G: Automation & Polish — Not Started

| # | Task | Status |
|---|------|--------|
| G1 | AR follow-up edge function: 7d LINE, 14d PA alert | ❌ |
| G2 | Dormant segmentation edge function | ❌ |
| G3 | Service reminder edge function: daily, 11-month trigger | ❌ |
| G4 | PDF invoice/quote: bilingual, branded, downloadable | ❌ |
| G5 | End-to-end QA: intake form → payment | ❌ |
| G6 | Butler Garage branding throughout | ❌ Pending assets |
| G7 | Production deployment to Vercel | ❌ |
| G8 | Seed data: demo customers, vehicles, products, templates | ⏳ Partial |

---

# 13. KPI & Metrics Export Specification

All 37 metrics from the Data Analysis Report. Source tables and calculation methods below.

## 13.1 Business Performance KPIs

| # | KPI | Source Tables | Calculation | Available |
|---|-----|---------------|-------------|-----------|
| 1 | Monthly Revenue | invoices | SUM(total_amount) WHERE status IN ('pending','paid') GROUP BY month | Day 1 |
| 2 | Revenue by Stream | invoices | SUM(total_amount) GROUP BY revenue_stream | Day 1 |
| 3 | Invoice Volume | invoices | COUNT(*) GROUP BY month | Day 1 |
| 4 | Average Invoice Value | invoices | AVG(total_amount) | Day 1 |
| 5 | Gross Margin % | job_line_items | (SUM(sale_price*qty) - SUM(cost_price*qty)) / SUM(sale_price*qty) | After cost_price captured |
| 6 | Net Profit | invoices + expenses | Monthly revenue - monthly expenses - COGS | After expenses tracked |
| 7 | Owner Hours in Relay | message_log | Compare message volume pre/post system launch | 60 days post-launch |
| 8 | Jobs Per Week | jobs | COUNT(*) WHERE created_at in week | Day 1 |
| 9 | AR Days Outstanding | invoices | AVG(CURRENT_DATE - invoice_date) WHERE status = 'pending' | Day 1 |
| 10 | Walk-In Capture Rate | customers | COUNT(acquisition_source='walk_in' AND has_return_visit) / total walk-ins | 90 days |

## 13.2 Mechanic Performance KPIs

| # | KPI | Source Tables | Calculation | Available |
|---|-----|---------------|-------------|-----------|
| 11 | Jobs Completed / Week | jobs | COUNT(*) WHERE mechanic_id = X AND status reached work_completed GROUP BY week | Day 1 |
| 12 | Revenue Per Mechanic / Month | jobs + invoices | SUM(invoice.total_amount) for jobs WHERE mechanic_id = X | Day 1 |
| 13 | Labour Revenue / Mechanic | job_line_items + jobs | SUM(sale_price*qty) WHERE line_type='labour' AND mechanic_id = X | Day 1 |
| 14 | Job Completion Time | job_status_history | AVG(time between work_started and work_completed entries) | Day 1 |
| 15 | Rework Rate | jobs + vehicles | Jobs where same vehicle has new job within 30 days of completion | 90 days |
| 16 | Parts Accuracy | job_line_items | Requires PO tracking (Phase 2) | Phase 2 |
| 17 | Bay Utilisation | job_status_history | Requires time clocking (Phase 2) | Phase 2 |
| 18 | Upsell Rate | scope_changes + jobs | COUNT(jobs with approved scope changes) / COUNT(all completed jobs) | Day 1 |

## 13.3 Operational SLAs

| # | KPI | Target | Source | Available |
|---|-----|--------|--------|-----------|
| 19 | Invoice within 24hrs of completion | 95% | job_status_history + invoices | Day 1 |
| 20 | Cost price on new parts | 100% (enforced) | job_line_items | Day 1 |
| 21 | Revenue stream tagged | 100% (enforced) | invoices | Day 1 |
| 22 | Mileage capture rate | 95% target | jobs | Day 1 |
| 23 | Job status updated within 1hr | 90% | job_status_history | Day 1 |
| 24 | AR contacted at 7 days | 100% | reminder_log + invoices | After CRON live |
| 25 | Walk-in offered CRM signup | 80% target | customers | Day 1 |
| 26 | LINE ID capture rate | 90% of new | customers | Day 1 |
| 27 | Scope change communicated within 2hrs | <2 hrs target | scope_changes + message_log | Day 1 |

## 13.4 Customer Metrics

| # | KPI | Source | Calculation | Available |
|---|-----|--------|-------------|-----------|
| 28 | Unique Customers / Month | invoices | COUNT(DISTINCT customer_id) GROUP BY month | Day 1 |
| 29 | Repeat Customer Rate | invoices | COUNT(customers with 2+ invoices) / COUNT(distinct customers) | 90 days |
| 30 | Customer Retention Rate | invoices (multi-year) | Requires 12+ months of data | 12 months |
| 31 | Dormant Reactivation Rate | reminder_log + jobs | Jobs from customers within 30 days of reminder / reminders sent | After reminders live |
| 32 | Customer Lifetime Value | invoices | SUM(total_amount) GROUP BY customer_id | 6 months |
| 33 | Time Between Visits | invoices | AVG(days between consecutive invoices per customer) | 6 months |
| 34 | Referral Rate | customers | COUNT(acquisition_source='referral') / COUNT(new customers) | Day 1 |

## 13.5 Financial Metrics

| # | KPI | Source | Calculation | Available |
|---|-----|--------|-------------|-----------|
| 35 | Revenue Per Working Day | invoices | Monthly revenue / 22 | Day 1 |
| 36 | Parts Markup Achieved | job_line_items | AVG(sale_price / cost_price) WHERE line_type='part' AND cost_price > 0 | After cost_price captured |
| 37 | Revenue Concentration (Top 5) | invoices | SUM(top 5 customer revenue) / total revenue | Day 1 |

## 13.6 End-of-Day (EOD) Summary Report

| Metric | Calculation | Display |
|--------|-------------|---------|
| Today's Revenue | SUM(invoices.total_amount) WHERE invoice_date = today AND status IN ('pending','paid') | Large THB number |
| Invoices Created Today | COUNT(invoices) WHERE created_at = today | Number |
| Payments Received Today | SUM(invoices.paid_amount) WHERE paid_at = today | Number + method breakdown |
| Jobs Created Today | COUNT(jobs) WHERE created_at = today | Number |
| Jobs Completed Today | COUNT(job_status_history) WHERE to_status = 'work_completed' AND changed_at = today | Number |
| Outstanding AR Total | SUM(invoices.total_amount - COALESCE(paid_amount,0)) WHERE status = 'pending' | Number, red if > 50K THB |
| Active Jobs by Bucket | COUNT per bucket WHERE archived_at IS NULL | 5 stat cards |

---

# 14. Architecture Decision Records

## ADR-001: Five-Bucket Kanban (New Requests → Intake → Available Jobs → WIP → Outbound)
**Status:** Accepted. Separating Available Jobs from WIP gives PA clear visibility into queued vs. active work. No Closed column — terminal jobs leave the board and are accessible via search. Confidence: High.

## ADR-002: Clean Build with Pattern Cherry-Pick
**Status:** Accepted. New build. Proven patterns from GarageCRM-main replicated (Supabase clients, LINE service, Zod validation, RLS approach). Confidence: High.

## ADR-003: Supabase as Unified Platform
**Status:** Accepted. Postgres + Auth + Realtime + Edge Functions + Storage. Free tier sufficient. Confidence: High.

## ADR-004: Bilingual Data via Single-Field Delimiter
**Status:** Accepted. `'Thai / English'` in one field. Simpler than dual columns or JSON for two languages. Confidence: High.

## ADR-005: PA-Mediated Scope Changes (Two-Step)
**Status:** Accepted — Implemented. Mechanic flags (Thai notes, no pricing) → PA enters formal scope change (bilingual, catalog pricing) → sends to customer. Confidence: High.

## ADR-006: Export-Friendly Reporting Over Built-In Dashboards
**Status:** Accepted. Minimal in-app (EOD, AR aging, bucket counts). Rich analytics via CSV export + reporting role. Confidence: High.

## ADR-007: Vercel Free Tier Deployment
**Status:** Accepted. Confidence: High.

## ADR-008: Job Templates (Canned Jobs)
**Status:** Accepted. All three competitors support this. Users save 20-30 min per estimate. Butler Garage has ~10 common service types covering ~80% of jobs. Template items copied at current catalog pricing. PA can modify before saving. Confidence: High.

## ADR-009: Real-time Kanban via Supabase Realtime
**Status:** Accepted. Supabase Realtime subscription on jobs table for bucket, status, priority, mechanic_id changes. Optimistic UI with server confirmation. Confidence: High.

## ADR-010: Mandatory Cost Price on New Parts
**Status:** Accepted. All new products created through UI require cost_price. Schema nullable only for legacy imports. cost_estimated flag on line items using legacy products. Confidence: High.

## ADR-011: LINE as Primary Channel (No SMS Fallback in Phase 1)
**Status:** Accepted. LINE-only in Phase 1. PA manually contacts customers without LINE ID. SMS fallback deferred to Phase 2 if LINE coverage <85%. Confidence: Medium — monitor LINE ID capture rate.

---

# 15. Risk Register

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Mechanic resistance to digital workflow | M | H | Thai-only UI, LINE-adjacent simplicity, champion one mechanic first, hands-on training |
| Owner reverts to message relay | H | H | Weekly check-in, make old workflow harder, show time-reclaimed data |
| Product catalog incomplete at launch | H | L | Ad-hoc items always allowed. Templates use existing items. Catalog grows organically. |
| LINE rate limit hit (500 free/month) | M | M | Track volume. Budget paid tier (1,500 THB/mo for 3,000 msgs). Alert PA at 80%. |
| Claude Code build exceeds timeline | M | M | Phased delivery — Phases A-C now complete |
| Thai translations incomplete | M | L | Andy provides. Placeholder English acceptable for soft launch. |
| Customer intake form spam | M | L | Rate limiting (5/phone/hour). PA reviews all before confirmation. |
| Supabase Realtime subscription limits | L | M | Free tier: 200 concurrent connections. Sufficient for 5 staff. |
| Data import quality issues | M | M | Andy cleans data. 20-record sample verification post-import. |
| LINE webhook delivery failures | M | M | Log all webhook events. Demo mode for development. Manual PA fallback. |
| Cost_price requirement blocks PA workflow | L | M | PA can always add estimated products with cost_estimated=true. |
| Schema migration incomplete | M | H | Verify all v3.2 tables and triggers deployed before resuming build. |

---

# 16. Open Questions

| Question | Impact | Who |
|----------|--------|-----|
| At January peak (56 mechanic jobs), were mechanics at capacity? | Hiring decision, scheduling features | Owner |
| Do the two mechanics specialize (e.g., one does ECU)? | Single point of failure for 18% of revenue | Owner |
| How many bays/lifts? Can both work simultaneously? | Physical capacity constraint | Owner |
| Actual turnaround time per job type? | SLA targets, customer ETAs | Owner + Mechanics |
| Does the driver plan routes or does PA plan for him? | Driver view complexity | Owner |
| What % of customers use LINE vs phone vs in-person? | LINE notification reach | Owner |
| Track Day package components? | Track Day module design (Phase 3) | Owner |
| Is 155K/month OpEx still accurate? | Financial model | Owner |
| Has cost price recording started? | Margin visibility timeline | Owner / PA |
| Butler Garage branding assets (logo, colors, fonts)? | UI branding, PDFs, intake form | Andy / Owner |
| LINE OA upgrade — when can owner complete? | Blocks all CRON automation and notification wiring | Owner |

---

# 17. Data Import Strategy

**Import:** Customers (357 CRM records), Vehicles (all from CRM), Products (876 SKUs).
**Do NOT import:** Historical invoices (554 from 2025-2026), job records, payment records.

**Process:** Andy cleans → CSV → Claude Code import script → Supabase → 20-record verification → full import → dedup check.

**Product import rule:** Legacy products imported with cost_price = NULL are permitted (column is nullable). Any NEW product created through UI requires cost_price. cost_estimated flag applies to line items using legacy products.

---

# 18. Environment & Configuration

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]

# LINE
LINE_CHANNEL_ACCESS_TOKEN=[token]
LINE_CHANNEL_SECRET=[secret]

# App
NEXT_PUBLIC_APP_URL=https://[domain]
NEXT_PUBLIC_DEMO_MODE=false
```

---

# 19. Phase 2+ Roadmap (Schema-Ready, Not Built)

| Item | Phase | Trigger | Schema Impact |
|------|-------|---------|---------------|
| Digital Vehicle Inspection (DVI) module | 2 | Phase 1 stable 60 days | New tables: inspections, inspection_templates, inspection_items |
| Appointment calendar view | 2 | PA requests calendar | New table: appointments. Links to jobs on conversion. |
| Declined/deferred work tracking | 2 | Scope change data accumulates | New field: scope_changes.deferred_until |
| Technician time clocking | 2 | Mechanic KPI data needed | New table: time_entries (user_id, job_id, clock_in, clock_out) |
| SMS fallback (Twilio) | 2 | LINE ID capture <85% | channel field on message_log already supports 'sms' |
| Transport route-matching | 2 | Transport >60/quarter | driver_work_orders has address fields |
| Customer segmentation campaigns | 2 | Dormant data + LINE working | Build on dormant flag + acquisition_source + invoice history |
| Track Day / Motorsport module | 3 | Owner quantifies economics | New tables: events, event_participants |
| Bike sourcing sales CRM | 3 | Owner confirms priority | New table: sourcing_leads |
| Online payment processing (PromptPay) | 2-3 | Manual recording burdensome | payment_method field ready |
| QuickBooks API sync | 3 | Accounting painful | invoices + expenses tables ready |
| NPS / satisfaction survey | 2 | Job system stable 90+ days | New table: surveys. LINE post-service. |
| AI-assisted note writing | 3 | Text infrastructure stable | AI layer on description/notes fields |
| Mileage-based service reminder | 2 | Mileage capture >80% | vehicles.current_mileage already tracked |
| Google review request automation | 2 | Job volume steady | Post-completion LINE message with review link |

---

# Appendix A: Glossary

| Term | Definition |
|------|------------|
| Bucket | A Kanban column representing a workflow phase (5 buckets) |
| Status | Granular state within a bucket |
| Revenue Stream | One of 8 business categories |
| Scope Change | Additional work found during a job requiring customer approval |
| Driver Work Order | A pickup or delivery task linked to a job |
| Job Template / Canned Job | Preset service with pre-defined line items (labour + parts) |
| Delimiter Format | Bilingual storage: 'Thai text / English text' |
| PA | Personal Assistant — operational manager of the garage |
| DLT | Department of Land Transport (Thai vehicle registration) |
| LINE OA | LINE Official Account |
| RLS | Row Level Security (Supabase/Postgres) |
| DVI | Digital Vehicle Inspection (Phase 2) |
| EOD | End of Day (financial summary report) |
| ARO | Average Repair Order value |
| PDPA | Personal Data Protection Act (Thailand) |

---

# Appendix B: Cherry-Pick Patterns from Existing Codebase

| Pattern | Source File | Replicate |
|---------|-----------|-----------| 
| Supabase client setup | src/lib/supabase/*.ts | Browser/server/admin separation, middleware helper |
| LINE messaging | src/lib/line/client.ts, templates.ts | Push, Flex Message, rate limiting, demo mode |
| Messaging service | src/lib/messaging/service.ts | Consent check, message logging, unified send |
| Data queries | src/lib/data/queries.ts | React cache wrapper, demo fallback pattern |
| Zod validation | src/app/api/*/route.ts | Request validation, error format |
| Auth middleware | src/middleware.ts | Role detection, route protection, redirect |
| RLS helpers | migrations/003_rls_policies.sql | get_user_role(), is_owner_or_pa() |

---

# Appendix C: Competitive Intelligence Alignment

| Competitor Feature | BGOP Equivalent | Status |
|-------------------|-----------------|--------|
| RO/Work Order lifecycle | Job system with 5-bucket Kanban | Phase 1 |
| Kanban/WIP board (default screen) | /board as PA landing page | ✅ Complete |
| Canned jobs / preset templates | Job Templates with pre-populated items | Phase 1 — API built |
| Technician assignment | Mechanic assignment from Available Jobs | ✅ Complete |
| Estimate-to-invoice conversion | Single-table quote lifecycle | ✅ Complete |
| Electronic estimate delivery | "Send Quote" via LINE | ✅ Complete (LINE pending) |
| Customer digital authorization | LINE Flex Message approve/decline | Phase 1 |
| Customer database + vehicle history | Customers + Vehicles + full history | ✅ Complete |
| Two-way messaging | LINE two-way (via webhook) | ✅ Inbox UI complete |
| Communication log | message_log table + inbox UI | ✅ Complete |
| Automated service reminders | Edge function at 11-month trigger | Phase 1 G3 |
| Online booking widget | /request public intake form | Phase 1 E1-E4 |
| Parts inventory with pricing | Products table with cost/sale pricing | Phase 1 B1 |
| EOD financial report | /reports EOD summary | Phase 1 F6 |
| Real-time board sync | Supabase Realtime on jobs table | Phase 1 C11 |
| Activity feed per RO | JobTimeline from job_status_history | Phase 1 C4 |
| Photo-based intake | intake_photos with camera capture UI | Phase 1 C17 |
| DVI (Digital Vehicle Inspection) | Deferred to Phase 2 | Phase 2 |
| Appointment calendar | Deferred to Phase 2 | Phase 2 |
| Technician time clocking | Deferred to Phase 2 | Phase 2 |
| Integrated payment processing | Schema ready, not built | Phase 2-3 |
| QuickBooks sync | Deferred to Phase 3 | Phase 3 |
