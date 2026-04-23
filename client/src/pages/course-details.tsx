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
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen, Users, CheckCircle2, Clock,
  GraduationCap, Activity, ChevronRight, BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { PACE_TIERS, IN_PROGRESS_PACE } from "@shared/paceConfig";

// ---------------------------------------------------------------------------
// paceConfig — a label-keyed map built from the shared PACE_TIERS config.
//
// To change tiers (thresholds, names, colours), edit shared/paceConfig.ts.
// This map updates automatically — no changes needed here.
// ---------------------------------------------------------------------------
const paceConfig = Object.fromEntries(
  [...PACE_TIERS, IN_PROGRESS_PACE].map(tier => [tier.label, tier])
);

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

  // Derive counts for each pace group dynamically from PACE_TIERS + In Progress.
  // When a tier is added/removed in shared/paceConfig.ts this updates automatically.
  const allTiles = [...PACE_TIERS, IN_PROGRESS_PACE].map(tier => ({
    ...tier,
    count: stats?.students?.filter((s: any) => s.pace === tier.label).length ?? 0,
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Breadcrumb + page header ──────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Link href="/courses" className="hover:text-foreground transition-colors cursor-pointer">
              Courses
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Course {courseId}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Course {courseId}</h1>
          {stats?.lastActivityAt && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Last activity: {format(new Date(stats.lastActivityAt), "MMM d, yyyy HH:mm")}
            </p>
          )}
        </div>

        {/* ── Top stat cards ─────────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-4">

          <Card className="border border-border shadow-sm bg-background border-l-4 border-l-blue-500">
            <CardContent className="pt-5 pb-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">Enrolled</div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-3xl font-bold">{stats?.totalEnrolled ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm bg-background border-l-4 border-l-green-500">
            <CardContent className="pt-5 pb-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-1">Completed</div>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-green-500" />
                <span className="text-3xl font-bold">{stats?.totalCompleted ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm bg-background border-l-4 border-l-orange-500">
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

          <Card className="border border-border shadow-sm bg-background border-l-4 border-l-purple-500">
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
        <Card className="border border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/50 border-b border-border py-4 px-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Student Pace Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {allTiles.map(({ label, count, color, bg }) => (
                <div key={label} className={`rounded-xl border ${bg} p-3 text-center`}>
                  <div className={`text-2xl font-bold ${color}`}>{count}</div>
                  <div className={`text-[9px] font-bold uppercase tracking-wider ${color} mt-1 leading-tight`}>{label}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    {stats?.totalEnrolled > 0
                      ? Math.round((count / stats.totalEnrolled) * 100)
                      : 0
                    }%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Lesson breakdown accordion ────────────────────────────────── */}
        <Card className="border border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/50 border-b border-border py-4 px-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Lesson Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
          <Accordion type="single" collapsible className="space-y-3">
            {stats?.lessons?.map((lesson: any) => (
              <AccordionItem
                key={lesson.lessonId}
                value={`lesson-${lesson.lessonId}`}
                className="border border-border rounded-xl px-6 bg-background overflow-hidden"
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
          </CardContent>
        </Card>

        {/* ── Enrolled students list ─────────────────────────────────────── */}
        <Card className="border border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/50 border-b border-border py-4 px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Enrolled Students</CardTitle>
              </div>
              <span className="text-xs text-muted-foreground bg-background border border-border rounded-full px-2.5 py-1 font-medium">
                {stats?.students?.length ?? 0} student{(stats?.students?.length ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>
          </CardHeader>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-4 px-6 py-2.5 bg-muted/20 border-b border-border">
            <span className="col-span-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Student</span>
            <span className="col-span-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
            <span className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Duration</span>
            <span className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pace</span>
          </div>

          <div className="divide-y divide-border">
            {stats?.students?.map((student: any) => {
              const pc = paceConfig[student.pace as keyof typeof paceConfig] ?? paceConfig.Steady;

              return (
                <div
                  key={student.userId}
                  className="grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-muted/30 cursor-pointer transition-colors group"
                  onClick={() => setLocation(`/student/${student.userId}`)}
                  data-testid={`card-student-${student.userId}`}
                >
                  {/* Student identity */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                      {student.userId}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Student #{student.userId}</div>
                      {student.enrolledAt && (
                        <div className="text-xs text-muted-foreground">
                          Enrolled {format(new Date(student.enrolledAt), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-3">
                    {student.isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-500/10 text-green-700 border border-green-200">
                        <CheckCircle2 className="h-3 w-3" /> Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-500/10 text-orange-700 border border-orange-200">
                        <Clock className="h-3 w-3" /> In Progress
                      </span>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {student.durationMinutes !== undefined ? formatDuration(student.durationMinutes) : "—"}
                  </div>

                  {/* Pace badge */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${pc.badge}`}>
                      {student.pace}
                    </span>
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
    </div>
  );
}
