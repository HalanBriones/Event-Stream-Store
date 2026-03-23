/**
 * client/src/pages/dashboard.tsx
 *
 * Main analytics dashboard — the first screen educators see after logging in.
 *
 * Displays:
 *   - Three summary stat cards (total events, active students, courses offered)
 *   - A student directory table with enrollment counts and a link to each
 *     student's detailed report
 *
 * The "Courses Offered" card links to /courses for the course-level view.
 * Each row in the student table links to /student/:id for the per-student view.
 *
 * Data sources:
 *   GET /api/events  — used to count total interactions and distinct courses
 *   GET /api/students — provides the student list with completion counts
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, LayoutDashboard, Database, Activity, Users, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// StudentDetail — inline modal (legacy/debug component)
//
// This lightweight modal was the original way to inspect a student's stats
// before the full Student Details page was built. It is still rendered by
// the dashboard but is superseded by the dedicated /student/:id route.
// ---------------------------------------------------------------------------
function StudentDetail({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: [api.events.studentStats.path, userId],
    queryFn: () =>
      fetch(api.events.studentStats.path.replace(':id', userId.toString())).then(res => res.json()),
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Student Details - ID: {userId}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center">Loading stats...</div>
        ) : (
          <div className="space-y-6">
            {/* High-level counts */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Enrolled Courses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.enrolledCourses}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Completed Courses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.completedCourses}</div>
                </CardContent>
              </Card>
            </div>

            {/* Course completion time table */}
            <div>
              <h3 className="font-semibold mb-2">Course Completion Times</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course ID</TableHead>
                    <TableHead>Time to Finish</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.courseCompletionTimes.map((t: any) => (
                    <TableRow key={t.courseId}>
                      <TableCell>Course {t.courseId}</TableCell>
                      <TableCell>{t.durationMinutes} minutes</TableCell>
                    </TableRow>
                  ))}
                  {stats?.courseCompletionTimes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        No completions recorded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useLocation } from "wouter";

// ---------------------------------------------------------------------------
// Dashboard — main export
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);

  // Fetch all events to derive the "Total Interactions" and "Courses Offered" counts
  const { data: events, isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: [api.events.list.path],
  });

  // Fetch the student list for the directory table
  const { data: students, isLoading: studentsLoading } = useQuery<any[]>({
    queryKey: [api.events.students.path],
  });

  const isLoading = eventsLoading || studentsLoading;

  // Derived summary stats
  const totalEvents   = events?.length || 0;
  const uniqueUsers   = students?.length || 0;
  // Count distinct courseIds seen across all events (includes non-enrollment events)
  const uniqueCourses = new Set(events?.map((e) => e.courseId)).size;

  // Show a full-page spinner while the initial data loads
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" className="rounded-full shadow-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                Student Analytics
              </h1>
              <p className="text-muted-foreground">Monitor student engagement and course progress</p>
            </div>
          </div>
          {/* Live status indicator */}
          <div className="flex items-center gap-2 text-sm font-medium bg-background border px-4 py-2 rounded-full shadow-sm">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            System Live
          </div>
        </div>

        {/* ── Summary stat cards ──────────────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-3">

          {/* Total events ingested */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">
                Total Interactions
              </CardTitle>
              <Activity className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalEvents}</div>
              <p className="text-xs text-muted-foreground mt-1">Total system events logged</p>
            </CardContent>
          </Card>

          {/* Unique students */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-blue-600">
                Active Students
              </CardTitle>
              <Users className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{uniqueUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">Unique learners tracked</p>
            </CardContent>
          </Card>

          {/* Courses — clicking navigates to the full courses list */}
          <Link href="/courses">
            <Card className="border-none shadow-sm bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-orange-600">
                  Courses Offered
                </CardTitle>
                <Database className="h-5 w-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{uniqueCourses}</div>
                <p className="text-xs text-muted-foreground mt-1">Click to explore courses →</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* ── Student directory table ──────────────────────────────────── */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-background border-b py-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Student Directory</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage and view detailed reports for each student
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[100px] font-bold">Student ID</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Enrollments</TableHead>
                  <TableHead className="text-right font-bold">Report</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students?.map((student) => (
                  <TableRow key={student.userId} className="group transition-colors">

                    {/* Student ID with avatar circle */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {student.userId}
                        </div>
                        <span>#{student.userId}</span>
                      </div>
                    </TableCell>

                    {/* Active = has at least one course still in progress */}
                    <TableCell>
                      {student.enrolledCount > student.completedCount ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                          No Active Courses
                        </span>
                      )}
                    </TableCell>

                    {/* Enrollment count with a small progress bar */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {student.enrolledCount} {student.enrolledCount === 1 ? 'Course' : 'Courses'}
                        </span>
                        <div className="w-24 h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                          {/* Each course = 20% of the bar, capped at 100% */}
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(student.enrolledCount * 20, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>

                    {/* Navigate to the full student details page */}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-all rounded-full"
                        onClick={() => setLocation(`/student/${student.userId}`)}
                        data-testid={`button-student-details-${student.userId}`}
                      >
                        Details
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Empty state */}
                {students?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No students found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
