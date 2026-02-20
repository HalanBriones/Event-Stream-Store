import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  eventType: text("event_type", { enum: eventTypes }).notNull(),
  userId: integer("user_id").notNull(),
  courseId: integer("course_id").notNull(),
  lessonId: integer("lesson_id"),
  quizId: integer("quiz_id"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertEventSchema = createInsertSchema(events).omit({ 
  id: true,
  timestamp: true // Let database handle default, or optional in input
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type StudentWithStats = {
  userId: number;
  enrolledCount: number;
};
