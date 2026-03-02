import { events, type InsertEvent, type Event } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  createEvent(event: InsertEvent): Promise<Event>;
  getEvents(): Promise<Event[]>;
  getStudentsWithStats(): Promise<{ userId: number; enrolledCount: number }[]>;
  getStudentStats(userId: number): Promise<{
    enrolledCourses: number;
    completedCourses: number;
    courseCompletionTimes: { courseId: number; durationMinutes: number }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    return event;
  }

  async getEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(events.timestamp);
  }

  async getStudentsWithStats(): Promise<{ userId: number; enrolledCount: number }[]> {
    const allEvents = await db.select().from(events);
    const studentMap = new Map<number, Set<number>>();

    // Identify all unique users from any event
    allEvents.forEach(e => {
      if (!studentMap.has(e.userId)) {
        studentMap.set(e.userId, new Set());
      }
    });

    // Count distinct course_id where event_type = 'course_enrollment'
    allEvents.forEach(e => {
      if (e.eventType === 'course_enrollment') {
        studentMap.get(e.userId)!.add(e.courseId);
      }
    });

    return Array.from(studentMap.entries())
      .map(([userId, enrolledSet]) => ({
        userId,
        enrolledCount: enrolledSet.size
      }))
      .sort((a, b) => a.userId - b.userId);
  }

  async getStudentStats(userId: number) {
    const studentEvents = await db.select().from(events).where(eq(events.userId, userId));
    
    const enrolledCourseIds = Array.from(new Set(studentEvents.filter(e => e.eventType === 'course_enrollment').map(e => e.courseId)));
    
    const courses = enrolledCourseIds.map(courseId => {
      const courseEvents = studentEvents.filter(e => e.courseId === courseId).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const enrollmentEvent = courseEvents.find(e => e.eventType === 'course_enrollment');
      const completionEvent = courseEvents.find(e => e.eventType === 'course_ended');

      const lessons = Array.from(new Set(courseEvents.filter(e => e.lessonId).map(e => e.lessonId!))).map(lessonId => {
        const startEvent = courseEvents.find(e => e.lessonId === lessonId && (e.eventType === 'lesson_started' || e.eventType === 'lesson_start'));
        const finishEvent = courseEvents.find(e => e.lessonId === lessonId && e.eventType === 'lesson_finished');
        
        const lessonQuizzes = Array.from(new Set(courseEvents.filter(e => e.lessonId === lessonId && e.quizId).map(e => e.quizId!))).map(quizId => {
          const quizStartEvent = courseEvents.find(e => e.quizId === quizId && e.eventType === 'quiz_started');
          const submitEvent = courseEvents.find(e => e.quizId === quizId && e.eventType === 'quiz_submitted');
          
          let gapFromLessonStartMinutes: number | undefined;
          if (startEvent && quizStartEvent) {
            gapFromLessonStartMinutes = Math.round((quizStartEvent.timestamp.getTime() - startEvent.timestamp.getTime()) / (1000 * 60));
          }

          return {
            quizId,
            isSubmitted: !!submitEvent,
            submittedAt: submitEvent?.timestamp.toISOString(),
            startedAt: quizStartEvent?.timestamp.toISOString(),
            durationMinutes: (quizStartEvent && submitEvent) 
              ? Math.round((submitEvent.timestamp.getTime() - quizStartEvent.timestamp.getTime()) / (1000 * 60))
              : undefined,
            gapFromLessonStartMinutes
          };
        });

        // Calculate lesson duration: from lesson_started to the last quiz_submitted or lesson_finished
        let durationDays: number | undefined;
        let lessonDurationMinutes: number | undefined;
        if (startEvent) {
          const endTimestamp = finishEvent?.timestamp 
            || lessonQuizzes.reduce((latest, q) => {
                 if (q.submittedAt) {
                   const d = new Date(q.submittedAt);
                   return (!latest || d > latest) ? d : latest;
                 }
                 return latest;
               }, null as Date | null);

          if (endTimestamp) {
            const diffTime = endTimestamp.getTime() - startEvent.timestamp.getTime();
            lessonDurationMinutes = Math.round(diffTime / (1000 * 60));
            
            // Calculate difference in calendar days (end - start)
            const startDate = new Date(startEvent.timestamp.getFullYear(), startEvent.timestamp.getMonth(), startEvent.timestamp.getDate());
            const endDate = new Date(endTimestamp.getFullYear(), endTimestamp.getMonth(), endTimestamp.getDate());
            const diffTimeDays = endDate.getTime() - startDate.getTime();
            durationDays = Math.floor(diffTimeDays / (1000 * 60 * 60 * 24));
          }
        }
        
        return {
          lessonId,
          isFinished: !!finishEvent || lessonQuizzes.some(q => q.isSubmitted),
          startedAt: startEvent?.timestamp.toISOString(),
          finishedAt: finishEvent?.timestamp.toISOString() || lessonQuizzes.sort((a,b) => (b.submittedAt?.localeCompare(a.submittedAt || '') || 0))[0]?.submittedAt,
          durationDays,
          lessonDurationMinutes,
          quizzes: lessonQuizzes
        };
      });

      // Course end is either explicit event OR the finish time of the last lesson
      const lastLessonFinish = lessons.filter(l => l.finishedAt).sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())[0]?.finishedAt;
      const courseEndTime = completionEvent?.timestamp || (lastLessonFinish ? new Date(lastLessonFinish) : null);

      let courseDurationMinutes: number | undefined;
      if (enrollmentEvent && courseEndTime) {
        courseDurationMinutes = Math.round((courseEndTime.getTime() - enrollmentEvent.timestamp.getTime()) / (1000 * 60));
      }

      // Calculate gaps between lessons
      const sortedLessons = [...lessons].sort((a, b) => {
        if (!a.startedAt || !b.startedAt) return 0;
        return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      });

      const firstLessonStart = sortedLessons.length > 0 ? sortedLessons[0].startedAt : null;
      let gapEnrollmentToFirstLessonMinutes: number | undefined;
      if (enrollmentEvent && firstLessonStart) {
        gapEnrollmentToFirstLessonMinutes = Math.round((new Date(firstLessonStart).getTime() - enrollmentEvent.timestamp.getTime()) / (1000 * 60));
      }

      // Active days: distinct calendar days with any event
      const activeDays = new Set(courseEvents.map(e => e.timestamp.toDateString())).size;

      const orphanQuizzes = Array.from(new Set(courseEvents.filter(e => !e.lessonId && e.quizId).map(e => e.quizId!))).map(quizId => {
        const submitEvent = courseEvents.find(e => e.quizId === quizId && e.eventType === 'quiz_submitted');
        return {
          quizId,
          isSubmitted: !!submitEvent,
          submittedAt: submitEvent?.timestamp.toISOString()
        };
      });

      return {
        courseId,
        isCompleted: !!completionEvent || (lessons.length > 0 && lessons.every(l => l.isFinished)),
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
}

export const storage = new DatabaseStorage();
