/**
 * client/src/pages/courses.tsx
 *
 * Course catalog page — lists every course in the system with high-level stats.
 *
 * URL: /courses
 *
 * Accessible from:
 *   - The "Courses Offered" stat card on the dashboard (/dashboard)
 *
 * Displays:
 *   - Three summary cards: total courses, total enrollments, total completions
 *   - A scrollable list of course cards, each showing enrolled/completed counts
 *     and a colour-coded completion rate bar
 *
 * Clicking a course card navigates to /course/:id for detailed analytics.
 *
 * Data source: GET /api/courses
 */

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@shared/routes";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Users, CheckCircle2, Clock, ChevronRight, GraduationCap } from "lucide-react";
import { format } from "date-fns";

export default function CoursesPage() {
  const [, setLocation] = useLocation();

  // Fetch the high-level course list from the backend
  const { data: courses, isLoading } = useQuery<any[]>({
    queryKey: [api.events.courses.path],
    queryFn: () => fetch(api.events.courses.path).then(res => res.json()),
  });

  // Show a spinner while waiting for the API response
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto">

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {courses?.length ?? 0} courses in the system
          </p>
        </div>

        {/* ── Summary stat cards ─────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-3">

          {/* Total number of distinct courses */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Total Courses</div>
                  <div className="text-2xl font-bold">{courses?.length ?? 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sum of enrollments across all courses */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Total Enrollments</div>
                  <div className="text-2xl font-bold">
                    {courses?.reduce((sum, c) => sum + c.totalEnrolled, 0) ?? 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sum of completions across all courses */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-green-600">Total Completions</div>
                  <div className="text-2xl font-bold">
                    {courses?.reduce((sum, c) => sum + c.totalCompleted, 0) ?? 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Course list ──────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {courses?.map((course) => (
            // Each course card is a button so the whole area is clickable
            <button
              key={course.courseId}
              onClick={() => setLocation(`/course/${course.courseId}`)}
              className="w-full text-left group"
              data-testid={`card-course-${course.courseId}`}
            >
              <Card className="border-none shadow-sm bg-background hover:shadow-md hover:translate-x-1 transition-all duration-200 overflow-hidden">
                {/* Colour accent bar on the left edge */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-400 rounded-l-2xl group-hover:bg-primary transition-colors" />
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                    {/* Course identity */}
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <BookOpen className="h-6 w-6 text-orange-600 group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Course {course.courseId}</h2>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {course.totalLessons} {course.totalLessons === 1 ? 'Lesson' : 'Lessons'}
                          </span>
                          {course.lastActivityAt && (
                            <span>
                              Last activity {format(new Date(course.lastActivityAt), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats row: enrolled / completed / completion rate */}
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Enrolled
                        </div>
                        <div className="flex items-center gap-1.5 justify-center">
                          <Users className="h-4 w-4 text-blue-500" />
                          <span className="text-lg font-bold">{course.totalEnrolled}</span>
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Completed
                        </div>
                        <div className="flex items-center gap-1.5 justify-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-lg font-bold">{course.totalCompleted}</span>
                        </div>
                      </div>

                      {/* Colour-coded completion bar: green ≥70%, orange ≥40%, red <40% */}
                      <div className="min-w-[80px]">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Completion
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${course.completionRate}%`,
                                background:
                                  course.completionRate >= 70 ? '#22c55e' :
                                  course.completionRate >= 40 ? '#f97316' : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold w-10 text-right">{course.completionRate}%</span>
                        </div>
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}

          {/* Empty state — shown when no enrollment events exist yet */}
          {courses?.length === 0 && (
            <div className="text-center py-16 bg-background rounded-2xl border border-dashed">
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-bold text-muted-foreground">No courses found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Start logging enrollment events to see courses here.
              </p>
            </div>
          )}
        </div>
    </div>
  );
}
