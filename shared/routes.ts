/**
 * shared/routes.ts
 *
 * Central registry of every API route used by the application.
 *
 * Keeping routes in one shared file means:
 *   - The frontend and backend always reference the same path strings
 *   - Response shapes are documented with Zod schemas in one place
 *   - Adding a new route only requires one file change
 *
 * Usage:
 *   import { api } from "@shared/routes";
 *   fetch(api.events.courses.path)         // frontend
 *   app.get(api.events.courses.path, ...)  // backend (Express)
 */

import { z } from 'zod';
import { insertEventSchema, events } from './schema';

// ---------------------------------------------------------------------------
// Shared error schemas — used to type error responses from the API
// ---------------------------------------------------------------------------
export const errorSchemas = {
  /** 400 — the request body failed Zod validation */
  validation: z.object({
    message: z.string(),
    field: z.string().optional(), // which field caused the error
  }),
  /** 500 — unexpected server-side failure */
  internal: z.object({
    message: z.string(),
  }),
};

// ---------------------------------------------------------------------------
// API route definitions
//
// Each entry describes the HTTP method, URL path, and expected response shape.
// ---------------------------------------------------------------------------
export const api = {
  events: {
    /** POST /api/events — ingest a single learning event */
    create: {
      method: 'POST' as const,
      path: '/api/events' as const,
      input: insertEventSchema,
      responses: {
        201: z.custom<typeof events.$inferSelect>(), // the created row
        400: errorSchemas.validation,
      },
    },

    /** GET /api/events — return every event in the database (ordered by timestamp) */
    list: {
      method: 'GET' as const,
      path: '/api/events' as const,
      responses: {
        200: z.array(z.custom<typeof events.$inferSelect>()),
      },
    },

    /**
     * GET /api/students
     * Returns one row per unique student with their enrollment and completion counts.
     * Used by the dashboard's student table.
     */
    students: {
      method: 'GET' as const,
      path: '/api/students' as const,
      responses: {
        200: z.array(z.object({
          userId: z.number(),
          enrolledCount: z.number(),  // how many courses they enrolled in
          completedCount: z.number(), // how many of those they finished
        })),
      },
    },

    /**
     * GET /api/students/:id/stats
     * Full learning breakdown for a single student: every course, lesson, and
     * quiz — including timing data and pace signals.
     * Used by the Student Details page.
     */
    studentStats: {
      method: 'GET' as const,
      path: '/api/students/:id/stats' as const,
      responses: {
        200: z.object({
          enrolledCourses: z.number(),
          completedCourses: z.number(),
          courses: z.array(z.any()), // detailed per-course objects (see storage.ts)
        }),
      },
    },

    /**
     * GET /api/courses
     * High-level summary of every course in the system.
     * Used by the Courses list page.
     */
    courses: {
      method: 'GET' as const,
      path: '/api/courses' as const,
      responses: {
        200: z.array(z.object({
          courseId: z.number(),
          totalEnrolled: z.number(),  // students who enrolled
          totalCompleted: z.number(), // students who finished
          completionRate: z.number(), // percentage (0–100)
          totalLessons: z.number(),   // distinct lesson IDs seen
          lastActivityAt: z.string().optional(), // ISO timestamp of the most recent event
        })),
      },
    },

    /**
     * GET /api/courses/:id/stats
     * Deep analytics for a single course: per-lesson completion rates, per-quiz
     * submission rates, and a per-student pace classification.
     * Used by the Course Details page.
     */
    courseStats: {
      method: 'GET' as const,
      path: '/api/courses/:id/stats' as const,
      responses: {
        200: z.any(), // detailed shape documented in storage.getCourseStats()
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Helper — replaces :param placeholders in a path string with real values
//
// Example:
//   buildUrl('/api/students/:id/stats', { id: 42 })
//   => '/api/students/42/stats'
// ---------------------------------------------------------------------------
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// Convenience type aliases for common request/response shapes
export type CreateEventInput    = z.infer<typeof api.events.create.input>;
export type EventResponse       = z.infer<typeof api.events.create.responses[201]>;
export type EventsListResponse  = z.infer<typeof api.events.list.responses[200]>;
