import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { api } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, BookOpen, CheckCircle2, Circle, Clock, GraduationCap, Lightbulb, Activity } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function StudentDetailsPage() {
  const { id } = useParams();
  const userId = Number(id);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  const { data: stats, isLoading } = useQuery<any>({
    queryKey: [api.events.studentStats.path, userId],
    queryFn: () => fetch(api.events.studentStats.path.replace(':id', userId.toString())).then(res => res.json())
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const formatDuration = (minutes: number | undefined) => {
    if (minutes === undefined || minutes === null || isNaN(minutes)) return "Calculating...";
    if (minutes === 0) return "< 1m";
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const getPaceStatus = (course: any) => {
    if (!course.lessons || course.lessons.length === 0) return { status: "Steady", level: "Healthy", color: "text-green-600", bg: "bg-green-500/10", border: "border-green-500/20" };
    
    let redFlags = 0;
    const reasons: string[] = [];

    // --- Rushing Criteria (3+ flags = Rushing) ---
    // 1. Lesson time < 2 min
    const veryFastLessons = course.lessons.filter((l: any) => l.isFinished && l.lessonDurationMinutes !== undefined && l.lessonDurationMinutes < 2);
    if (veryFastLessons.length > 0) {
      redFlags++;
      reasons.push(`${veryFastLessons.length} lessons < 2m`);
    }

    // 2. Quiz start gap < 30 sec (0.5 min)
    const quizzes = course.lessons.flatMap((l: any) => l.quizzes || []);
    const fastGaps = quizzes.filter((q: any) => q.gapFromLessonStartMinutes !== undefined && q.gapFromLessonStartMinutes < 0.5);
    if (fastGaps.length > 0) {
      redFlags++;
      reasons.push("Quiz started too fast");
    }

    // 3. Quiz time < 1 min
    const fastQuizzes = quizzes.filter((q: any) => q.isSubmitted && q.durationMinutes !== undefined && q.durationMinutes < 1);
    if (fastQuizzes.length > 0) {
      redFlags++;
      reasons.push("Quizzes < 1m");
    }

    // 4. 3+ lessons in < 10 min
    // Check sequences of 3 lessons
    const sortedLessons = [...course.lessons].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    let fastSequence = false;
    for (let i = 0; i <= sortedLessons.length - 3; i++) {
      const start = new Date(sortedLessons[i].startedAt).getTime();
      const end = new Date(sortedLessons[i+2].finishedAt || sortedLessons[i+2].startedAt).getTime();
      if ((end - start) < 10 * 60 * 1000) {
        fastSequence = true;
        break;
      }
    }
    if (fastSequence) {
      redFlags++;
      reasons.push("3+ lessons in < 10m");
    }

    // 5. Entire course completed in < 30 min
    if (course.isCompleted && course.durationMinutes !== undefined && course.durationMinutes < 30) {
      redFlags++;
      reasons.push("Course < 30m");
    }

    if (redFlags >= 3) {
      return {
        status: "Rushing",
        level: redFlags >= 4 ? "High Risk" : "Moderate",
        reason: reasons.join(", "),
        color: "text-destructive",
        bg: "bg-destructive/10",
        border: "border-destructive/20"
      };
    }

    // --- Engaged Criteria ---
    // - Lesson time 5–20 min
    // - Quiz time 2–10 min
    // - Activity spread across multiple days
    const engagedLessons = course.lessons.filter((l: any) => l.lessonDurationMinutes >= 5 && l.lessonDurationMinutes <= 20).length;
    const engagedQuizzes = quizzes.filter((q: any) => q.durationMinutes >= 2 && q.durationMinutes <= 10).length;
    const multiDay = (course.activeDays || 0) > 1;

    if (engagedLessons > 0 || engagedQuizzes > 0 || multiDay) {
      return {
        status: "Engaged",
        level: "Healthy",
        reason: multiDay ? "Multi-day learning" : "Good lesson depth",
        color: "text-blue-600",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20"
      };
    }

    return {
      status: "Steady",
      level: "Normal",
      color: "text-green-600",
      bg: "bg-green-500/10",
      border: "border-green-500/20"
    };
  };

  const formatDays = (days: number | undefined) => {
    if (days === undefined || days === null || isNaN(days)) return "N/A";
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-background p-6 rounded-2xl shadow-sm border">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" size="icon" className="rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">Student Profile</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <span className="text-xs text-muted-foreground font-medium">ID: #{userId}</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Activity Report</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Dialog open={isInsightsOpen} onOpenChange={setIsInsightsOpen}>
              <DialogTrigger asChild>
                <Button variant="default" className="gap-2 shadow-lg shadow-primary/20 rounded-full px-6">
                  <Lightbulb className="h-4 w-4" />
                  View Insights
                </Button>
              </DialogTrigger>
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

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="border-none bg-background shadow-sm hover:shadow-md transition-all">
                          <CardContent className="pt-6 text-center">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                              <BookOpen className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Active Days</div>
                            <div className="text-2xl font-bold text-foreground">{course.activeDays || 0}</div>
                          </CardContent>
                        </Card>
                        <Card className="border-none bg-background shadow-sm hover:shadow-md transition-all">
                          <CardContent className="pt-6 text-center">
                            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                              <Clock className="h-5 w-5 text-purple-600" />
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">First Engagement</div>
                            <div className="text-2xl font-bold text-foreground">{formatDuration(course.gapEnrollmentToFirstLessonMinutes)}</div>
                          </CardContent>
                        </Card>
                        <Card className="border-none bg-background shadow-sm hover:shadow-md transition-all">
                          <CardContent className="pt-6 text-center">
                            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Status</div>
                            <div className="text-2xl font-bold text-foreground capitalize">{course.isCompleted ? "Done" : "Active"}</div>
                          </CardContent>
                        </Card>
                        {(() => {
                          const pace = getPaceStatus(course);
                          return (
                            <Card className={`border-none ${pace.bg} shadow-sm hover:shadow-md transition-all`}>
                              <CardContent className="pt-6 text-center">
                                <div className={`h-10 w-10 rounded-lg ${pace.bg.replace('/10', '/20')} flex items-center justify-center mx-auto mb-3`}>
                                  <Activity className={`h-5 w-5 ${pace.color}`} />
                                </div>
                                <div className={`text-[10px] font-bold ${pace.color} uppercase tracking-wider mb-1`}>Pace: {pace.status}</div>
                                <div className={`text-2xl font-bold ${pace.color}`}>{pace.level}</div>
                                {pace.reason && <div className={`text-[8px] ${pace.color} opacity-70 mt-1 truncate px-2`}>{pace.reason}</div>}
                              </CardContent>
                            </Card>
                          );
                        })()}
                      </div>

                      <div className="space-y-4">
                        {course.lessons?.map((lesson: any, index: number) => {
                          const prevLesson = index > 0 ? course.lessons[index - 1] : null;
                          let gapText = null;
                          
                          if (prevLesson && prevLesson.finishedAt && lesson.startedAt) {
                            const gapMs = new Date(lesson.startedAt).getTime() - new Date(prevLesson.finishedAt).getTime();
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
                              {gapText && (
                                <div className="flex items-center gap-4 my-6">
                                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-muted to-transparent" />
                                  <span className="bg-muted px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-muted-foreground border border-muted-foreground/10 shadow-sm">
                                    {gapText}
                                  </span>
                                  <div className="flex-1 h-px bg-gradient-to-r from-muted via-transparent to-transparent" />
                                </div>
                              )}
                              
                              <Card className="border-none bg-background shadow-md hover:translate-x-1 transition-transform overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                                <CardContent className="p-6">
                                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-3">
                                        <div className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-black tracking-tighter uppercase">Lesson {lesson.lessonId}</div>
                                        <h4 className="font-bold text-lg">{formatDuration(lesson.lessonDurationMinutes)} total time</h4>
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

                                    <div className="flex flex-wrap gap-3">
                                      {lesson.quizzes?.map((q: any) => (
                                        <div key={q.quizId} className="bg-muted/30 border border-muted p-3 rounded-2xl min-w-[160px] relative overflow-hidden group">
                                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                          <div className="text-[10px] font-black text-muted-foreground/60 uppercase flex justify-between items-center mb-2">
                                            <span>Quiz {q.quizId}</span>
                                            {q.gapFromLessonStartMinutes !== undefined && (
                                              <span className="bg-background/50 px-1.5 py-0.5 rounded text-[8px]">+{formatDuration(q.gapFromLessonStartMinutes)} delay</span>
                                            )}
                                          </div>
                                          <div className="text-sm font-bold flex items-center gap-2">
                                            <div className="h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center">
                                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                                            </div>
                                            {q.isSubmitted && q.durationMinutes !== undefined && q.durationMinutes !== null && !isNaN(q.durationMinutes) ? (
                                              <span>Took {formatDuration(q.durationMinutes)}</span>
                                            ) : q.isSubmitted ? (
                                              <span>Submitted</span>
                                            ) : (
                                              <span className="text-muted-foreground italic text-xs">Still in progress or data missing</span>
                                            )}
                                          </div>
                                          {q.isSubmitted && q.submittedAt && (
                                            <div className="text-[9px] text-muted-foreground mt-2 font-semibold">
                                              Logged at {format(new Date(q.submittedAt), "HH:mm")}
                                            </div>
                                          )}
                                        </div>
                                      ))}
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

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-none shadow-sm bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Enrolled Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">{stats?.enrolledCourses}</div>
              <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '100%' }} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Completed Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">{stats?.completedCourses}</div>
              <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${(stats?.completedCourses / stats?.enrolledCourses) * 100 || 0}%` }} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Curriculum Progress</h2>
          </div>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            {stats?.courses.map((course: any) => (
              <AccordionItem key={course.courseId} value={`course-${course.courseId}`} className="border-none rounded-2xl px-6 bg-background shadow-sm overflow-hidden">
                <AccordionTrigger className="hover:no-underline py-6">
                  <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors ${course.isCompleted ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                            {course.isCompleted ? <GraduationCap className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                          </div>
                          <div className="text-left">
                            <div className="text-lg font-bold">Course {course.courseId}</div>
                            <div className="flex flex-col gap-0.5">
                              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                {course.isCompleted ? `Verified Completion • ${course.durationMinutes}m` : 'Status: Active Participation'}
                              </div>
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
                <AccordionContent className="pb-8">
                  <div className="space-y-6 pt-2">
                    {course.lessons?.map((lesson: any) => (
                      <div key={lesson.lessonId} className="border border-muted/50 rounded-2xl p-6 space-y-6 bg-muted/20 hover:bg-muted/30 transition-colors group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${lesson.isFinished ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                              {lesson.isFinished ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">Lesson {lesson.lessonId}</h3>
                              <p className="text-xs font-medium text-muted-foreground">Session breakdown & assessment results</p>
                            </div>
                          </div>
                            <div className="bg-background/80 border px-4 py-2 rounded-xl text-right shadow-sm group-hover:border-primary/30 transition-colors">
                              <div className="text-[10px] font-black text-muted-foreground uppercase mb-0.5">Timeline Info</div>
                              {lesson.startedAt ? (
                                <div className="text-xs font-bold">Started: {format(new Date(lesson.startedAt), "MMM d, HH:mm")}</div>
                              ) : (
                                <div className="text-xs font-bold text-destructive italic">Not started yet</div>
                              )}
                              {lesson.isFinished ? (
                                <div className="font-black text-primary text-xs mt-1">
                                  Completed in: {(() => {
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
                                <div className="text-[10px] text-orange-600 font-bold mt-1 uppercase">Currently In Progress</div>
                              ) : null}
                            </div>
                        </div>

                        {lesson.quizzes?.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <div className="h-px flex-1 bg-muted" />
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-2">Assessment Performance</h4>
                              <div className="h-px flex-1 bg-muted" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {lesson.quizzes?.map((quiz: any) => (
                                <div key={quiz.quizId} className="bg-background border border-muted/60 p-4 rounded-xl shadow-sm hover:border-primary/20 transition-all">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold">Quiz #{quiz.quizId}</span>
                                    {quiz.isSubmitted ? (
                                      <div className="h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center">
                                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                                      </div>
                                    ) : (
                                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                                        <Circle className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground font-semibold">
                                    {quiz.submittedAt ? `Submitted: ${format(new Date(quiz.submittedAt), "MMM d, HH:mm")}` : 'Pending evaluation'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {course.lessons?.length === 0 && course.quizzes?.length === 0 && (
                      <div className="text-center py-12 bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
                        <p className="text-sm font-bold text-muted-foreground">No participation history found</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Student has not engaged with this course content yet.</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
