/**
 * server/storage.ts
 *
 * Data access layer — the only file that talks directly to the database.
 *
 * All aggregation and business logic is expressed as SQL queries that run
 * inside PostgreSQL. No raw-event arrays are loaded into JavaScript memory
 * for processing; every stat is computed by the database engine directly.
 */

import {
  events,
  type InsertEvent,
  type Event,
} from "@shared/schema";
import { classifyPace } from "@shared/paceConfig";
import { db } from "./db";
import { sql, eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Constants — event-type strings that match the helper functions in schema.ts
// ---------------------------------------------------------------------------
const ENROLLMENT_TYPES  = `('course_enrollment', 'enrollment')`;
const COURSE_END_TYPES  = `('course_ended', 'course_completed', 'course_end')`;
const LESSON_START_TYPES  = `('lesson_started', 'lesson_start')`;
const LESSON_FINISH_TYPES = `('lesson_finished', 'lesson_complete', 'lesson_end')`;
const QUIZ_START_TYPES  = `('quiz_started', 'quiz_start')`;
const QUIZ_SUBMIT_TYPES = `('quiz_submitted', 'quiz_submit')`;

// ---------------------------------------------------------------------------
// Storage interface
// ---------------------------------------------------------------------------
export interface IStorage {
  createEvent(event: InsertEvent): Promise<Event>;
  getEvents(): Promise<Event[]>;
  getStudentsWithStats(): Promise<{ userId: number; enrolledCount: number; completedCount: number }[]>;
  getStudentStats(userId: number): Promise<any>;
  getCourses(): Promise<any[]>;
  getCourseStats(courseId: number): Promise<any>;
  clearAllEvents(): Promise<void>;
}

// ---------------------------------------------------------------------------
// DatabaseStorage — all stats are computed by PostgreSQL queries
// ---------------------------------------------------------------------------
export class DatabaseStorage implements IStorage {

  // ── createEvent ──────────────────────────────────────────────────────────
  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    return event;
  }

  // ── getEvents ────────────────────────────────────────────────────────────
  async getEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(events.timestamp);
  }

  // ── getStudentsWithStats ─────────────────────────────────────────────────
  /**
   * SQL query overview:
   *   enrollment_events  — distinct (user_id, course_id) pairs from enrollment events
   *   explicit_completions — pairs where a course_ended-type event exists
   *   lesson_counts      — total distinct lessons attempted per (user, course)
   *   finished_lesson_counts — lessons that have a finish OR quiz-submit event
   *   inferred_completions — pairs where all lessons are finished (no explicit end event needed)
   *   all_completions    — union of explicit and inferred
   *   Final SELECT counts enrolled and completed per user.
   */
  async getStudentsWithStats(): Promise<{ userId: number; enrolledCount: number; completedCount: number }[]> {
    const result = await db.execute(sql.raw(`
      WITH enrollment_events AS (
        SELECT DISTINCT user_id, course_id
        FROM events
        WHERE event_type IN ${ENROLLMENT_TYPES}
      ),
      explicit_completions AS (
        SELECT DISTINCT user_id, course_id
        FROM events
        WHERE event_type IN ${COURSE_END_TYPES}
      ),
      lesson_counts AS (
        SELECT user_id, course_id, COUNT(DISTINCT lesson_id) AS total_lessons
        FROM events
        WHERE lesson_id IS NOT NULL
        GROUP BY user_id, course_id
      ),
      finished_lesson_counts AS (
        SELECT user_id, course_id, COUNT(DISTINCT lesson_id) AS finished_lessons
        FROM events
        WHERE lesson_id IS NOT NULL
          AND event_type IN ${LESSON_FINISH_TYPES.slice(0, -1)}, ${QUIZ_SUBMIT_TYPES.slice(1)}
        GROUP BY user_id, course_id
      ),
      inferred_completions AS (
        SELECT lc.user_id, lc.course_id
        FROM lesson_counts lc
        JOIN finished_lesson_counts fl
          ON lc.user_id = fl.user_id AND lc.course_id = fl.course_id
        WHERE lc.total_lessons > 0 AND lc.total_lessons = fl.finished_lessons
      ),
      all_completions AS (
        SELECT user_id, course_id FROM explicit_completions
        UNION
        SELECT user_id, course_id FROM inferred_completions
      )
      SELECT
        e.user_id,
        COUNT(DISTINCT e.course_id)::int AS enrolled_count,
        COUNT(DISTINCT c.course_id)::int AS completed_count
      FROM enrollment_events e
      LEFT JOIN all_completions c ON e.user_id = c.user_id AND e.course_id = c.course_id
      GROUP BY e.user_id
      ORDER BY e.user_id
    `));

    return (result.rows as any[]).map(r => ({
      userId:         Number(r.user_id),
      enrolledCount:  Number(r.enrolled_count),
      completedCount: Number(r.completed_count),
    }));
  }

  // ── getStudentStats ──────────────────────────────────────────────────────
  /**
   * Returns a complete learning timeline for a single student using SQL for
   * all aggregation. Separate queries are issued for:
   *   1. Enrolled courses (with enrollment + completion timestamps)
   *   2. Lesson pairs (start/finish times, active days, inferred completion)
   *   3. Quiz pairs (start/submit times, attempts from metadata)
   */
  async getStudentStats(userId: number) {

    // ── 1. Courses this student enrolled in ─────────────────────────────
    const coursesResult = await db.execute(sql.raw(`
      WITH enrollment_events AS (
        SELECT DISTINCT user_id, course_id
        FROM events
        WHERE event_type IN ${ENROLLMENT_TYPES}
          AND user_id = ${userId}
      ),
      explicit_completions AS (
        SELECT DISTINCT user_id, course_id
        FROM events
        WHERE event_type IN ${COURSE_END_TYPES}
          AND user_id = ${userId}
      ),
      lesson_counts AS (
        SELECT user_id, course_id, COUNT(DISTINCT lesson_id) AS total_lessons
        FROM events
        WHERE lesson_id IS NOT NULL AND user_id = ${userId}
        GROUP BY user_id, course_id
      ),
      finished_lesson_counts AS (
        SELECT user_id, course_id, COUNT(DISTINCT lesson_id) AS finished_lessons
        FROM events
        WHERE lesson_id IS NOT NULL
          AND event_type IN ${LESSON_FINISH_TYPES.slice(0, -1)}, ${QUIZ_SUBMIT_TYPES.slice(1)}
          AND user_id = ${userId}
        GROUP BY user_id, course_id
      ),
      inferred_completions AS (
        SELECT lc.user_id, lc.course_id
        FROM lesson_counts lc
        JOIN finished_lesson_counts fl
          ON lc.user_id = fl.user_id AND lc.course_id = fl.course_id
        WHERE lc.total_lessons > 0 AND lc.total_lessons = fl.finished_lessons
      ),
      all_completions AS (
        SELECT user_id, course_id FROM explicit_completions
        UNION
        SELECT user_id, course_id FROM inferred_completions
      ),
      enrollment_time AS (
        SELECT DISTINCT ON (user_id, course_id) user_id, course_id, timestamp AS enrolled_at
        FROM events
        WHERE event_type IN ${ENROLLMENT_TYPES} AND user_id = ${userId}
        ORDER BY user_id, course_id, timestamp
      ),
      completion_time AS (
        SELECT DISTINCT ON (user_id, course_id) user_id, course_id, timestamp AS completed_at
        FROM events
        WHERE event_type IN ${COURSE_END_TYPES} AND user_id = ${userId}
        ORDER BY user_id, course_id, timestamp
      ),
      last_lesson_finish AS (
        SELECT user_id, course_id, MAX(timestamp) AS last_finish
        FROM events
        WHERE lesson_id IS NOT NULL
          AND event_type IN ${LESSON_FINISH_TYPES.slice(0, -1)}, ${QUIZ_SUBMIT_TYPES.slice(1)}
          AND user_id = ${userId}
        GROUP BY user_id, course_id
      ),
      active_days AS (
        SELECT user_id, course_id, COUNT(DISTINCT DATE(timestamp)) AS active_days
        FROM events
        WHERE user_id = ${userId}
        GROUP BY user_id, course_id
      ),
      first_lesson_start AS (
        SELECT user_id, course_id, MIN(timestamp) AS first_lesson_at
        FROM events
        WHERE event_type IN ${LESSON_START_TYPES} AND user_id = ${userId}
        GROUP BY user_id, course_id
      )
      SELECT
        ee.course_id,
        et.enrolled_at,
        COALESCE(ct.completed_at, llf.last_finish) AS course_end_at,
        (EXTRACT(EPOCH FROM (COALESCE(ct.completed_at, llf.last_finish) - et.enrolled_at)) / 60)::int AS duration_minutes,
        CASE WHEN ac.course_id IS NOT NULL THEN true ELSE false END AS is_completed,
        ad.active_days::int,
        (EXTRACT(EPOCH FROM (fls.first_lesson_at - et.enrolled_at)) / 60)::int AS gap_enrollment_to_first_lesson_minutes
      FROM enrollment_events ee
      JOIN enrollment_time et ON et.user_id = ee.user_id AND et.course_id = ee.course_id
      LEFT JOIN all_completions ac ON ac.user_id = ee.user_id AND ac.course_id = ee.course_id
      LEFT JOIN completion_time ct ON ct.user_id = ee.user_id AND ct.course_id = ee.course_id
      LEFT JOIN last_lesson_finish llf ON llf.user_id = ee.user_id AND llf.course_id = ee.course_id
      LEFT JOIN active_days ad ON ad.user_id = ee.user_id AND ad.course_id = ee.course_id
      LEFT JOIN first_lesson_start fls ON fls.user_id = ee.user_id AND fls.course_id = ee.course_id
      ORDER BY ee.course_id
    `));

    const courseRows = coursesResult.rows as any[];

    // ── 2. All lessons for this student across all courses ───────────────
    const lessonsResult = await db.execute(sql.raw(`
      WITH lesson_starts AS (
        SELECT DISTINCT ON (course_id, lesson_id)
          course_id, lesson_id, timestamp AS started_at
        FROM events
        WHERE event_type IN ${LESSON_START_TYPES}
          AND user_id = ${userId}
          AND lesson_id IS NOT NULL
        ORDER BY course_id, lesson_id, timestamp
      ),
      lesson_finishes AS (
        SELECT DISTINCT ON (course_id, lesson_id)
          course_id, lesson_id, timestamp AS finished_at
        FROM events
        WHERE event_type IN ${LESSON_FINISH_TYPES}
          AND user_id = ${userId}
          AND lesson_id IS NOT NULL
        ORDER BY course_id, lesson_id, timestamp
      ),
      quiz_last_submit AS (
        SELECT course_id, lesson_id, MAX(timestamp) AS last_submit_at
        FROM events
        WHERE event_type IN ${QUIZ_SUBMIT_TYPES}
          AND user_id = ${userId}
          AND lesson_id IS NOT NULL
        GROUP BY course_id, lesson_id
      ),
      quiz_submitted_lessons AS (
        SELECT DISTINCT course_id, lesson_id
        FROM events
        WHERE event_type IN ${QUIZ_SUBMIT_TYPES}
          AND user_id = ${userId}
          AND lesson_id IS NOT NULL
      )
      SELECT
        ls.course_id,
        ls.lesson_id,
        ls.started_at,
        COALESCE(lf.finished_at, qls.last_submit_at) AS finished_at,
        CASE WHEN lf.lesson_id IS NOT NULL OR qsl.lesson_id IS NOT NULL THEN true ELSE false END AS is_finished,
        CASE
          WHEN ls.started_at IS NOT NULL AND COALESCE(lf.finished_at, qls.last_submit_at) IS NOT NULL
          THEN GREATEST(0, (EXTRACT(EPOCH FROM (COALESCE(lf.finished_at, qls.last_submit_at) - ls.started_at)) / 60))::int
          ELSE NULL
        END AS lesson_duration_minutes,
        CASE
          WHEN ls.started_at IS NOT NULL AND COALESCE(lf.finished_at, qls.last_submit_at) IS NOT NULL
          THEN GREATEST(0, DATE(COALESCE(lf.finished_at, qls.last_submit_at)) - DATE(ls.started_at))
          ELSE NULL
        END AS duration_days
      FROM lesson_starts ls
      LEFT JOIN lesson_finishes lf ON lf.course_id = ls.course_id AND lf.lesson_id = ls.lesson_id
      LEFT JOIN quiz_last_submit qls ON qls.course_id = ls.course_id AND qls.lesson_id = ls.lesson_id
      LEFT JOIN quiz_submitted_lessons qsl ON qsl.course_id = ls.course_id AND qsl.lesson_id = ls.lesson_id
      ORDER BY ls.course_id, ls.started_at
    `));

    const lessonRows = lessonsResult.rows as any[];

    // ── 3. All quizzes for this student across all courses/lessons ────────
    const quizzesResult = await db.execute(sql.raw(`
      WITH quiz_starts AS (
        SELECT DISTINCT ON (course_id, lesson_id, quiz_id)
          course_id, lesson_id, quiz_id, timestamp AS started_at
        FROM events
        WHERE event_type IN ${QUIZ_START_TYPES}
          AND user_id = ${userId}
          AND quiz_id IS NOT NULL
        ORDER BY course_id, lesson_id, quiz_id, timestamp
      ),
      quiz_submits AS (
        SELECT DISTINCT ON (course_id, lesson_id, quiz_id)
          course_id, lesson_id, quiz_id, timestamp AS submitted_at,
          metadata
        FROM events
        WHERE event_type IN ${QUIZ_SUBMIT_TYPES}
          AND user_id = ${userId}
          AND quiz_id IS NOT NULL
        ORDER BY course_id, lesson_id, quiz_id, timestamp
      ),
      lesson_start_times AS (
        SELECT DISTINCT ON (course_id, lesson_id)
          course_id, lesson_id, timestamp AS lesson_started_at
        FROM events
        WHERE event_type IN ${LESSON_START_TYPES}
          AND user_id = ${userId}
        ORDER BY course_id, lesson_id, timestamp
      )
      SELECT
        qs.course_id,
        qs.lesson_id,
        qs.quiz_id,
        qs.started_at,
        qsub.submitted_at,
        CASE WHEN qsub.quiz_id IS NOT NULL THEN true ELSE false END AS is_submitted,
        CASE
          WHEN qs.started_at IS NOT NULL AND qsub.submitted_at IS NOT NULL
          THEN GREATEST(0, (EXTRACT(EPOCH FROM (qsub.submitted_at - qs.started_at)) / 60))::int
          ELSE NULL
        END AS duration_minutes,
        CASE
          WHEN lst.lesson_started_at IS NOT NULL AND qs.started_at IS NOT NULL
          THEN (EXTRACT(EPOCH FROM (qs.started_at - lst.lesson_started_at)) / 60)::int
          ELSE NULL
        END AS gap_from_lesson_start_minutes,
        qsub.metadata
      FROM quiz_starts qs
      LEFT JOIN quiz_submits qsub ON qsub.course_id = qs.course_id AND qsub.lesson_id IS NOT DISTINCT FROM qs.lesson_id AND qsub.quiz_id = qs.quiz_id
      LEFT JOIN lesson_start_times lst ON lst.course_id = qs.course_id AND lst.lesson_id IS NOT DISTINCT FROM qs.lesson_id
      ORDER BY qs.course_id, qs.lesson_id, qs.quiz_id
    `));

    const quizRows = quizzesResult.rows as any[];

    // ── 4. Orphan quizzes (no lesson_id) ─────────────────────────────────
    const orphanQuizzesResult = await db.execute(sql.raw(`
      WITH orphan_quiz_submits AS (
        SELECT DISTINCT ON (course_id, quiz_id)
          course_id, quiz_id, timestamp AS submitted_at
        FROM events
        WHERE event_type IN ${QUIZ_SUBMIT_TYPES}
          AND user_id = ${userId}
          AND lesson_id IS NULL
          AND quiz_id IS NOT NULL
        ORDER BY course_id, quiz_id, timestamp
      ),
      orphan_quiz_ids AS (
        SELECT DISTINCT course_id, quiz_id
        FROM events
        WHERE quiz_id IS NOT NULL AND lesson_id IS NULL AND user_id = ${userId}
      )
      SELECT
        oq.course_id,
        oq.quiz_id,
        CASE WHEN oqs.quiz_id IS NOT NULL THEN true ELSE false END AS is_submitted,
        oqs.submitted_at
      FROM orphan_quiz_ids oq
      LEFT JOIN orphan_quiz_submits oqs ON oqs.course_id = oq.course_id AND oqs.quiz_id = oq.quiz_id
      ORDER BY oq.course_id, oq.quiz_id
    `));

    const orphanQuizRows = orphanQuizzesResult.rows as any[];

    // ── 5. Assemble the response object ──────────────────────────────────
    const courses = courseRows.map(cr => {
      const courseId = Number(cr.course_id);

      const courseLessons = lessonRows
        .filter(l => Number(l.course_id) === courseId)
        .map(l => {
          const lessonId = Number(l.lesson_id);
          const lessonQuizzes = quizRows
            .filter(q => Number(q.course_id) === courseId && q.lesson_id !== null && Number(q.lesson_id) === lessonId)
            .map(q => {
              // Parse attempts from metadata — prefer the submitted event's metadata
              const meta = q.metadata;
              const rawAttempts = meta?.attempts;
              const attempts = rawAttempts !== undefined && rawAttempts !== null && !isNaN(Number(rawAttempts))
                ? Number(rawAttempts)
                : null;
              return {
                quizId:                   Number(q.quiz_id),
                isSubmitted:              q.is_submitted === true || q.is_submitted === 'true',
                submittedAt:              q.submitted_at ? new Date(q.submitted_at).toISOString() : undefined,
                startedAt:                q.started_at ? new Date(q.started_at).toISOString() : undefined,
                durationMinutes:          q.duration_minutes !== null ? Number(q.duration_minutes) : undefined,
                gapFromLessonStartMinutes: q.gap_from_lesson_start_minutes !== null ? Number(q.gap_from_lesson_start_minutes) : undefined,
                attempts,
              };
            });

          return {
            lessonId,
            isFinished:           l.is_finished === true || l.is_finished === 'true',
            startedAt:            l.started_at ? new Date(l.started_at).toISOString() : undefined,
            finishedAt:           l.finished_at ? new Date(l.finished_at).toISOString() : undefined,
            durationDays:         l.duration_days !== null ? Number(l.duration_days) : undefined,
            lessonDurationMinutes: l.lesson_duration_minutes !== null ? Number(l.lesson_duration_minutes) : undefined,
            quizzes:              lessonQuizzes,
          };
        });

      const orphanQuizzes = orphanQuizRows
        .filter(q => Number(q.course_id) === courseId)
        .map(q => ({
          quizId:      Number(q.quiz_id),
          isSubmitted: q.is_submitted === true || q.is_submitted === 'true',
          submittedAt: q.submitted_at ? new Date(q.submitted_at).toISOString() : undefined,
        }));

      return {
        courseId,
        isCompleted:                       cr.is_completed === true || cr.is_completed === 'true',
        enrolledAt:                        cr.enrolled_at ? new Date(cr.enrolled_at).toISOString() : undefined,
        durationMinutes:                   cr.duration_minutes !== null ? Number(cr.duration_minutes) : undefined,
        gapEnrollmentToFirstLessonMinutes: cr.gap_enrollment_to_first_lesson_minutes !== null
          ? Number(cr.gap_enrollment_to_first_lesson_minutes)
          : undefined,
        activeDays:                        cr.active_days !== null ? Number(cr.active_days) : 0,
        lessons:                           courseLessons,
        quizzes:                           orphanQuizzes,
      };
    });

    return {
      enrolledCourses:  courses.length,
      completedCourses: courses.filter(c => c.isCompleted).length,
      courses,
    };
  }

  // ── getCourses ───────────────────────────────────────────────────────────
  /**
   * SQL query overview:
   *   enrolled_users     — distinct students per course from enrollment events
   *   explicit_completions — students with explicit course_ended events
   *   inferred_completions — students whose every lesson has a finish/quiz-submit
   *   all_completions    — union of the above two
   *   Final SELECT aggregates counts and computes completion rate per course.
   */
  async getCourses(): Promise<any[]> {
    const result = await db.execute(sql.raw(`
      WITH enrolled_users AS (
        SELECT DISTINCT user_id, course_id
        FROM events
        WHERE event_type IN ${ENROLLMENT_TYPES}
      ),
      explicit_completions AS (
        SELECT DISTINCT user_id, course_id
        FROM events
        WHERE event_type IN ${COURSE_END_TYPES}
      ),
      lesson_counts AS (
        SELECT user_id, course_id, COUNT(DISTINCT lesson_id) AS total_lessons
        FROM events
        WHERE lesson_id IS NOT NULL
        GROUP BY user_id, course_id
      ),
      finished_lesson_counts AS (
        SELECT user_id, course_id, COUNT(DISTINCT lesson_id) AS finished_lessons
        FROM events
        WHERE lesson_id IS NOT NULL
          AND event_type IN ${LESSON_FINISH_TYPES.slice(0, -1)}, ${QUIZ_SUBMIT_TYPES.slice(1)}
        GROUP BY user_id, course_id
      ),
      inferred_completions AS (
        SELECT lc.user_id, lc.course_id
        FROM lesson_counts lc
        JOIN finished_lesson_counts fl
          ON lc.user_id = fl.user_id AND lc.course_id = fl.course_id
        WHERE lc.total_lessons > 0 AND lc.total_lessons = fl.finished_lessons
      ),
      all_completions AS (
        SELECT user_id, course_id FROM explicit_completions
        UNION
        SELECT user_id, course_id FROM inferred_completions
      ),
      course_lesson_counts AS (
        SELECT course_id, COUNT(DISTINCT lesson_id) AS total_lessons
        FROM events
        WHERE lesson_id IS NOT NULL
        GROUP BY course_id
      ),
      course_last_activity AS (
        SELECT course_id, MAX(timestamp) AS last_activity_at
        FROM events
        GROUP BY course_id
      )
      SELECT
        eu.course_id,
        COUNT(DISTINCT eu.user_id)::int AS total_enrolled,
        COUNT(DISTINCT ac.user_id)::int AS total_completed,
        CASE
          WHEN COUNT(DISTINCT eu.user_id) > 0
          THEN ROUND((COUNT(DISTINCT ac.user_id)::numeric / COUNT(DISTINCT eu.user_id)) * 100)::int
          ELSE 0
        END AS completion_rate,
        COALESCE(clc.total_lessons, 0)::int AS total_lessons,
        cla.last_activity_at
      FROM enrolled_users eu
      LEFT JOIN all_completions ac ON ac.user_id = eu.user_id AND ac.course_id = eu.course_id
      LEFT JOIN course_lesson_counts clc ON clc.course_id = eu.course_id
      LEFT JOIN course_last_activity cla ON cla.course_id = eu.course_id
      GROUP BY eu.course_id, clc.total_lessons, cla.last_activity_at
      ORDER BY eu.course_id
    `));

    return (result.rows as any[]).map(r => ({
      courseId:       Number(r.course_id),
      totalEnrolled:  Number(r.total_enrolled),
      totalCompleted: Number(r.total_completed),
      completionRate: Number(r.completion_rate),
      totalLessons:   Number(r.total_lessons),
      lastActivityAt: r.last_activity_at ? new Date(r.last_activity_at).toISOString() : undefined,
    }));
  }

  // ── getCourseStats ───────────────────────────────────────────────────────
  /**
   * SQL queries for a single course:
   *   1. Enrollment/completion summary (total counts, avg duration)
   *   2. Per-lesson aggregates (started/finished counts, avg duration)
   *   3. Per-quiz aggregates within each lesson
   *   4. Per-student completion status and duration (for pace classification)
   */
  async getCourseStats(courseId: number): Promise<any> {

    // ── 1. Course-level totals ─────────────────────────────────────────
    const summaryResult = await db.execute(sql.raw(`
      WITH enrolled_users AS (
        SELECT DISTINCT user_id
        FROM events
        WHERE event_type IN ${ENROLLMENT_TYPES} AND course_id = ${courseId}
      ),
      explicit_completions AS (
        SELECT DISTINCT user_id
        FROM events
        WHERE event_type IN ${COURSE_END_TYPES} AND course_id = ${courseId}
      ),
      lesson_counts AS (
        SELECT user_id, COUNT(DISTINCT lesson_id) AS total_lessons
        FROM events
        WHERE lesson_id IS NOT NULL AND course_id = ${courseId}
        GROUP BY user_id
      ),
      finished_lesson_counts AS (
        SELECT user_id, COUNT(DISTINCT lesson_id) AS finished_lessons
        FROM events
        WHERE lesson_id IS NOT NULL AND course_id = ${courseId}
          AND event_type IN ${LESSON_FINISH_TYPES.slice(0, -1)}, ${QUIZ_SUBMIT_TYPES.slice(1)}
        GROUP BY user_id
      ),
      inferred_completions AS (
        SELECT lc.user_id
        FROM lesson_counts lc
        JOIN finished_lesson_counts fl ON lc.user_id = fl.user_id
        WHERE lc.total_lessons > 0 AND lc.total_lessons = fl.finished_lessons
      ),
      all_completions AS (
        SELECT user_id FROM explicit_completions
        UNION
        SELECT user_id FROM inferred_completions
      ),
      enrollment_times AS (
        SELECT DISTINCT ON (user_id)
          user_id, timestamp AS enrolled_at
        FROM events
        WHERE event_type IN ${ENROLLMENT_TYPES} AND course_id = ${courseId}
        ORDER BY user_id, timestamp
      ),
      completion_times AS (
        SELECT DISTINCT ON (user_id)
          user_id, timestamp AS completed_at
        FROM events
        WHERE event_type IN ${COURSE_END_TYPES} AND course_id = ${courseId}
        ORDER BY user_id, timestamp
      ),
      last_lesson_per_user AS (
        SELECT user_id, MAX(timestamp) AS last_finish
        FROM events
        WHERE course_id = ${courseId}
          AND event_type IN ${LESSON_FINISH_TYPES.slice(0, -1)}, ${QUIZ_SUBMIT_TYPES.slice(1)}
        GROUP BY user_id
      ),
      durations AS (
        SELECT
          et.user_id,
          EXTRACT(EPOCH FROM (COALESCE(ct.completed_at, llp.last_finish) - et.enrolled_at)) / 60 AS duration_minutes
        FROM enrollment_times et
        LEFT JOIN completion_times ct ON ct.user_id = et.user_id
        LEFT JOIN last_lesson_per_user llp ON llp.user_id = et.user_id
        WHERE et.user_id IN (SELECT user_id FROM all_completions)
          AND COALESCE(ct.completed_at, llp.last_finish) IS NOT NULL
      ),
      last_activity AS (
        SELECT MAX(timestamp) AS last_activity_at
        FROM events
        WHERE course_id = ${courseId}
      )
      SELECT
        (SELECT COUNT(DISTINCT user_id) FROM enrolled_users)::int AS total_enrolled,
        (SELECT COUNT(DISTINCT user_id) FROM all_completions)::int AS total_completed,
        CASE
          WHEN (SELECT COUNT(*) FROM enrolled_users) > 0
          THEN ROUND(
            (SELECT COUNT(DISTINCT user_id) FROM all_completions)::numeric /
            (SELECT COUNT(DISTINCT user_id) FROM enrolled_users) * 100
          )::int
          ELSE 0
        END AS completion_rate,
        (SELECT ROUND(AVG(duration_minutes))::int FROM durations) AS avg_duration_minutes,
        (SELECT last_activity_at FROM last_activity) AS last_activity_at
    `));

    const summary = (summaryResult.rows as any[])[0] || {};

    // ── 2. Per-lesson aggregates ───────────────────────────────────────
    const lessonsResult = await db.execute(sql.raw(`
      WITH lesson_ids AS (
        SELECT DISTINCT lesson_id
        FROM events
        WHERE course_id = ${courseId} AND lesson_id IS NOT NULL
      ),
      lesson_start_users AS (
        SELECT lesson_id, user_id, MIN(timestamp) AS started_at
        FROM events
        WHERE course_id = ${courseId}
          AND lesson_id IS NOT NULL
          AND event_type IN ${LESSON_START_TYPES}
        GROUP BY lesson_id, user_id
      ),
      lesson_finish_users AS (
        SELECT DISTINCT lesson_id, user_id
        FROM events
        WHERE course_id = ${courseId}
          AND lesson_id IS NOT NULL
          AND event_type IN ${LESSON_FINISH_TYPES.slice(0, -1)}, ${QUIZ_SUBMIT_TYPES.slice(1)}
      ),
      lesson_finish_times AS (
        SELECT lesson_id, user_id, MAX(timestamp) AS finished_at
        FROM events
        WHERE course_id = ${courseId}
          AND lesson_id IS NOT NULL
          AND event_type IN ${LESSON_FINISH_TYPES.slice(0, -1)}, ${QUIZ_SUBMIT_TYPES.slice(1)}
        GROUP BY lesson_id, user_id
      ),
      lesson_durations AS (
        SELECT
          lsu.lesson_id,
          EXTRACT(EPOCH FROM (lft.finished_at - lsu.started_at)) / 60 AS duration_minutes
        FROM lesson_start_users lsu
        JOIN lesson_finish_times lft ON lft.lesson_id = lsu.lesson_id AND lft.user_id = lsu.user_id
        WHERE lft.finished_at >= lsu.started_at
      )
      SELECT
        li.lesson_id,
        (SELECT COUNT(DISTINCT user_id) FROM lesson_start_users lsu WHERE lsu.lesson_id = li.lesson_id)::int AS total_started,
        (SELECT COUNT(DISTINCT user_id) FROM lesson_finish_users lfu WHERE lfu.lesson_id = li.lesson_id)::int AS total_finished,
        CASE
          WHEN (SELECT COUNT(DISTINCT user_id) FROM lesson_start_users lsu WHERE lsu.lesson_id = li.lesson_id) > 0
          THEN ROUND(
            (SELECT COUNT(DISTINCT user_id) FROM lesson_finish_users lfu WHERE lfu.lesson_id = li.lesson_id)::numeric /
            (SELECT COUNT(DISTINCT user_id) FROM lesson_start_users lsu WHERE lsu.lesson_id = li.lesson_id) * 100
          )::int
          ELSE 0
        END AS completion_rate,
        (SELECT ROUND(AVG(duration_minutes))::int FROM lesson_durations ld WHERE ld.lesson_id = li.lesson_id) AS avg_duration_minutes
      FROM lesson_ids li
      ORDER BY li.lesson_id
    `));

    const lessonRows = lessonsResult.rows as any[];

    // ── 3. Per-quiz aggregates per lesson ──────────────────────────────
    const quizzesResult = await db.execute(sql.raw(`
      WITH quiz_ids AS (
        SELECT DISTINCT lesson_id, quiz_id
        FROM events
        WHERE course_id = ${courseId}
          AND lesson_id IS NOT NULL AND quiz_id IS NOT NULL
      ),
      quiz_start_users AS (
        SELECT lesson_id, quiz_id, user_id, MIN(timestamp) AS started_at
        FROM events
        WHERE course_id = ${courseId}
          AND lesson_id IS NOT NULL AND quiz_id IS NOT NULL
          AND event_type IN ${QUIZ_START_TYPES}
        GROUP BY lesson_id, quiz_id, user_id
      ),
      quiz_submit_users AS (
        SELECT DISTINCT lesson_id, quiz_id, user_id
        FROM events
        WHERE course_id = ${courseId}
          AND lesson_id IS NOT NULL AND quiz_id IS NOT NULL
          AND event_type IN ${QUIZ_SUBMIT_TYPES}
      ),
      quiz_submit_times AS (
        SELECT lesson_id, quiz_id, user_id, MIN(timestamp) AS submitted_at
        FROM events
        WHERE course_id = ${courseId}
          AND lesson_id IS NOT NULL AND quiz_id IS NOT NULL
          AND event_type IN ${QUIZ_SUBMIT_TYPES}
        GROUP BY lesson_id, quiz_id, user_id
      ),
      quiz_durations AS (
        SELECT
          qsu.lesson_id, qsu.quiz_id,
          EXTRACT(EPOCH FROM (qst.submitted_at - qsu.started_at)) / 60 AS duration_minutes
        FROM quiz_start_users qsu
        JOIN quiz_submit_times qst ON qst.lesson_id = qsu.lesson_id AND qst.quiz_id = qsu.quiz_id AND qst.user_id = qsu.user_id
        WHERE qst.submitted_at >= qsu.started_at
      )
      SELECT
        qi.lesson_id,
        qi.quiz_id,
        (SELECT COUNT(DISTINCT user_id) FROM quiz_start_users qsu WHERE qsu.lesson_id = qi.lesson_id AND qsu.quiz_id = qi.quiz_id)::int AS total_started,
        (SELECT COUNT(DISTINCT user_id) FROM quiz_submit_users qsuu WHERE qsuu.lesson_id = qi.lesson_id AND qsuu.quiz_id = qi.quiz_id)::int AS total_submitted,
        CASE
          WHEN (SELECT COUNT(DISTINCT user_id) FROM quiz_start_users qsu WHERE qsu.lesson_id = qi.lesson_id AND qsu.quiz_id = qi.quiz_id) > 0
          THEN ROUND(
            (SELECT COUNT(DISTINCT user_id) FROM quiz_submit_users qsuu WHERE qsuu.lesson_id = qi.lesson_id AND qsuu.quiz_id = qi.quiz_id)::numeric /
            (SELECT COUNT(DISTINCT user_id) FROM quiz_start_users qsu WHERE qsu.lesson_id = qi.lesson_id AND qsu.quiz_id = qi.quiz_id) * 100
          )::int
          ELSE 0
        END AS submission_rate,
        (SELECT ROUND(AVG(duration_minutes))::int FROM quiz_durations qd WHERE qd.lesson_id = qi.lesson_id AND qd.quiz_id = qi.quiz_id) AS avg_duration_minutes
      FROM quiz_ids qi
      ORDER BY qi.lesson_id, qi.quiz_id
    `));

    const quizRows = quizzesResult.rows as any[];

    // ── 4. Per-student stats for this course ──────────────────────────
    const studentsResult = await db.execute(sql.raw(`
      WITH enrolled_users AS (
        SELECT DISTINCT user_id
        FROM events
        WHERE event_type IN ${ENROLLMENT_TYPES} AND course_id = ${courseId}
      ),
      explicit_completions AS (
        SELECT DISTINCT user_id
        FROM events
        WHERE event_type IN ${COURSE_END_TYPES} AND course_id = ${courseId}
      ),
      lesson_counts AS (
        SELECT user_id, COUNT(DISTINCT lesson_id) AS total_lessons
        FROM events
        WHERE lesson_id IS NOT NULL AND course_id = ${courseId}
        GROUP BY user_id
      ),
      finished_lesson_counts AS (
        SELECT user_id, COUNT(DISTINCT lesson_id) AS finished_lessons
        FROM events
        WHERE lesson_id IS NOT NULL AND course_id = ${courseId}
          AND event_type IN ${LESSON_FINISH_TYPES.slice(0, -1)}, ${QUIZ_SUBMIT_TYPES.slice(1)}
        GROUP BY user_id
      ),
      inferred_completions AS (
        SELECT lc.user_id
        FROM lesson_counts lc
        JOIN finished_lesson_counts fl ON lc.user_id = fl.user_id
        WHERE lc.total_lessons > 0 AND lc.total_lessons = fl.finished_lessons
      ),
      all_completions AS (
        SELECT user_id FROM explicit_completions
        UNION
        SELECT user_id FROM inferred_completions
      ),
      enrollment_times AS (
        SELECT DISTINCT ON (user_id)
          user_id, timestamp AS enrolled_at
        FROM events
        WHERE event_type IN ${ENROLLMENT_TYPES} AND course_id = ${courseId}
        ORDER BY user_id, timestamp
      ),
      completion_times AS (
        SELECT DISTINCT ON (user_id)
          user_id, timestamp AS completed_at
        FROM events
        WHERE event_type IN ${COURSE_END_TYPES} AND course_id = ${courseId}
        ORDER BY user_id, timestamp
      ),
      last_events AS (
        SELECT user_id, MAX(timestamp) AS last_event_at
        FROM events
        WHERE course_id = ${courseId}
        GROUP BY user_id
      )
      SELECT
        eu.user_id,
        CASE WHEN ac.user_id IS NOT NULL THEN true ELSE false END AS is_completed,
        et.enrolled_at,
        COALESCE(ct.completed_at, le.last_event_at) AS effective_end_at,
        CASE
          WHEN et.enrolled_at IS NOT NULL AND COALESCE(ct.completed_at, le.last_event_at) IS NOT NULL
          THEN (EXTRACT(EPOCH FROM (COALESCE(ct.completed_at, le.last_event_at) - et.enrolled_at)) / 60)::int
          ELSE NULL
        END AS duration_minutes
      FROM enrolled_users eu
      LEFT JOIN all_completions ac ON ac.user_id = eu.user_id
      LEFT JOIN enrollment_times et ON et.user_id = eu.user_id
      LEFT JOIN completion_times ct ON ct.user_id = eu.user_id
      LEFT JOIN last_events le ON le.user_id = eu.user_id
      ORDER BY eu.user_id
    `));

    const studentRows = studentsResult.rows as any[];

    // ── 5. Assemble final response ─────────────────────────────────────
    const lessons = lessonRows.map(l => {
      const lessonId = Number(l.lesson_id);
      const quizzes = quizRows
        .filter(q => Number(q.lesson_id) === lessonId)
        .map(q => ({
          quizId:             Number(q.quiz_id),
          totalStarted:       Number(q.total_started),
          totalSubmitted:     Number(q.total_submitted),
          submissionRate:     Number(q.submission_rate),
          avgDurationMinutes: q.avg_duration_minutes !== null ? Number(q.avg_duration_minutes) : undefined,
        }));

      return {
        lessonId,
        totalStarted:      Number(l.total_started),
        totalFinished:     Number(l.total_finished),
        completionRate:    Number(l.completion_rate),
        avgDurationMinutes: l.avg_duration_minutes !== null ? Number(l.avg_duration_minutes) : undefined,
        quizzes,
      };
    });

    const students = studentRows.map(s => {
      const isCompleted     = s.is_completed === true || s.is_completed === 'true';
      const durationMinutes = s.duration_minutes !== null ? Number(s.duration_minutes) : undefined;
      const pace            = classifyPace(durationMinutes, isCompleted).label;
      return {
        userId:          Number(s.user_id),
        enrolledAt:      s.enrolled_at ? new Date(s.enrolled_at).toISOString() : undefined,
        isCompleted,
        durationMinutes,
        pace,
      };
    });

    return {
      courseId,
      totalEnrolled:      Number(summary.total_enrolled ?? 0),
      totalCompleted:     Number(summary.total_completed ?? 0),
      completionRate:     Number(summary.completion_rate ?? 0),
      avgDurationMinutes: summary.avg_duration_minutes !== null ? Number(summary.avg_duration_minutes) : undefined,
      lastActivityAt:     summary.last_activity_at ? new Date(summary.last_activity_at).toISOString() : undefined,
      lessons,
      students,
    };
  }

  // ── clearAllEvents ────────────────────────────────────────────────────────
  async clearAllEvents(): Promise<void> {
    await db.delete(events);
  }
}

// Export a singleton instance used by routes.ts
export const storage = new DatabaseStorage();
