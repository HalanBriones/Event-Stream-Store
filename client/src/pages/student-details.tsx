/**
 * client/src/pages/student-details.tsx
 *
 * Detailed learning report for a single student.
 *
 * URL: /student/:id
 *
 * Main sections:
 *   1. Header with student ID and a "View Insights" button
 *   2. Summary cards — enrolled vs completed courses
 *   3. Curriculum Progress accordion — one panel per enrolled course,
 *      showing each lesson's timing and quiz results
 *   4. Insights modal — a richer timeline view with pace classification
 *      and inter-lesson gap indicators
 *
 * All data comes from GET /api/students/:id/stats
 */

import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { api } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, CheckCircle2, Circle, Clock, GraduationCap, Lightbulb, Activity } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { classifyPace } from "@shared/paceConfig";

export default function StudentDetailsPage() {
  const { id } = useParams();
  const userId = Number(id);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  // Fetch the full stats object for this student from the backend
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: [api.events.studentStats.path, userId],
    queryFn: () =>
      fetch(api.events.studentStats.path.replace(':id', userId.toString())).then(res => res.json()),
  });

  // Show a spinner while data is loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // formatDuration — converts a raw minute count to a human-readable string
  //
  // Examples:
  //   0        → "< 1m"
  //   45       → "45m"
  //   90       → "1h 30m"
  //   undefined → "Calculating..."
  // ---------------------------------------------------------------------------
  const formatDuration = (minutes: number | undefined) => {
    if (minutes === undefined || minutes === null || isNaN(minutes)) return "Calculating...";
    if (minutes === 0) return "< 1m";
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // ---------------------------------------------------------------------------
  // getPaceStatus — delegates to classifyPace() from shared/paceConfig.ts.
  //
  // To change thresholds, add tiers, or rename labels, edit shared/paceConfig.ts.
  // No changes are needed here.
  // ---------------------------------------------------------------------------
  const getPaceStatus = (course: any) => {
    const tier = classifyPace(course.durationMinutes, course.isCompleted);
    return {
      status: tier.label,
      level:  tier.rangeLabel,
      color:  tier.color,
      bg:     tier.bg,
      border: tier.border,
    };
  };

  // ---------------------------------------------------------------------------
  // formatDays — converts a day count to a readable label
  // ---------------------------------------------------------------------------
  const formatDays = (days: number | undefined) => {
    if (days === undefined || days === null || isNaN(days)) return "N/A";
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  // ---------------------------------------------------------------------------
  // Page render
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Breadcrumb + page header ──────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Link href="/dashboard" className="hover:text-foreground transition-colors cursor-pointer">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">Student #{userId}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Activity Report</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Student #{userId}</p>
          </div>

          {/* Insights modal trigger */}
          <div className="flex items-center gap-3 mt-1">
            <Dialog open={isInsightsOpen} onOpenChange={setIsInsightsOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  className="gap-2 shadow-lg shadow-primary/20 rounded-full px-6"
                  data-testid="button-view-insights"
                >
                  <Lightbulb className="h-4 w-4" />
                  View Insights
                </Button>
              </DialogTrigger>

              {/* ── Insights modal ─────────────────────────────────────── */}
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
                <div className="sticky top-0 bg-background/80 backdrop-blur-md z-10 p-6 border-b">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                      <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                        <Lightbulb className="h-6 w-6 text-yellow-600" />
                      </div>
                      Learning Performance Insights
                    </DialogTitle>
                  </DialogHeader>
                </div>

                <div className="p-6 space-y-12">
                  {stats?.courses?.map((course: any) => (
                    <div key={course.courseId} className="space-y-6">

                      {/* Course heading row */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-muted pb-4">
                        <div>
                          <h3 className="font-bold text-2xl text-primary">Course {course.courseId}</h3>
                          <p className="text-sm text-muted-foreground italic">Comprehensive timeline breakdown</p>
                        </div>
                        <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full text-sm font-semibold">
                          <Clock className="h-4 w-4 text-primary" />
                          <span>Investment: {formatDuration(course.durationMinutes)}</span>
                        </div>
                      </div>

                      {/* Four mini stat cards: Active Days / First Engagement / Status / Pace */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="border-none bg-background shadow-sm hover:shadow-md transition-all">
                          <CardContent className="pt-6 text-center">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                              <BookOpen className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                              Active Days
                            </div>
                            <div className="text-2xl font-bold text-foreground">{course.activeDays || 0}</div>
                          </CardContent>
                        </Card>

                        <Card className="border-none bg-background shadow-sm hover:shadow-md transition-all">
                          <CardContent className="pt-6 text-center">
                            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                              <Clock className="h-5 w-5 text-purple-600" />
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                              First Engagement
                            </div>
                            {/* Time between enrollment and first lesson start */}
                            <div className="text-2xl font-bold text-foreground">
                              {formatDuration(course.gapEnrollmentToFirstLessonMinutes)}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-none bg-background shadow-sm hover:shadow-md transition-all">
                          <CardContent className="pt-6 text-center">
                            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                              Status
                            </div>
                            <div className="text-2xl font-bold text-foreground capitalize">
                              {course.isCompleted ? "Done" : "Active"}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Pace card — colour-coded by classification */}
                        {(() => {
                          const pace = getPaceStatus(course);
                          return (
                            <Card className={`border-none ${pace.bg} shadow-sm hover:shadow-md transition-all`}>
                              <CardContent className="pt-6 text-center">
                                <div className={`h-10 w-10 rounded-lg ${pace.bg.replace('/10', '/20')} flex items-center justify-center mx-auto mb-3`}>
                                  <Activity className={`h-5 w-5 ${pace.color}`} />
                                </div>
                                <div className={`text-[10px] font-bold ${pace.color} uppercase tracking-wider mb-1`}>
                                  Pace: {pace.status}
                                </div>
                                <div className={`text-2xl font-bold ${pace.color}`}>{pace.level}</div>
                                {pace.reason && (
                                  <div className={`text-[8px] ${pace.color} opacity-70 mt-1 truncate px-2`}>
                                    {pace.reason}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })()}
                      </div>

                      {/* Lesson timeline — with inter-lesson gap labels */}
                      <div className="space-y-4">
                        {course.lessons?.map((lesson: any, index: number) => {
                          const prevLesson = index > 0 ? course.lessons[index - 1] : null;

                          // Calculate the gap between the previous lesson's end and this lesson's start
                          let gapText = null;
                          if (prevLesson && prevLesson.finishedAt && lesson.startedAt) {
                            const gapMs   = new Date(lesson.startedAt).getTime() - new Date(prevLesson.finishedAt).getTime();
                            const gapMins = Math.round(gapMs / (1000 * 60));

                            if (gapMins >= 1440) {
                              const days = Math.floor(gapMins / 1440);
                              gapText = `${days}d ${Math.floor((gapMins % 1440) / 60)}h pause`;
                            } else if (gapMins >= 60) {
                              gapText = `${Math.floor(gapMins / 60)}h ${gapMins % 60}m pause`;
                            } else {
                              gapText = `${gapMins}m pause`;
                            }
                          }

                          return (
                            <div key={lesson.lessonId} className="relative">
                              {/* Gap badge rendered between consecutive lessons */}
                              {gapText && (
                                <div className="flex items-center gap-4 my-6">
                                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-muted to-transparent" />
                                  <span className="bg-muted px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-muted-foreground border border-muted-foreground/10 shadow-sm">
                                    {gapText}
                                  </span>
                                  <div className="flex-1 h-px bg-gradient-to-r from-muted via-transparent to-transparent" />
                                </div>
                              )}

                              {/* Lesson card */}
                              <Card className="border-none bg-background shadow-md hover:translate-x-1 transition-transform overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                                <CardContent className="p-6">
                                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-3">
                                        <div className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-black tracking-tighter uppercase">
                                          Lesson {lesson.lessonId}
                                        </div>
                                        <h4 className="font-bold text-lg">
                                          {formatDuration(lesson.lessonDurationMinutes)} total time
                                        </h4>
                                      </div>
                                      <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                          Started: {lesson.startedAt ? format(new Date(lesson.startedAt), "MMM d, HH:mm") : "N/A"}
                                        </div>
                                        {lesson.finishedAt && (
                                          <div className="flex items-center gap-1.5">
                                            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                            Ended: {format(new Date(lesson.finishedAt), "MMM d, HH:mm")}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Quiz results for this lesson */}
                                    <div className="flex flex-wrap gap-3">
                                      {lesson.quizzes?.map((q: any) => (
                                        <div
                                          key={q.quizId}
                                          className="bg-muted/30 border border-muted p-3 rounded-2xl min-w-[160px] relative overflow-hidden group"
                                        >
                                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                          <div className="text-[10px] font-black text-muted-foreground/60 uppercase flex justify-between items-center mb-2">
                                            <span>Quiz {q.quizId}</span>
                                            {/* Delay badge: how long after lesson start the quiz was opened */}
                                            {q.gapFromLessonStartMinutes !== undefined && (
                                              <span className="bg-background/50 px-1.5 py-0.5 rounded text-[8px]">
                                                +{formatDuration(q.gapFromLessonStartMinutes)} delay
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-sm font-bold flex items-center gap-2">
                                            <div className="h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center">
                                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                                            </div>
                                            {/* Show duration if available, otherwise just "Submitted" */}
                                            {q.isSubmitted && q.durationMinutes !== undefined && q.durationMinutes !== null && !isNaN(q.durationMinutes) ? (
                                              <span>Took {formatDuration(q.durationMinutes)}</span>
                                            ) : q.isSubmitted ? (
                                              <span>Submitted</span>
                                            ) : (
                                              <span className="text-muted-foreground italic text-xs">
                                                Still in progress or data missing
                                              </span>
                                            )}
                                          </div>
                                          {q.isSubmitted && q.submittedAt && (
                                            <div className="text-[9px] text-muted-foreground mt-2 font-semibold">
                                              Logged at {format(new Date(q.submittedAt), "HH:mm")}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                      {/* No quizzes for this lesson */}
                                      {(!lesson.quizzes || lesson.quizzes.length === 0) && (
                                        <div className="text-xs font-medium text-muted-foreground/50 border-2 border-dashed border-muted rounded-2xl p-4 w-full text-center">
                                          No assessments recorded for this session
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── Summary stat cards ─────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border border-border shadow-sm bg-background border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Enrolled Courses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">{stats?.enrolledCourses}</div>
              <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '100%' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm bg-background border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Completed Courses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">{stats?.completedCourses}</div>
              <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${(stats?.completedCourses / stats?.enrolledCourses) * 100 || 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Curriculum Progress accordion ──────────────────────────────── */}
        <Card className="border border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/50 border-b border-border py-4 px-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Curriculum Progress</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {stats?.courses.map((course: any) => (
              <AccordionItem
                key={course.courseId}
                value={`course-${course.courseId}`}
                className="border border-border rounded-xl px-6 bg-background overflow-hidden"
              >
                {/* Course row header */}
                <AccordionTrigger className="hover:no-underline py-6">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-4">
                      {/* Icon changes based on completion */}
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors ${
                        course.isCompleted ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {course.isCompleted
                          ? <GraduationCap className="h-6 w-6" />
                          : <Clock className="h-6 w-6" />
                        }
                      </div>
                      <div className="text-left">
                        <div className="text-lg font-bold">Course {course.courseId}</div>
                        <div className="flex flex-col gap-0.5">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                            {course.isCompleted
                              ? `Verified Completion • ${course.durationMinutes}m`
                              : 'Status: Active Participation'
                            }
                          </div>
                          {/* Enrollment date */}
                          {course.enrolledAt && (
                            <div className="text-[10px] font-medium text-muted-foreground/70">
                              Enrolled on {format(new Date(course.enrolledAt), "MMM d, yyyy HH:mm")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                {/* Expanded lesson list for this course */}
                <AccordionContent className="pb-6">
                  {/* Column labels */}
                  {course.lessons?.length > 0 && (
                    <div className="grid grid-cols-[1fr_auto] gap-4 px-2 py-2 border-b border-border mb-0">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lesson</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-2">Timeline</span>
                    </div>
                  )}

                  <div className="divide-y divide-border">
                    {course.lessons?.map((lesson: any) => (
                      <div key={lesson.lessonId} className="hover:bg-muted/30 transition-colors">
                        {/* Lesson header row */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                              lesson.isFinished
                                ? 'bg-green-500/10 text-green-600'
                                : lesson.startedAt
                                ? 'bg-orange-500/10 text-orange-600'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {lesson.isFinished
                                ? <CheckCircle2 className="h-4 w-4" />
                                : <Circle className="h-4 w-4" />
                              }
                            </div>
                            <div>
                              <div className="font-semibold text-sm">Lesson {lesson.lessonId}</div>
                              <div className={`text-[10px] font-medium ${
                                lesson.isFinished
                                  ? 'text-green-600'
                                  : lesson.startedAt
                                  ? 'text-orange-600 font-bold uppercase'
                                  : 'text-muted-foreground'
                              }`}>
                                {lesson.isFinished ? 'Completed' : lesson.startedAt ? 'In Progress' : 'Not started'}
                              </div>
                            </div>
                          </div>

                          {/* Timeline info */}
                          <div className="text-right">
                            {lesson.startedAt ? (
                              <div className="text-xs font-semibold">
                                Started: {format(new Date(lesson.startedAt), "MMM d, HH:mm")}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground italic">Not started yet</div>
                            )}
                            {lesson.isFinished ? (
                              <div className="text-xs font-bold text-primary mt-0.5">
                                Duration: {(() => {
                                  const mins = lesson.lessonDurationMinutes;
                                  const days = lesson.durationDays;
                                  const finalMins = (mins !== undefined && mins !== null && !isNaN(mins)) ? mins : 0;
                                  if (days > 0) {
                                    const h = Math.floor((finalMins % 1440) / 60);
                                    const m = finalMins % 60;
                                    return `${days}d ${h}h ${m}m`;
                                  }
                                  if (finalMins >= 60) return `${Math.floor(finalMins / 60)}h ${finalMins % 60}m`;
                                  return `${finalMins}m`;
                                })()}
                              </div>
                            ) : lesson.startedAt ? (
                              <div className="text-[10px] text-orange-600 font-bold mt-0.5 uppercase">In Progress</div>
                            ) : null}
                          </div>
                        </div>

                        {/* Quiz results — subsection with its own header */}
                        {lesson.quizzes?.length > 0 && (
                          <div className="mx-2 mb-4 border border-border rounded-lg overflow-hidden">
                            <div className="bg-muted/50 border-b border-border px-4 py-2 flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Assessment Results
                              </span>
                            </div>
                            <div className="divide-y divide-border">
                              {lesson.quizzes?.map((quiz: any) => (
                                <div
                                  key={quiz.quizId}
                                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold">Quiz #{quiz.quizId}</span>
                                    {quiz.attempts !== null && quiz.attempts !== undefined && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-600 border border-orange-200">
                                        {quiz.attempts} attempt{quiz.attempts !== 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">
                                      {quiz.submittedAt
                                        ? `Submitted ${format(new Date(quiz.submittedAt), "MMM d, HH:mm")}`
                                        : 'Pending evaluation'
                                      }
                                    </span>
                                    {quiz.isSubmitted ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Empty state */}
                    {course.lessons?.length === 0 && course.quizzes?.length === 0 && (
                      <div className="text-center py-10 text-muted-foreground">
                        <p className="text-sm font-semibold">No participation history found</p>
                        <p className="text-xs mt-1 text-muted-foreground/60">Student has not engaged with this course content yet.</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          </CardContent>
        </Card>
    </div>
  );
}
