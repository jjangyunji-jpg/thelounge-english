# Memory: index.md
Updated: now

# Project Memory

## Core
Dark brown/black bg, gold accent, Playfair Display serif. Min 36px touch targets, 11px font.
Admin access STRICTLY restricted to reinainbiz@gmail.com.
Strict KST for all dates via `Date` object (NO UTC `slice(0, 10)` before 09:00 AM).
AI uses gemini-2.5-flash with Tool Calling/Function Calling for JSON.
Use `auth.getSession()` for cache/speed instead of `auth.getUser()`.
Edge functions: strip HTML/images, max 60,000 chars to prevent payload errors.
Use student_name as primary ID for sync; apply atomic updates on makeup slots.

## Memories
- [Theme Style](mem://style/theme) — Dark brown/black & gold, Playfair Display serif
- [Mobile UI Patterns](mem://style/mobile-ui-patterns) — Min 36px touch targets, 11px font, flex-col admin headers
- [Localization](mem://style/localization) — Strict KST rules for dates and accurate comparisons
- [Pricing Model](mem://business/pricing-model) — 50k individual, 70k group, corporate EOM settlement
- [Budget Management](mem://features/admin/budget-management) — 예산관리 탭: 현금/스토어 결제수단 플래그(학생+월별 오버라이드), 4.95% 수수료 차감 실수령 산출
- [Session Count Report](mem://features/admin/session-count-report) — 결제확인 탭 학생별 월별 수업 카운트 리포트
- [Settlement System](mem://features/settlement-system) — Ended_at based, no_show included, cancel logic, pay structures
- [MVP Constraints](mem://features/mvp-constraints) — Features removed from dashboard to header or dedicated spaces
- [Goal Management](mem://features/goal-management) — learning_objective vs topic, auto sync to lesson_goal, auto-save
- [Backup System](mem://features/backup-system) — Version history, PDF export preserving complex HTML and tables
- [Instructor Guide](mem://features/instructor-guide) — Guide PDF loaded via Supabase Storage public URL
- [Corporate Report Layout](mem://features/group-and-irregular-classes/report-layout) — PDF layout, AI summary editable, notes included
- [Curriculum Roadmap](mem://features/curriculum-roadmap) — AI fuzzy matching teaching materials to suggest next step
- [Admin Access Control](mem://auth/admin-access-control) — Strict login restriction to reinainbiz@gmail.com
- [Homework Reminders](mem://features/homework/reminders) — 48h after/before class alerts sent to student & instructor
- [Notes Archive](mem://features/classroom/notes-archive) — Past classes only, auto YouTube embeds, PDF export
- [Editor Logic](mem://features/classroom/editor-logic) — TipTap tables, transition guard against race conditions, 0.5s auto-save
- [Student Evaluations](mem://features/feedback/student-evaluations) — Sorting priority by remarks/score, dashboard popup
- [Instructor Feedback](mem://features/feedback/instructor-feedback) — Monthly rating & comment by instructor, internal only
- [Dashboard Operations](mem://features/dashboards/operations) — AI config with Tool Calling, clear loading states
- [Admin Dashboard Layout](mem://features/dashboards/admin) — Active metrics, schedule period, instructor cards
- [Data Continuity](mem://features/data-management/continuity) — Name sync across tables, preserve lessons on re-registration
- [Holidays Scheduling](mem://features/scheduling/holidays) — Greyed out in calendar, skipped during bulk session generation
- [Vocabulary Core Logic](mem://features/vocabulary/core-logic) — Visual + voice test, extract from current note, smart quote fix
- [Support Management](mem://features/support/management) — Bug tracking vs Administrative payment confirmations
- [Homework Drafts](mem://features/homework/draft-save) — 30s auto-save, draft status badge, submitted status
- [Homework Eval Criteria](mem://features/homework/evaluation-criteria) — CEFR rubric, strict naturalness scoring (C1-C2 for 9+)
- [Atomic Booking](mem://features/scheduling/atomic-booking) — RLS limited to open->booked state changes for safety
- [Bulk Session Generation](mem://features/scheduling/bulk-generation) — Unique index constraint, weekly cap, skip active pauses
- [Student Registration](mem://features/user-management/student-registration-fields) — Auto https:// prefix for google sheets, core setup fields
- [Homework Presets](mem://features/homework/preset-logic) — Template copy on entry, hide from sessions before created_at
- [Homework Review Edit](mem://features/homework/review-and-edit) — Minimal diff correction, friendly YouTube comment tone
- [Scheduling Logic](mem://features/scheduling/logic) — 6 cancel types, makeup linkage, session transfer, hidden logic
- [Makeup Period Boundary](mem://features/scheduling/makeup-period-boundary) — Reschedule/makeup must stay within original session's monthly schedule_period
- [Instructor Transitions](mem://features/user-management/instructor-transitions) — Scheduled transfer, read-only past notes, future gen sync
- [Access Control Dashboards](mem://features/dashboards/access-control) — View modes for managers/instructors, browser history routing
- [Student Dashboard System](mem://features/student-dashboard/system-and-ui) — Combine schedules on transfer, user_id to name fallback
- [Data Integrity](mem://features/data-management/integrity) — Note backup on delete, name sync as primary ID across DB
- [Group Classes Pricing](mem://features/group-and-irregular-classes/management-and-pricing) — Shared members, cross-verified relational queries
- [Message Management](mem://features/admin/message-management) — Scheduled notifications with collapsible UI and RLS
- [Monthly Instructor Reminder](mem://features/admin/monthly-instructor-reminder) — Auto-send 월말 message via pg_cron
- [Registration Logic](mem://auth/registration-logic) — Simple form, extract Supabase error for toast
- [Dialogue Generator](mem://features/classroom/dialogue-generator) — AI context-aware dialogue with Key Expressions HTML
- [Notification System](mem://features/dashboards/notification-system) — Inbox badge, login popup, read_by tracking sync
