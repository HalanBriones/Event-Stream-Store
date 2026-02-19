import { events, type InsertEvent, type Event } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  createEvent(event: InsertEvent): Promise<Event>;
  getEvents(): Promise<Event[]>;
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

  async getStudentStats(userId: number) {
    const studentEvents = await db.select().from(events).where(eq(events.userId, userId));
    
    const enrolled = new Set(studentEvents.filter(e => e.eventType === 'course enrollment').map(e => e.courseId));
    const completed = studentEvents.filter(e => e.eventType === 'course ended');
    
    const completionTimes = completed.map(endEvent => {
      const startEvent = studentEvents.find(e => 
        e.courseId === endEvent.courseId && 
        e.eventType === 'course enrollment'
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
