/**
 * server/routes.ts
 *
 * Registers all HTTP routes on the Express app.
 *
 * Design principles followed here:
 *   - Routes are "thin" — they validate input and delegate all logic to storage.ts
 *   - Every route returns a consistent JSON structure (data or { message })
 *   - Path strings come from shared/routes.ts so they never drift out of sync
 *     with the frontend
 */

import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

/**
 * Attaches all API route handlers to the Express application.
 *
 * @param httpServer - The raw Node HTTP server (returned unchanged)
 * @param app        - The Express application instance
 * @returns The same httpServer, for chaining in server/index.ts
 */
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── POST /api/events ────────────────────────────────────────────────────
  // Accepts a learning event from an external platform and stores it.
  // The request body is validated against the Zod schema before touching the DB.
  app.post(api.events.create.path, async (req, res) => {
    try {
      // Validate the incoming payload — throws ZodError if invalid
      const input = api.events.create.input.parse(req.body);
      const event = await storage.createEvent(input);
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Return the first validation error with the field name so the caller
        // knows exactly what to fix
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err; // unexpected errors bubble up to Express's error handler
    }
  });

  // ── GET /api/events ─────────────────────────────────────────────────────
  // Returns every event in the database, ordered by timestamp ascending.
  // Used by the dashboard to compute summary statistics on the client side.
  app.get(api.events.list.path, async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // ── GET /api/students ────────────────────────────────────────────────────
  // Returns a list of all students with high-level enrollment/completion counts.
  // Used by the dashboard student table.
  app.get(api.events.students.path, async (req, res) => {
    try {
      const students = await storage.getStudentsWithStats();
      res.json(students);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  // ── GET /api/students/:id/stats ──────────────────────────────────────────
  // Returns a full breakdown for a single student: courses, lessons, quizzes,
  // timing data, and pace signals. :id is the numeric userId.
  app.get(api.events.studentStats.path, async (req, res) => {
    try {
      const stats = await storage.getStudentStats(Number(req.params.id));
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch student stats" });
    }
  });

  // ── GET /api/courses ─────────────────────────────────────────────────────
  // Returns a summary row for every course that has at least one enrollment
  // event. Includes completion rates and lesson counts.
  app.get(api.events.courses.path, async (req, res) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  // ── GET /api/courses/:id/stats ───────────────────────────────────────────
  // Returns deep analytics for a single course: per-lesson and per-quiz
  // aggregates across all enrolled students, plus individual student pace labels.
  // :id is the numeric courseId.
  app.get(api.events.courseStats.path, async (req, res) => {
    try {
      const stats = await storage.getCourseStats(Number(req.params.id));
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch course stats" });
    }
  });

  // ── TEMPORARY: DELETE /api/admin/clear-events ────────────────────────────
  // One-time use: wipes all rows from the events table in production.
  // REMOVE THIS ENDPOINT after use.
  app.delete("/api/admin/clear-events", async (req, res) => {
    try {
      await storage.clearAllEvents();
      res.json({ message: "All events cleared." });
    } catch (err) {
      res.status(500).json({ message: "Failed to clear events" });
    }
  });

  return httpServer;
}
