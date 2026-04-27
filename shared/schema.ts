/**
 * shared/schema.ts
 *
 * Single source of truth for:
 *   - The database table definition (used by Drizzle ORM)
 *   - TypeScript types derived from the table
 *   - Zod validation schema used when inserting new events
 *   - Event-type matching helpers used by both the frontend and backend
 *
 * IMPORTANT: All event-type string comparisons must go through the helper
 * functions at the bottom of this file (e.g. isLessonStart, isQuizSubmit).
 * Never hard-code event-type strings anywhere else in the codebase.
 */

import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Known event types (documentation only — not enforced at the DB level)
//
// The eventType column is plain TEXT so future variants are accepted without
// requiring a schema migration. Add new strings to the matcher arrays below
// when the upstream platform introduces them.
// ---------------------------------------------------------------------------
export const eventTypes = [
  "course_enrollment",  // student joins a course
  "course_ended",       // student finishes a course
  "lesson_started",     // student opens a lesson
  "lesson_finished",    // student completes a lesson
  "quiz_started",       // student opens a quiz
  "quiz_submitted",     // student submits quiz answers
  "quiz_attempts",      // (informational) number of attempts recorded
] as const;

// ---------------------------------------------------------------------------
// Database table: events
//
// Every learning interaction that reaches the API is stored as a single row
// here. The combination of userId + courseId + lessonId + quizId lets us
// reconstruct a full learning timeline per student.
// ---------------------------------------------------------------------------
export const events = pgTable("events", {
  id:        serial("id").primaryKey(),
  // Plain text — no enum constraint so new event types never cause an error
  eventType: text("event_type").notNull(),
  userId:    integer("user_id").notNull(),
  courseId:  integer("course_id").notNull(),
  // lessonId and quizId are optional; course-level events don't need them
  lessonId:  integer("lesson_id"),
  quizId:    integer("quiz_id"),
  // Arbitrary extra data the upstream platform may send (stored as JSON)
  metadata:  jsonb("metadata"),
  // DB defaults to the current time if the caller doesn't supply a timestamp.
  // Historical events (e.g. backfilled data) can supply their own timestamp.
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Zod insert schema
//
// Used to validate the request body of POST /api/events before writing to
// the database. The `id` is excluded because it is auto-generated.
// The `timestamp` field is made optional so callers can omit it and let the
// DB default to "now", or supply a historical value.
// ---------------------------------------------------------------------------
export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
}).extend({
  timestamp: z.coerce.date().optional(),
});

// Convenience TypeScript types derived from the schema
export type Event       = typeof events.$inferSelect; // shape of a row read from the DB
export type InsertEvent = z.infer<typeof insertEventSchema>; // shape of a valid insert payload

// ---------------------------------------------------------------------------
// Event-type matcher helpers
//
// The platform sometimes sends different strings for the same logical action
// (e.g. "lesson_finished" vs "lesson_complete"). All supported variants are
// listed in the arrays below.
//
// To add a new variant: add the string to the relevant array — no other file
// needs to change.
// ---------------------------------------------------------------------------

// Course lifecycle
const COURSE_ENROLLMENT_TYPES = ["course_enrollment", "enrollment"];
const COURSE_END_TYPES        = ["course_ended", "course_completed", "course_end"];

// Lesson lifecycle
const LESSON_START_TYPES  = ["lesson_started", "lesson_start"];
const LESSON_FINISH_TYPES = ["lesson_finished", "lesson_complete", "lesson_end"];

// Quiz lifecycle
const QUIZ_START_TYPES  = ["quiz_started", "quiz_start"];
const QUIZ_SUBMIT_TYPES = ["quiz_submitted", "quiz_submit"];

/** Returns true when the event string represents a course enrollment. */
export const isCourseEnrollment = (t: string): boolean => COURSE_ENROLLMENT_TYPES.includes(t);

/** Returns true when the event string represents a course completion. */
export const isCourseEnd        = (t: string): boolean => COURSE_END_TYPES.includes(t);

/** Returns true when the event string represents a lesson being started. */
export const isLessonStart      = (t: string): boolean => LESSON_START_TYPES.includes(t);

/** Returns true when the event string represents a lesson being finished. */
export const isLessonFinish     = (t: string): boolean => LESSON_FINISH_TYPES.includes(t);

/** Returns true when the event string represents a quiz being opened. */
export const isQuizStart        = (t: string): boolean => QUIZ_START_TYPES.includes(t);

/** Returns true when the event string represents a quiz being submitted. */
export const isQuizSubmit       = (t: string): boolean => QUIZ_SUBMIT_TYPES.includes(t);

// Legacy type kept for backward compatibility with older parts of the codebase
export type StudentWithStats = {
  userId: number;
  enrolledCount: number;
};
