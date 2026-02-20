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
    
    const enrolled = new Set(studentEvents.filter(e => e.eventType === 'course_enrollment').map(e => e.courseId));
    const completed = studentEvents.filter(e => e.eventType === 'course_ended');
    
    const completionTimes = completed.map(endEvent => {
      const startEvent = studentEvents.find(e => 
        e.courseId === endEvent.courseId && 
        e.eventType === 'course_enrollment'
      );
      if (startEvent) {
        const duration = Math.round((new Date(endEvent.timestamp).getTime() - new Date(startEvent.timestamp).getTime()) / (1000 * 60));
        return { courseId: endEvent.courseId, durationMinutes: duration };
      }
      return null;
    }).filter((t): t is { courseId: number; durationMinutes: number } => t !== null);

    return {
      enrolledCourses: enrolled.size,
      completedCourses: completed.length,
      courseCompletionTimes: completionTimes
    };
  }
}

export const storage = new DatabaseStorage();
