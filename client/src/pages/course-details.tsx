/**
 * client/src/pages/course-details.tsx
 *
 * Deep analytics page for a single course.
 *
 * URL: /course/:id
 *
 * Accessible from:
 *   - The course list page (/courses) — clicking any course card
 *
 * Displays:
 *   1. Four top stat cards: enrolled, completed, completion rate, avg duration
 *   2. Student pace breakdown: Engaged / Steady / Rushing counts
 *   3. Lesson breakdown accordion — per-lesson completion rates, average times,
 *      and per-quiz submission stats
 *   4. Enrolled students list — each student with their pace label and a link
 *      to their individual student details page
 *
 * Data source: GET /api/courses/:id/stats
 */

import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { api } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft, BookOpen, Users, CheckCircle2, Clock,
  GraduationCap, Activity, ChevronRight, BarChart3,
} from "lucide-react";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Visual configuration for each pace level
// ---------------------------------------------------------------------------
const paceConfig = {
  Rushing: {
    color:  "text-destructive",
    bg:     "bg-destructive/10",
    badge:  "bg-destructive/10 text-destructive border-destructive/20",
  },
  Engaged: {
    color:  "text-blue-600",
    bg:     "bg-blue-500/10",
    badge:  "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  Steady: {
    color:  "text-green-600",
    bg:     "bg-green-500/10",
    badge:  "bg-green-500/10 text-green-700 border-green-500/20",
  },
};

// ---------------------------------------------------------------------------
// formatDuration — converts a minute count to a human-readable label
//
// Examples: 0 → "< 1m", 45 → "45m", 90 → "1h 30m", undefined → "N/A"
// ---------------------------------------------------------------------------
function formatDuration(minutes: number | undefined) {
  if (minutes === undefined || minutes === null || isNaN(minutes)) return "N/A";
  if (minutes === 0) return "< 1m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// CourseDetailsPage — main component
// ---------------------------------------------------------------------------
export default function CourseDetailsPage() {
  const { id } = useParams();
  const courseId = Number(id);
  const [, setLocation] = useLocation();

  // Fetch deep analytics for this course
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: [api.events.courseStats.path, courseId],
    queryFn: () =>
      fetch(api.events.courseStats.path.replace(':id', courseId.toString())).then(res => res.json()),
  });

  // Show a spinner while the request is in flight
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Derive counts for each pace group from the students array
  const rushingCount = stats?.students?.filter((s: any) => s.pace === 'Rushing').length ?? 0;
  const engagedCount = stats?.students?.filter((s: any) => s.pace === 'Engaged').length ?? 0;
  const steadyCount  = stats?.students?.filter((s: any) => s.pace === 'Steady').length ?? 0;

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-background p-6 rounded-2xl shadow-sm border">
          <div className="flex items-center gap-4">
            <Link href="/courses">
              <Button variant="outline" size="icon" className="rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 text-[10px] font-bold uppercase tracking-wider">
                  Course Insights
                </span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <span className="text-xs text-muted-foreground font-medium">ID: #{courseId}</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Course {courseId}</h1>
              {stats?.lastActivityAt && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Last activity: {format(new Date(stats.lastActivityAt), "MMM d, yyyy HH:mm")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Top stat cards ─────────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-4">

          <Card className="border-none shadow-sm bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
            <CardContent className="pt-5 pb-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">Enrolled</div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-3xl font-bold">{stats?.totalEnrolled ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent">
            <CardContent className="pt-5 pb-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-1">Completed</div>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-green-500" />
                <span className="text-3xl font-bold">{stats?.totalCompleted ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Completion rate with a colour-coded progress bar */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent">
            <CardContent className="pt-5 pb-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-1">Completion Rate</div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-orange-500" />
                <span className="text-3xl font-bold">{stats?.completionRate ?? 0}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${stats?.completionRate ?? 0}%`,
                    background:
                      (stats?.completionRate ?? 0) >= 70 ? '#22c55e' :
                      (stats?.completionRate ?? 0) >= 40 ? '#f97316' : '#ef4444',
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Average duration — computed only over students who finished */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent">
            <CardContent className="pt-5 pb-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-1">Avg Duration</div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                <span className="text-3xl font-bold">{formatDuration(stats?.avgDurationMinutes)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Student pace breakdown ─────────────────────────────────────── */}
        <Card className="border-none shadow-sm bg-background">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-bold">Student Pace Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {/* Three tiles: one per pace category */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Engaged", count: engagedCount, ...paceConfig.Engaged },
                { label: "Steady",  count: steadyCount,  ...paceConfig.Steady  },
                { label: "Rushing", count: rushingCount, ...paceConfig.Rushing },
              ].map(({ label, count, color, bg }) => (
                <div key={label} className={`rounded-2xl ${bg} p-4 text-center`}>
                  <div className={`text-3xl font-bold ${color}`}>{count}</div>
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${color} mt-1`}>{label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {/* Show percentage of total enrolled students */}
                    {stats?.totalEnrolled > 0
                      ? Math.round((count / stats.totalEnrolled) * 100)
                      : 0
                    }% of students
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Lesson breakdown accordion ────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Lesson Breakdown</h2>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {stats?.lessons?.map((lesson: any) => (
              <AccordionItem
                key={lesson.lessonId}
                value={`lesson-${lesson.lessonId}`}
                className="border-none rounded-2xl px-6 bg-background shadow-sm overflow-hidden"
              >
                {/* Lesson summary row */}
                <AccordionTrigger className="hover:no-underline py-5">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      {/* Lesson ID badge */}
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {lesson.lessonId}
                      </div>
                      <div className="text-left">
                        <div className="font-bold">Lesson {lesson.lessonId}</div>
                        <div className="text-xs text-muted-foreground">
                          Avg time: {formatDuration(lesson.avgDurationMinutes)}
                        </div>
                      </div>
                    </div>

                    {/* Aggregate stats: started / finished / completion rate */}
                    <div className="flex items-center gap-6 mr-2">
                      <div className="text-center hidden md:block">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Started</div>
                        <div className="text-lg font-bold">{lesson.totalStarted}</div>
                      </div>
                      <div className="text-center hidden md:block">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Finished</div>
                        <div className="text-lg font-bold text-green-600">{lesson.totalFinished}</div>
                      </div>
                      {/* Colour-coded completion bar */}
                      <div className="min-w-[90px]">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Completion
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${lesson.completionRate}%`,
                                background:
                                  lesson.completionRate >= 70 ? '#22c55e' :
                                  lesson.completionRate >= 40 ? '#f97316' : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold">{lesson.completionRate}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                {/* Expanded quiz stats for this lesson */}
                <AccordionContent className="pb-6">
                  {lesson.quizzes?.length > 0 ? (
                    <div className="space-y-3 pt-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">
                        Quizzes
                      </div>
                      {lesson.quizzes.map((quiz: any) => (
                        <div
                          key={quiz.quizId}
                          className="bg-muted/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="font-bold text-sm">Quiz {quiz.quizId}</div>
                            <div className="text-xs text-muted-foreground">
                              Avg completion time: {formatDuration(quiz.avgDurationMinutes)}
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <div className="text-[10px] font-bold uppercase text-muted-foreground">Started</div>
                              <div className="font-bold">{quiz.totalStarted}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-[10px] font-bold uppercase text-muted-foreground">Submitted</div>
                              <div className="font-bold text-green-600">{quiz.totalSubmitted}</div>
                            </div>
                            {/* Submission rate bar */}
                            <div className="min-w-[80px]">
                              <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                                Submit Rate
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${quiz.submissionRate}%`,
                                      background:
                                        quiz.submissionRate >= 70 ? '#22c55e' :
                                        quiz.submissionRate >= 40 ? '#f97316' : '#ef4444',
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-bold">{quiz.submissionRate}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 pt-2">
                      No quizzes recorded for this lesson.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* ── Enrolled students list ─────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold">Enrolled Students</h2>
          </div>

          <div className="space-y-3">
            {stats?.students?.map((student: any) => {
              // Look up the colour config for this student's pace label
              const pc = paceConfig[student.pace as keyof typeof paceConfig] ?? paceConfig.Steady;

              return (
                // Clicking a student row navigates to their full details page
                <button
                  key={student.userId}
                  onClick={() => setLocation(`/student/${student.userId}`)}
                  className="w-full text-left group"
                  data-testid={`card-student-${student.userId}`}
                >
                  <Card className="border-none shadow-sm bg-background hover:shadow-md hover:translate-x-0.5 transition-all overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">

                        {/* Student identity */}
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {student.userId}
                          </div>
                          <div>
                            <div className="font-bold">Student #{student.userId}</div>
                            {student.enrolledAt && (
                              <div className="text-xs text-muted-foreground">
                                Enrolled {format(new Date(student.enrolledAt), "MMM d, yyyy HH:mm")}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status, duration, and pace badge */}
                        <div className="flex items-center gap-4">
                          {/* Completion status */}
                          <div className="hidden md:flex items-center gap-1.5">
                            {student.isCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-orange-500" />
                            )}
                            <span className={`text-xs font-semibold ${student.isCompleted ? 'text-green-600' : 'text-orange-600'}`}>
                              {student.isCompleted ? 'Completed' : 'In Progress'}
                            </span>
                          </div>

                          {/* Total time spent in the course */}
                          {student.durationMinutes !== undefined && (
                            <div className="text-xs text-muted-foreground hidden md:block">
                              {formatDuration(student.durationMinutes)}
                            </div>
                          )}

                          {/* Colour-coded pace badge */}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${pc.badge}`}>
                            {student.pace}
                          </span>

                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
