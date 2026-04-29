# LearnTracker — Student Progress Analytics

## Overview
A full-stack analytics platform for tracking student learning activity across courses, lessons, and quizzes. Educators can monitor enrollment, completion rates, lesson durations, and student pace (Rushing / Normal / Struggling, etc.).

## Architecture

### Stack
- **Backend**: Node.js + Express + Drizzle ORM (PostgreSQL)
- **Frontend**: React + Vite + TanStack Query + shadcn/ui + Tailwind CSS
- **Database**: PostgreSQL (single `events` table)

### Key Design Decisions
- **Single events table**: All learning interactions (enrollment, lesson start/finish, quiz start/submit, course completion) are stored as rows in one `events` table with `event_type`, `user_id`, `course_id`, `lesson_id`, `quiz_id`, `timestamp`, and `metadata` columns.
- **SQL-first aggregation**: All statistics shown in the UI (enrolled counts, completion rates, lesson durations, quiz timing, pace classification) are computed entirely by PostgreSQL using CTEs and aggregate functions inside `server/storage.ts`. No raw event arrays are loaded into JavaScript memory for processing.
- **Event-type flexibility**: Event type strings are compared via helper functions in `shared/schema.ts` (e.g. `isCourseEnrollment`, `isLessonFinish`) that support multiple string variants per action.
- **Pace classification**: Course pace (Rushing / Light Engagement / Normal / Slow / Struggling) is configured in `shared/paceConfig.ts` using threshold tiers. The SQL layer computes duration; the JS layer calls `classifyPace()` for the label.

### Completion Logic (expressed in SQL)
A student is considered to have completed a course if:
1. An explicit `course_ended`/`course_completed`/`course_end` event exists, **OR**
2. Every distinct `lesson_id` in the course has at least one `lesson_finished`/`lesson_complete`/`lesson_end` OR `quiz_submitted`/`quiz_submit` event.

This logic is expressed as a CTE in each relevant SQL query (no JS loops).

## File Structure

```
shared/
  schema.ts       — Drizzle table definition, Zod insert schema, event-type helpers
  paceConfig.ts   — Pace tier thresholds and classifyPace() function
  routes.ts       — Shared API route paths and Zod response shapes

server/
  db.ts           — Drizzle + pg Pool setup
  storage.ts      — All DB queries (SQL CTEs for aggregation)
  routes.ts       — Thin Express route handlers (validate → call storage)
  index.ts        — Server entry point

client/src/
  App.tsx         — Wouter routes
  pages/
    home.tsx            — Landing / event ingestion form
    dashboard.tsx       — Student directory overview
    student-details.tsx — Per-student course/lesson timeline
    courses.tsx         — Course list with stats
    course-details.tsx  — Per-course lesson and student breakdown
```

## Running
`npm run dev` starts both the Express backend and Vite dev server on port 5000.
