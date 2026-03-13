import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Reference list of known event types — for documentation only.
// The column accepts ANY string so future event types are never rejected.
export const eventTypes = [
  "course_enrollment",
  "course_ended",
  "lesson_started",
  "lesson_finished",
  "quiz_started",
  "quiz_submitted",
  "quiz_attempts",
] as const;

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  // plain text — no enum constraint so new event types work without schema changes
  eventType: text("event_type").notNull(),
  userId: integer("user_id").notNull(),
  courseId: integer("course_id").notNull(),
  lessonId: integer("lesson_id"),
  quizId: integer("quiz_id"),
  metadata: jsonb("metadata"),
  // timestamp is optional on insert — DB defaults to now(), but callers may supply a historical value
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
}).extend({
  // allow an optional custom timestamp so historical events can be ingested correctly
  timestamp: z.coerce.date().optional(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Event type matchers
//
// All event-type string matching lives here. When the platform sends a new
// variant (e.g. "lesson_complete" instead of "lesson_finished"), add it to the
// relevant array below — no other file needs to change.
// ─────────────────────────────────────────────────────────────────────────────

// Course lifecycle
const COURSE_ENROLLMENT_TYPES = ["course_enrollment", "enrollment"];
const COURSE_END_TYPES        = ["course_ended", "course_completed", "course_end"];

// Lesson lifecycle
const LESSON_START_TYPES  = ["lesson_started", "lesson_start"];
const LESSON_FINISH_TYPES = ["lesson_finished", "lesson_complete", "lesson_end"];

// Quiz lifecycle
const QUIZ_START_TYPES  = ["quiz_started", "quiz_start"];
const QUIZ_SUBMIT_TYPES = ["quiz_submitted", "quiz_submit"];

export const isCourseEnrollment = (t: string): boolean => COURSE_ENROLLMENT_TYPES.includes(t);
export const isCourseEnd        = (t: string): boolean => COURSE_END_TYPES.includes(t);
export const isLessonStart      = (t: string): boolean => LESSON_START_TYPES.includes(t);
export const isLessonFinish     = (t: string): boolean => LESSON_FINISH_TYPES.includes(t);
export const isQuizStart        = (t: string): boolean => QUIZ_START_TYPES.includes(t);
export const isQuizSubmit       = (t: string): boolean => QUIZ_SUBMIT_TYPES.includes(t);

export type StudentWithStats = {
  userId: number;
  enrolledCount: number;
};
