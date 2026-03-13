import { events, type InsertEvent, type Event, isCourseEnrollment, isCourseEnd, isLessonStart, isLessonFinish, isQuizStart, isQuizSubmit } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  createEvent(event: InsertEvent): Promise<Event>;
  getEvents(): Promise<Event[]>;
  getStudentsWithStats(): Promise<{ userId: number; enrolledCount: number; completedCount: number }[]>;
  getStudentStats(userId: number): Promise<any>;
  getCourses(): Promise<any[]>;
  getCourseStats(courseId: number): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    return event;
  }

  async getEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(events.timestamp);
  }

  async getStudentsWithStats(): Promise<{ userId: number; enrolledCount: number; completedCount: number }[]> {
    const allEvents = await db.select().from(events);
    const studentMap = new Map<number, { enrolled: Set<number>; completed: Set<number> }>();

    allEvents.forEach(e => {
      if (!studentMap.has(e.userId)) {
        studentMap.set(e.userId, { enrolled: new Set(), completed: new Set() });
      }
    });

    allEvents.forEach(e => {
      const student = studentMap.get(e.userId)!;
      if (isCourseEnrollment(e.eventType)) student.enrolled.add(e.courseId);
      if (isCourseEnd(e.eventType))        student.completed.add(e.courseId);
    });

    for (const userId of studentMap.keys()) {
      const userEvents = allEvents.filter(e => e.userId === userId);
      const student = studentMap.get(userId)!;

      for (const courseId of student.enrolled) {
        if (student.completed.has(courseId)) continue;
        const courseEvents = userEvents.filter(e => e.courseId === courseId);
        const lessonIds = Array.from(new Set(courseEvents.filter(e => e.lessonId).map(e => e.lessonId!)));
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
        enrolledCount: stats.enrolled.size,
        completedCount: stats.completed.size
      }))
      .sort((a, b) => a.userId - b.userId);
  }

  async getStudentStats(userId: number) {
    const studentEvents = await db.select().from(events).where(eq(events.userId, userId));

    const enrolledCourseIds = Array.from(
      new Set(studentEvents.filter(e => isCourseEnrollment(e.eventType)).map(e => e.courseId))
    );

    const courses = enrolledCourseIds.map(courseId => {
      const courseEvents = studentEvents
        .filter(e => e.courseId === courseId)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const enrollmentEvent = courseEvents.find(e => isCourseEnrollment(e.eventType));
      const completionEvent = courseEvents.find(e => isCourseEnd(e.eventType));

      const lessons = Array.from(
        new Set(courseEvents.filter(e => e.lessonId).map(e => e.lessonId!))
      ).map(lessonId => {
        const startEvent  = courseEvents.find(e => e.lessonId === lessonId && isLessonStart(e.eventType));
        const finishEvent = courseEvents.find(e => e.lessonId === lessonId && isLessonFinish(e.eventType));

        const lessonQuizzes = Array.from(
          new Set(courseEvents.filter(e => e.lessonId === lessonId && e.quizId).map(e => e.quizId!))
        ).map(quizId => {
          const quizStartEvent = courseEvents.find(e => e.quizId === quizId && isQuizStart(e.eventType));
          const submitEvent    = courseEvents.find(e => e.quizId === quizId && isQuizSubmit(e.eventType));

          let gapFromLessonStartMinutes: number | undefined;
          if (startEvent && quizStartEvent && !isNaN(startEvent.timestamp.getTime()) && !isNaN(quizStartEvent.timestamp.getTime())) {
            gapFromLessonStartMinutes = Math.round(
              (quizStartEvent.timestamp.getTime() - startEvent.timestamp.getTime()) / (1000 * 60)
            );
          }

          let durationMinutes: number | undefined;
          if (quizStartEvent && submitEvent && !isNaN(quizStartEvent.timestamp.getTime()) && !isNaN(submitEvent.timestamp.getTime())) {
            durationMinutes = Math.round(
              (submitEvent.timestamp.getTime() - quizStartEvent.timestamp.getTime()) / (1000 * 60)
            );
          }

          return {
            quizId,
            isSubmitted: !!submitEvent,
            submittedAt: submitEvent?.timestamp.toISOString(),
            startedAt: quizStartEvent?.timestamp.toISOString(),
            durationMinutes,
            gapFromLessonStartMinutes
          };
        });

        let durationDays: number | undefined;
        let lessonDurationMinutes: number | undefined;
        if (startEvent) {
          const endTimestamp =
            finishEvent?.timestamp ||
            (lessonQuizzes.length > 0
              ? lessonQuizzes.reduce((latest, q) => {
                  if (q.submittedAt) {
                    const d = new Date(q.submittedAt);
                    return !latest || d > latest ? d : latest;
                  }
                  return latest;
                }, null as Date | null)
              : null);

          if (endTimestamp && !isNaN(endTimestamp.getTime())) {
            const diffTime = endTimestamp.getTime() - startEvent.timestamp.getTime();
            lessonDurationMinutes = Math.max(0, Math.round(diffTime / (1000 * 60)));
            const startDate = new Date(startEvent.timestamp.getFullYear(), startEvent.timestamp.getMonth(), startEvent.timestamp.getDate());
            const endDate   = new Date(endTimestamp.getFullYear(), endTimestamp.getMonth(), endTimestamp.getDate());
            durationDays = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }

        return {
          lessonId,
          isFinished: !!finishEvent || lessonQuizzes.some(q => q.isSubmitted),
          startedAt: startEvent?.timestamp.toISOString(),
          finishedAt:
            finishEvent?.timestamp.toISOString() ||
            lessonQuizzes.sort((a, b) => (b.submittedAt?.localeCompare(a.submittedAt || "") || 0))[0]?.submittedAt,
          durationDays,
          lessonDurationMinutes,
          quizzes: lessonQuizzes
        };
      });

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

      const sortedLessons = [...lessons].sort((a, b) => {
        if (!a.startedAt || !b.startedAt) return 0;
        return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      });

      const firstLessonStart = sortedLessons.length > 0 ? sortedLessons[0].startedAt : null;
      let gapEnrollmentToFirstLessonMinutes: number | undefined;
      if (enrollmentEvent && firstLessonStart) {
        gapEnrollmentToFirstLessonMinutes = Math.round(
          (new Date(firstLessonStart).getTime() - enrollmentEvent.timestamp.getTime()) / (1000 * 60)
        );
      }

      const activeDays = new Set(courseEvents.map(e => e.timestamp.toDateString())).size;

      const orphanQuizzes = Array.from(
        new Set(courseEvents.filter(e => !e.lessonId && e.quizId).map(e => e.quizId!))
      ).map(quizId => {
        const submitEvent = courseEvents.find(e => e.quizId === quizId && isQuizSubmit(e.eventType));
        return {
          quizId,
          isSubmitted: !!submitEvent,
          submittedAt: submitEvent?.timestamp.toISOString()
        };
      });

      return {
        courseId,
        isCompleted: !!completionEvent || (lessons.length > 0 && lessons.every(l => l.isFinished)),
        enrolledAt: enrollmentEvent?.timestamp.toISOString(),
        durationMinutes: courseDurationMinutes,
        gapEnrollmentToFirstLessonMinutes,
        activeDays,
        lessons: sortedLessons,
        quizzes: orphanQuizzes
      };
    });

    return {
      enrolledCourses: enrolledCourseIds.length,
      completedCourses: courses.filter(c => c.isCompleted).length,
      courses
    };
  }

  // ─── Course-level analytics ───────────────────────────────────────────────

  async getCourses(): Promise<any[]> {
    const allEvents = await db.select().from(events);

    // Courses are identified by their enrollment events
    const courseIds = Array.from(
      new Set(allEvents.filter(e => isCourseEnrollment(e.eventType)).map(e => e.courseId))
    );

    return courseIds.map(courseId => {
      const courseEvents = allEvents.filter(e => e.courseId === courseId);
      const enrolledUsers = new Set(courseEvents.filter(e => isCourseEnrollment(e.eventType)).map(e => e.userId));
      const totalLessons  = new Set(courseEvents.filter(e => e.lessonId).map(e => e.lessonId!)).size;
      const lastActivityAt = [...courseEvents].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp.toISOString();

      let completedCount = 0;
      for (const userId of enrolledUsers) {
        const userCourseEvents = courseEvents.filter(e => e.userId === userId);
        if (userCourseEvents.some(e => isCourseEnd(e.eventType))) { completedCount++; continue; }
        const lessonIds = Array.from(new Set(userCourseEvents.filter(e => e.lessonId).map(e => e.lessonId!)));
        if (lessonIds.length > 0 && lessonIds.every(lid =>
          userCourseEvents.some(e => e.lessonId === lid && isLessonFinish(e.eventType)) ||
          userCourseEvents.some(e => e.lessonId === lid && isQuizSubmit(e.eventType))
        )) completedCount++;
      }

      return {
        courseId,
        totalEnrolled: enrolledUsers.size,
        totalCompleted: completedCount,
        completionRate: enrolledUsers.size > 0 ? Math.round((completedCount / enrolledUsers.size) * 100) : 0,
        totalLessons,
        lastActivityAt
      };
    }).sort((a, b) => a.courseId - b.courseId);
  }

  async getCourseStats(courseId: number): Promise<any> {
    const courseEvents = await db.select().from(events).where(eq(events.courseId, courseId));

    const enrolledUserIds = Array.from(
      new Set(courseEvents.filter(e => isCourseEnrollment(e.eventType)).map(e => e.userId))
    );

    // Determine which students completed the course
    const completedUserIds = new Set<number>();
    for (const userId of enrolledUserIds) {
      const userCourseEvents = courseEvents.filter(e => e.userId === userId);
      if (userCourseEvents.some(e => isCourseEnd(e.eventType))) { completedUserIds.add(userId); continue; }
      const lessonIds = Array.from(new Set(userCourseEvents.filter(e => e.lessonId).map(e => e.lessonId!)));
      if (lessonIds.length > 0 && lessonIds.every(lid =>
        userCourseEvents.some(e => e.lessonId === lid && isLessonFinish(e.eventType)) ||
        userCourseEvents.some(e => e.lessonId === lid && isQuizSubmit(e.eventType))
      )) completedUserIds.add(userId);
    }

    // Aggregate per-lesson stats across all students
    const allLessonIds = Array.from(
      new Set(courseEvents.filter(e => e.lessonId).map(e => e.lessonId!))
    ).sort((a, b) => a - b);

    const lessons = allLessonIds.map(lessonId => {
      const lessonEvents = courseEvents.filter(e => e.lessonId === lessonId);
      const startedUsers  = new Set(lessonEvents.filter(e => isLessonStart(e.eventType)).map(e => e.userId));
      const finishedUsers = new Set([
        ...lessonEvents.filter(e => isLessonFinish(e.eventType)).map(e => e.userId),
        ...lessonEvents.filter(e => isQuizSubmit(e.eventType)).map(e => e.userId)
      ]);

      // Average lesson duration
      const durations: number[] = [];
      for (const userId of startedUsers) {
        const ul = lessonEvents.filter(e => e.userId === userId);
        const start  = ul.find(e => isLessonStart(e.eventType));
        const finish = ul.find(e => isLessonFinish(e.eventType)) ||
          [...ul.filter(e => isQuizSubmit(e.eventType))].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
        if (start && finish) {
          const mins = Math.round((finish.timestamp.getTime() - start.timestamp.getTime()) / (1000 * 60));
          if (mins >= 0) durations.push(mins);
        }
      }
      const avgDurationMinutes = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : undefined;

      // Quiz stats for this lesson
      const quizIds = Array.from(new Set(lessonEvents.filter(e => e.quizId).map(e => e.quizId!))).sort((a, b) => a - b);
      const quizzes = quizIds.map(quizId => {
        const qe = lessonEvents.filter(e => e.quizId === quizId);
        const startedCount   = new Set(qe.filter(e => isQuizStart(e.eventType)).map(e => e.userId)).size;
        const submittedCount = new Set(qe.filter(e => isQuizSubmit(e.eventType)).map(e => e.userId)).size;

        const qDurations: number[] = [];
        for (const userId of new Set(qe.map(e => e.userId))) {
          const uq = qe.filter(e => e.userId === userId);
          const s = uq.find(e => isQuizStart(e.eventType));
          const sub = uq.find(e => isQuizSubmit(e.eventType));
          if (s && sub) {
            const mins = Math.round((sub.timestamp.getTime() - s.timestamp.getTime()) / (1000 * 60));
            if (mins >= 0) qDurations.push(mins);
          }
        }

        return {
          quizId,
          totalStarted: startedCount,
          totalSubmitted: submittedCount,
          submissionRate: startedCount > 0 ? Math.round((submittedCount / startedCount) * 100) : 0,
          avgDurationMinutes: qDurations.length > 0
            ? Math.round(qDurations.reduce((a, b) => a + b, 0) / qDurations.length)
            : undefined
        };
      });

      return {
        lessonId,
        totalStarted: startedUsers.size,
        totalFinished: finishedUsers.size,
        completionRate: startedUsers.size > 0 ? Math.round((finishedUsers.size / startedUsers.size) * 100) : 0,
        avgDurationMinutes,
        quizzes
      };
    });

    // Per-student summary with pace classification
    const students = enrolledUserIds.map(userId => {
      const uce = courseEvents.filter(e => e.userId === userId).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const enrollmentEvent  = uce.find(e => isCourseEnrollment(e.eventType));
      const completionEvent  = uce.find(e => isCourseEnd(e.eventType));
      const isCompleted      = completedUserIds.has(userId);

      let durationMinutes: number | undefined;
      if (enrollmentEvent) {
        const endEvent = completionEvent || uce[uce.length - 1];
        if (endEvent) durationMinutes = Math.round((endEvent.timestamp.getTime() - enrollmentEvent.timestamp.getTime()) / (1000 * 60));
      }

      // Pace classification — same criteria as frontend student-details.tsx
      let redFlags = 0;
      const userLessonIds = Array.from(new Set(uce.filter(e => e.lessonId).map(e => e.lessonId!)));

      // 1. Lesson time < 2 min
      const veryFastLessons = userLessonIds.filter(lid => {
        const s = uce.find(e => e.lessonId === lid && isLessonStart(e.eventType));
        const f = uce.find(e => e.lessonId === lid && isLessonFinish(e.eventType)) ||
          [...uce.filter(e => e.lessonId === lid && isQuizSubmit(e.eventType))].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
        return s && f && (f.timestamp.getTime() - s.timestamp.getTime()) < 2 * 60 * 1000;
      });
      if (veryFastLessons.length > 0) redFlags++;

      // 2. Quiz start gap < 30 sec
      const userQuizIds = Array.from(new Set(uce.filter(e => e.quizId).map(e => e.quizId!)));
      const fastGaps = userQuizIds.filter(qid => {
        const lessonId = uce.find(e => e.quizId === qid)?.lessonId;
        if (!lessonId) return false;
        const lStart = uce.find(e => e.lessonId === lessonId && isLessonStart(e.eventType));
        const qStart = uce.find(e => e.quizId === qid && isQuizStart(e.eventType));
        return lStart && qStart && (qStart.timestamp.getTime() - lStart.timestamp.getTime()) < 30 * 1000;
      });
      if (fastGaps.length > 0) redFlags++;

      // 3. Quiz time < 1 min
      const fastQuizzes = userQuizIds.filter(qid => {
        const s = uce.find(e => e.quizId === qid && isQuizStart(e.eventType));
        const sub = uce.find(e => e.quizId === qid && isQuizSubmit(e.eventType));
        return s && sub && (sub.timestamp.getTime() - s.timestamp.getTime()) < 60 * 1000;
      });
      if (fastQuizzes.length > 0) redFlags++;

      // 4. 3+ lessons in < 10 min
      const sortedByStart = userLessonIds
        .map(lid => ({ lid, t: uce.find(e => e.lessonId === lid && isLessonStart(e.eventType))?.timestamp }))
        .filter(x => x.t).sort((a, b) => a.t!.getTime() - b.t!.getTime());
      for (let i = 0; i <= sortedByStart.length - 3; i++) {
        const span = sortedByStart[i + 2].t!.getTime() - sortedByStart[i].t!.getTime();
        if (span < 10 * 60 * 1000) { redFlags++; break; }
      }

      // 5. Entire course < 30 min
      if (isCompleted && durationMinutes !== undefined && durationMinutes < 30) redFlags++;

      let pace = "Steady";
      if (redFlags >= 3) {
        pace = "Rushing";
      } else {
        const activeDays = new Set(uce.map(e => e.timestamp.toDateString())).size;
        const engagedLessons = userLessonIds.filter(lid => {
          const s = uce.find(e => e.lessonId === lid && isLessonStart(e.eventType));
          const f = uce.find(e => e.lessonId === lid && isLessonFinish(e.eventType));
          if (!s || !f) return false;
          const mins = (f.timestamp.getTime() - s.timestamp.getTime()) / (1000 * 60);
          return mins >= 5 && mins <= 20;
        }).length;
        const engagedQuizzes = userQuizIds.filter(qid => {
          const s = uce.find(e => e.quizId === qid && isQuizStart(e.eventType));
          const sub = uce.find(e => e.quizId === qid && isQuizSubmit(e.eventType));
          if (!s || !sub) return false;
          const mins = (sub.timestamp.getTime() - s.timestamp.getTime()) / (1000 * 60);
          return mins >= 2 && mins <= 10;
        }).length;
        if (engagedLessons > 0 || engagedQuizzes > 0 || activeDays > 1) pace = "Engaged";
      }

      return {
        userId,
        enrolledAt: enrollmentEvent?.timestamp.toISOString(),
        isCompleted,
        durationMinutes,
        pace
      };
    }).sort((a, b) => a.userId - b.userId);

    const completedDurations = students.filter(s => s.isCompleted && s.durationMinutes !== undefined).map(s => s.durationMinutes!);
    const avgDurationMinutes = completedDurations.length > 0
      ? Math.round(completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length)
      : undefined;

    const lastActivityAt = [...courseEvents].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp.toISOString();

    return {
      courseId,
      totalEnrolled: enrolledUserIds.length,
      totalCompleted: completedUserIds.size,
      completionRate: enrolledUserIds.length > 0 ? Math.round((completedUserIds.size / enrolledUserIds.length) * 100) : 0,
      avgDurationMinutes,
      lessons,
      students,
      lastActivityAt
    };
  }
}

export const storage = new DatabaseStorage();
