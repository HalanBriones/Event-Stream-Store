/**
 * server/storage.ts
 *
 * Data access layer — the only file that talks directly to the database.
 *
 * All business logic that requires reading or writing events lives here.
 * The Express routes in routes.ts call these methods; they never touch
 * the database directly.
 *
 * Pattern overview:
 *   - Most methods pull ALL relevant events in a single query, then compute
 *     aggregates in JavaScript. This avoids complex SQL and keeps the logic
 *     easy to follow and modify.
 *   - Event-type comparisons always use the helper functions from schema.ts
 *     (e.g. isLessonFinish, isQuizSubmit) so string variants are handled
 *     in one place.
 */

import {
  events,
  type InsertEvent,
  type Event,
  isCourseEnrollment,
  isCourseEnd,
  isLessonStart,
  isLessonFinish,
  isQuizStart,
  isQuizSubmit,
} from "@shared/schema";
import { classifyPace } from "@shared/paceConfig";
import { db } from "./db";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Storage interface
//
// Defines the contract that any storage implementation must satisfy.
// Currently only DatabaseStorage exists, but having an interface makes it
// trivial to add an in-memory or mock implementation for testing.
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
// DatabaseStorage — production implementation backed by PostgreSQL via Drizzle
// ---------------------------------------------------------------------------
export class DatabaseStorage implements IStorage {

  // ── createEvent ──────────────────────────────────────────────────────────
  /** Inserts a single learning event into the database and returns the new row. */
  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    return event;
  }

  // ── getEvents ────────────────────────────────────────────────────────────
  /** Returns every event in the database, ordered by timestamp ascending. */
  async getEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(events.timestamp);
  }

  // ── getStudentsWithStats ─────────────────────────────────────────────────
  /**
   * Builds a summary row for every unique student:
   *   - enrolledCount  — number of distinct courses the student enrolled in
   *   - completedCount — number of those courses they actually finished
   *
   * Completion is determined in two ways (whichever comes first):
   *   1. An explicit course_ended event exists for that student+course pair.
   *   2. Every lesson in the course has a lesson_finished OR quiz_submitted event.
   */
  async getStudentsWithStats(): Promise<{ userId: number; enrolledCount: number; completedCount: number }[]> {
    const allEvents = await db.select().from(events);

    // Build a map of userId → { enrolled: Set<courseId>, completed: Set<courseId> }
    const studentMap = new Map<number, { enrolled: Set<number>; completed: Set<number> }>();

    // First pass: initialise an entry for every user seen in any event
    allEvents.forEach(e => {
      if (!studentMap.has(e.userId)) {
        studentMap.set(e.userId, { enrolled: new Set(), completed: new Set() });
      }
    });

    // Second pass: populate enrolled and completed sets from explicit events
    allEvents.forEach(e => {
      const student = studentMap.get(e.userId)!;
      if (isCourseEnrollment(e.eventType)) student.enrolled.add(e.courseId);
      if (isCourseEnd(e.eventType))        student.completed.add(e.courseId);
    });

    // Third pass: infer completion from lesson activity when no explicit end event exists
    for (const userId of studentMap.keys()) {
      const userEvents = allEvents.filter(e => e.userId === userId);
      const student    = studentMap.get(userId)!;

      for (const courseId of student.enrolled) {
        if (student.completed.has(courseId)) continue; // already marked complete

        const courseEvents = userEvents.filter(e => e.courseId === courseId);
        const lessonIds    = Array.from(new Set(courseEvents.filter(e => e.lessonId).map(e => e.lessonId!)));

        // Mark complete only if there is at least one lesson AND every lesson
        // has either a finish event or a quiz submission
        if (lessonIds.length > 0) {
          const allDone = lessonIds.every(lessonId =>
            courseEvents.some(e => e.lessonId === lessonId && isLessonFinish(e.eventType)) ||
            courseEvents.some(e => e.lessonId === lessonId && isQuizSubmit(e.eventType))
          );
          if (allDone) student.completed.add(courseId);
        }
      }
    }

    return Array.from(studentMap.entries())
      .map(([userId, stats]) => ({
        userId,
        enrolledCount:  stats.enrolled.size,
        completedCount: stats.completed.size,
      }))
      .sort((a, b) => a.userId - b.userId);
  }

  // ── getStudentStats ──────────────────────────────────────────────────────
  /**
   * Returns a complete learning timeline for a single student.
   *
   * For each course the student enrolled in, the result includes:
   *   - isCompleted / enrolledAt / durationMinutes
   *   - activeDays — number of distinct calendar days with any activity
   *   - gapEnrollmentToFirstLessonMinutes — delay before first lesson started
   *   - lessons[] — each lesson with timing and quiz breakdown
   *
   * Duration fields:
   *   - lessonDurationMinutes — time from lesson_started to lesson_finished
   *     (or to the last quiz_submitted if there is no explicit finish event)
   *   - durationDays — calendar days spanned (0 = same day)
   *
   * This data is consumed by the Student Details page and the Insights modal.
   */
  async getStudentStats(userId: number) {
    const studentEvents = await db.select().from(events).where(eq(events.userId, userId));

    // Collect all courses this student enrolled in
    const enrolledCourseIds = Array.from(
      new Set(studentEvents.filter(e => isCourseEnrollment(e.eventType)).map(e => e.courseId))
    );

    const courses = enrolledCourseIds.map(courseId => {
      // All events for this student in this course, sorted chronologically
      const courseEvents = studentEvents
        .filter(e => e.courseId === courseId)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const enrollmentEvent = courseEvents.find(e => isCourseEnrollment(e.eventType));
      const completionEvent = courseEvents.find(e => isCourseEnd(e.eventType));

      // Build per-lesson objects
      const lessons = Array.from(
        new Set(courseEvents.filter(e => e.lessonId).map(e => e.lessonId!))
      ).map(lessonId => {
        const startEvent  = courseEvents.find(e => e.lessonId === lessonId && isLessonStart(e.eventType));
        const finishEvent = courseEvents.find(e => e.lessonId === lessonId && isLessonFinish(e.eventType));

        // Build per-quiz objects for this lesson
        const lessonQuizzes = Array.from(
          new Set(courseEvents.filter(e => e.lessonId === lessonId && e.quizId).map(e => e.quizId!))
        ).map(quizId => {
          const quizStartEvent = courseEvents.find(e => e.quizId === quizId && isQuizStart(e.eventType));
          const submitEvent    = courseEvents.find(e => e.quizId === quizId && isQuizSubmit(e.eventType));

          // How long after the lesson started did the student open the quiz?
          let gapFromLessonStartMinutes: number | undefined;
          if (startEvent && quizStartEvent &&
              !isNaN(startEvent.timestamp.getTime()) &&
              !isNaN(quizStartEvent.timestamp.getTime())) {
            gapFromLessonStartMinutes = Math.round(
              (quizStartEvent.timestamp.getTime() - startEvent.timestamp.getTime()) / (1000 * 60)
            );
          }

          // How long did the student spend on the quiz itself?
          let durationMinutes: number | undefined;
          if (quizStartEvent && submitEvent &&
              !isNaN(quizStartEvent.timestamp.getTime()) &&
              !isNaN(submitEvent.timestamp.getTime())) {
            durationMinutes = Math.round(
              (submitEvent.timestamp.getTime() - quizStartEvent.timestamp.getTime()) / (1000 * 60)
            );
          }

          return {
            quizId,
            isSubmitted: !!submitEvent,
            submittedAt: submitEvent?.timestamp.toISOString(),
            startedAt:   quizStartEvent?.timestamp.toISOString(),
            durationMinutes,
            gapFromLessonStartMinutes,
          };
        });

        // ── Lesson duration calculation ─────────────────────────────────
        // End time = explicit lesson_finished, OR the latest quiz_submitted
        // (some platforms record submission but not an explicit lesson end)
        let durationDays: number | undefined;
        let lessonDurationMinutes: number | undefined;

        if (startEvent) {
          const latestQuizSubmit = lessonQuizzes
            .filter(q => q.submittedAt)
            .reduce((latest, q) => {
              const d = new Date(q.submittedAt!);
              return !latest || d > latest ? d : latest;
            }, null as Date | null);

          const endTimestamp = finishEvent?.timestamp || latestQuizSubmit;

          if (endTimestamp && !isNaN(endTimestamp.getTime())) {
            const diffMs = endTimestamp.getTime() - startEvent.timestamp.getTime();
            lessonDurationMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));

            // Count calendar-day span (0 = same day, 1 = next day, etc.)
            const startDate = new Date(startEvent.timestamp.getFullYear(), startEvent.timestamp.getMonth(), startEvent.timestamp.getDate());
            const endDate   = new Date(endTimestamp.getFullYear(), endTimestamp.getMonth(), endTimestamp.getDate());
            durationDays = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }

        return {
          lessonId,
          isFinished: !!finishEvent || lessonQuizzes.some(q => q.isSubmitted),
          startedAt:  startEvent?.timestamp.toISOString(),
          finishedAt:
            finishEvent?.timestamp.toISOString() ||
            // Fall back to the latest quiz submission as the effective end time
            lessonQuizzes.sort((a, b) => (b.submittedAt?.localeCompare(a.submittedAt || "") || 0))[0]?.submittedAt,
          durationDays,
          lessonDurationMinutes,
          quizzes: lessonQuizzes,
        };
      });

      // ── Course duration calculation ─────────────────────────────────────
      // Course end time = explicit course_ended event, OR the latest lesson finish
      const lastLessonFinish = lessons
        .filter(l => l.finishedAt)
        .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())[0]
        ?.finishedAt;
      const courseEndTime = completionEvent?.timestamp || (lastLessonFinish ? new Date(lastLessonFinish) : null);

      let courseDurationMinutes: number | undefined;
      if (enrollmentEvent && courseEndTime) {
        courseDurationMinutes = Math.round(
          (courseEndTime.getTime() - enrollmentEvent.timestamp.getTime()) / (1000 * 60)
        );
      }

      // Sort lessons in chronological start order for display
      const sortedLessons = [...lessons].sort((a, b) => {
        if (!a.startedAt || !b.startedAt) return 0;
        return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      });

      // How long did the student wait before starting their first lesson?
      const firstLessonStart = sortedLessons.length > 0 ? sortedLessons[0].startedAt : null;
      let gapEnrollmentToFirstLessonMinutes: number | undefined;
      if (enrollmentEvent && firstLessonStart) {
        gapEnrollmentToFirstLessonMinutes = Math.round(
          (new Date(firstLessonStart).getTime() - enrollmentEvent.timestamp.getTime()) / (1000 * 60)
        );
      }

      // Count how many distinct calendar days had any activity
      const activeDays = new Set(courseEvents.map(e => e.timestamp.toDateString())).size;

      // Quizzes that are not tied to a specific lesson (rare but possible)
      const orphanQuizzes = Array.from(
        new Set(courseEvents.filter(e => !e.lessonId && e.quizId).map(e => e.quizId!))
      ).map(quizId => {
        const submitEvent = courseEvents.find(e => e.quizId === quizId && isQuizSubmit(e.eventType));
        return {
          quizId,
          isSubmitted: !!submitEvent,
          submittedAt: submitEvent?.timestamp.toISOString(),
        };
      });

      return {
        courseId,
        // A course is considered complete if there is an explicit end event,
        // OR every lesson has a finish/quiz-submit event
        isCompleted: !!completionEvent || (lessons.length > 0 && lessons.every(l => l.isFinished)),
        enrolledAt:  enrollmentEvent?.timestamp.toISOString(),
        durationMinutes: courseDurationMinutes,
        gapEnrollmentToFirstLessonMinutes,
        activeDays,
        lessons: sortedLessons,
        quizzes: orphanQuizzes,
      };
    });

    return {
      enrolledCourses:  enrolledCourseIds.length,
      completedCourses: courses.filter(c => c.isCompleted).length,
      courses,
    };
  }

  // ── getCourses ───────────────────────────────────────────────────────────
  /**
   * Returns a high-level summary for every course that has at least one
   * enrollment event:
   *   - totalEnrolled  — distinct students who joined
   *   - totalCompleted — students who finished (explicit or inferred)
   *   - completionRate — percentage (0–100)
   *   - totalLessons   — distinct lesson IDs seen across all students
   *   - lastActivityAt — timestamp of the most recent event in the course
   */
  async getCourses(): Promise<any[]> {
    const allEvents = await db.select().from(events);

    // Identify all courses by finding distinct courseIds from enrollment events
    const courseIds = Array.from(
      new Set(allEvents.filter(e => isCourseEnrollment(e.eventType)).map(e => e.courseId))
    );

    return courseIds.map(courseId => {
      const courseEvents = allEvents.filter(e => e.courseId === courseId);
      const enrolledUsers = new Set(courseEvents.filter(e => isCourseEnrollment(e.eventType)).map(e => e.userId));
      const totalLessons  = new Set(courseEvents.filter(e => e.lessonId).map(e => e.lessonId!)).size;
      const lastActivityAt = [...courseEvents]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
        ?.timestamp.toISOString();

      // Count completions using the same two-step logic as getStudentsWithStats
      let completedCount = 0;
      for (const userId of enrolledUsers) {
        const userCourseEvents = courseEvents.filter(e => e.userId === userId);

        // Step 1: explicit course_ended event
        if (userCourseEvents.some(e => isCourseEnd(e.eventType))) {
          completedCount++;
          continue;
        }

        // Step 2: every lesson has a finish or quiz-submit event
        const lessonIds = Array.from(new Set(userCourseEvents.filter(e => e.lessonId).map(e => e.lessonId!)));
        if (lessonIds.length > 0 && lessonIds.every(lid =>
          userCourseEvents.some(e => e.lessonId === lid && isLessonFinish(e.eventType)) ||
          userCourseEvents.some(e => e.lessonId === lid && isQuizSubmit(e.eventType))
        )) completedCount++;
      }

      return {
        courseId,
        totalEnrolled:  enrolledUsers.size,
        totalCompleted: completedCount,
        completionRate: enrolledUsers.size > 0
          ? Math.round((completedCount / enrolledUsers.size) * 100)
          : 0,
        totalLessons,
        lastActivityAt,
      };
    }).sort((a, b) => a.courseId - b.courseId);
  }

  // ── getCourseStats ───────────────────────────────────────────────────────
  /**
   * Returns deep analytics for a single course:
   *
   *   Summary:
   *     - totalEnrolled / totalCompleted / completionRate / avgDurationMinutes
   *
   *   lessons[] — one entry per distinct lessonId, aggregated across all students:
   *     - totalStarted / totalFinished / completionRate / avgDurationMinutes
   *     - quizzes[] — same aggregates per quizId within the lesson
   *
   *   students[] — one entry per enrolled student:
   *     - isCompleted / durationMinutes / pace
   *
   * Pace is classified by total course duration:
   *   Rushing (<1h) | Light Engagement (1–2h) | Normal (2–3h) | Slow (3–4h) | Struggling (>4h)
   */
  async getCourseStats(courseId: number): Promise<any> {
    const courseEvents = await db.select().from(events).where(eq(events.courseId, courseId));

    // All students who enrolled in this course
    const enrolledUserIds = Array.from(
      new Set(courseEvents.filter(e => isCourseEnrollment(e.eventType)).map(e => e.userId))
    );

    // ── Step 1: determine which students completed the course ─────────────
    const completedUserIds = new Set<number>();
    for (const userId of enrolledUserIds) {
      const userCourseEvents = courseEvents.filter(e => e.userId === userId);

      if (userCourseEvents.some(e => isCourseEnd(e.eventType))) {
        completedUserIds.add(userId);
        continue;
      }

      const lessonIds = Array.from(new Set(userCourseEvents.filter(e => e.lessonId).map(e => e.lessonId!)));
      if (lessonIds.length > 0 && lessonIds.every(lid =>
        userCourseEvents.some(e => e.lessonId === lid && isLessonFinish(e.eventType)) ||
        userCourseEvents.some(e => e.lessonId === lid && isQuizSubmit(e.eventType))
      )) completedUserIds.add(userId);
    }

    // ── Step 2: aggregate per-lesson stats across all students ────────────
    const allLessonIds = Array.from(
      new Set(courseEvents.filter(e => e.lessonId).map(e => e.lessonId!))
    ).sort((a, b) => a - b);

    const lessons = allLessonIds.map(lessonId => {
      const lessonEvents = courseEvents.filter(e => e.lessonId === lessonId);

      // Count unique students who started vs finished this lesson
      const startedUsers  = new Set(lessonEvents.filter(e => isLessonStart(e.eventType)).map(e => e.userId));
      const finishedUsers = new Set([
        ...lessonEvents.filter(e => isLessonFinish(e.eventType)).map(e => e.userId),
        // A quiz submission also counts as finishing the lesson
        ...lessonEvents.filter(e => isQuizSubmit(e.eventType)).map(e => e.userId),
      ]);

      // Average lesson duration: computed only for students who both started AND finished
      const durations: number[] = [];
      for (const userId of startedUsers) {
        const ul     = lessonEvents.filter(e => e.userId === userId);
        const start  = ul.find(e => isLessonStart(e.eventType));
        const finish = ul.find(e => isLessonFinish(e.eventType)) ||
          [...ul.filter(e => isQuizSubmit(e.eventType))].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

        if (start && finish) {
          const mins = Math.round((finish.timestamp.getTime() - start.timestamp.getTime()) / (1000 * 60));
          if (mins >= 0) durations.push(mins);
        }
      }
      const avgDurationMinutes = durations.length > 0
        ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
        : undefined;

      // Per-quiz aggregates for this lesson
      const quizIds = Array.from(
        new Set(lessonEvents.filter(e => e.quizId).map(e => e.quizId!))
      ).sort((a, b) => a - b);

      const quizzes = quizIds.map(quizId => {
        const qe             = lessonEvents.filter(e => e.quizId === quizId);
        const startedCount   = new Set(qe.filter(e => isQuizStart(e.eventType)).map(e => e.userId)).size;
        const submittedCount = new Set(qe.filter(e => isQuizSubmit(e.eventType)).map(e => e.userId)).size;

        // Average time from quiz_started to quiz_submitted
        const qDurations: number[] = [];
        for (const userId of new Set(qe.map(e => e.userId))) {
          const uq  = qe.filter(e => e.userId === userId);
          const s   = uq.find(e => isQuizStart(e.eventType));
          const sub = uq.find(e => isQuizSubmit(e.eventType));
          if (s && sub) {
            const mins = Math.round((sub.timestamp.getTime() - s.timestamp.getTime()) / (1000 * 60));
            if (mins >= 0) qDurations.push(mins);
          }
        }

        return {
          quizId,
          totalStarted:    startedCount,
          totalSubmitted:  submittedCount,
          submissionRate:  startedCount > 0 ? Math.round((submittedCount / startedCount) * 100) : 0,
          avgDurationMinutes: qDurations.length > 0
            ? Math.round(qDurations.reduce((sum, d) => sum + d, 0) / qDurations.length)
            : undefined,
        };
      });

      return {
        lessonId,
        totalStarted:    startedUsers.size,
        totalFinished:   finishedUsers.size,
        completionRate:  startedUsers.size > 0
          ? Math.round((finishedUsers.size / startedUsers.size) * 100)
          : 0,
        avgDurationMinutes,
        quizzes,
      };
    });

    // ── Step 3: per-student summary with pace classification ──────────────
    //
    // Pace is determined solely by total course duration (enrollment → completion).
    // Courses are expected to be completed within a single day.
    //
    // Thresholds:
    //   Rushing          — completed in < 1 hour
    //   Light Engagement — completed in 1–2 hours
    //   Normal           — completed in 2–3 hours  ← healthy target range
    //   Slow             — completed in 3–4 hours
    //   Struggling       — completed in > 4 hours
    //   In Progress      — course not yet completed (no classification possible)
    const students = enrolledUserIds.map(userId => {
      // All events for this student in this course, sorted oldest → newest
      const uce = courseEvents
        .filter(e => e.userId === userId)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const enrollmentEvent = uce.find(e => isCourseEnrollment(e.eventType));
      const completionEvent = uce.find(e => isCourseEnd(e.eventType));
      const isCompleted     = completedUserIds.has(userId);

      // Total time from enrollment to the last event (or explicit completion)
      let durationMinutes: number | undefined;
      if (enrollmentEvent) {
        const endEvent = completionEvent || uce[uce.length - 1];
        if (endEvent) {
          durationMinutes = Math.round(
            (endEvent.timestamp.getTime() - enrollmentEvent.timestamp.getTime()) / (1000 * 60)
          );
        }
      }

      // ── Pace classification ─────────────────────────────────────────────
      // Delegates to classifyPace() — edit shared/paceConfig.ts to change
      // thresholds, add tiers, or rename labels. No other file needs updating.
      const pace = classifyPace(durationMinutes, isCompleted).label;

      return {
        userId,
        enrolledAt:      enrollmentEvent?.timestamp.toISOString(),
        isCompleted,
        durationMinutes,
        pace,
      };
    }).sort((a, b) => a.userId - b.userId);

    // ── Step 4: aggregate final course-level numbers ──────────────────────
    // Average duration is computed only over students who fully completed the course
    const completedDurations = students
      .filter(s => s.isCompleted && s.durationMinutes !== undefined)
      .map(s => s.durationMinutes!);

    const avgDurationMinutes = completedDurations.length > 0
      ? Math.round(completedDurations.reduce((sum, d) => sum + d, 0) / completedDurations.length)
      : undefined;

    const lastActivityAt = [...courseEvents]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
      ?.timestamp.toISOString();

    return {
      courseId,
      totalEnrolled:  enrolledUserIds.length,
      totalCompleted: completedUserIds.size,
      completionRate: enrolledUserIds.length > 0
        ? Math.round((completedUserIds.size / enrolledUserIds.length) * 100)
        : 0,
      avgDurationMinutes,
      lessons,
      students,
      lastActivityAt,
    };
  }

  // ── clearAllEvents (TEMPORARY) ────────────────────────────────────────────
  async clearAllEvents(): Promise<void> {
    await db.delete(events);
  }
}

// Export a singleton instance used by routes.ts
export const storage = new DatabaseStorage();
