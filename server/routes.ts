import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post(api.events.create.path, async (req, res) => {
    try {
      const input = api.events.create.input.parse(req.body);
      const event = await storage.createEvent(input);
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.events.list.path, async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get(api.events.students.path, async (req, res) => {
    try {
      const students = await storage.getStudentsWithStats();
      res.json(students);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  app.get(api.events.studentStats.path, async (req, res) => {
    try {
      const stats = await storage.getStudentStats(Number(req.params.id));
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch student stats" });
    }
  });

  app.get(api.events.courses.path, async (req, res) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get(api.events.courseStats.path, async (req, res) => {
    try {
      const stats = await storage.getCourseStats(Number(req.params.id));
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch course stats" });
    }
  });

  return httpServer;
}
