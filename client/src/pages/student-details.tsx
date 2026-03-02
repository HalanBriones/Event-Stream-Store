import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { api } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, BookOpen, CheckCircle2, Circle, Clock, GraduationCap, Lightbulb } from "lucide-react";
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
    if (minutes === undefined) return "N/A";
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const formatDays = (days: number | undefined) => {
    if (days === undefined) return "N/A";
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Student Details: {userId}</h1>
          </div>
          
          <Dialog open={isInsightsOpen} onOpenChange={setIsInsightsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Insights
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
              <div className="sticky top-0 bg-background z-10 p-6 border-b">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-2xl">
                    <Lightbulb className="h-6 w-6 text-yellow-500" />
                    Student Insights Breakdown
                  </DialogTitle>
                </DialogHeader>
              </div>
              
              <div className="p-6 space-y-8">
                {stats?.courses?.map((course: any) => (
                  <div key={course.courseId} className="space-y-6">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="font-bold text-xl text-primary">Course {course.courseId}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Total: {formatDuration(course.durationMinutes)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {course.lessons?.map((lesson: any, index: number) => {
                        const prevLesson = index > 0 ? course.lessons[index - 1] : null;
                        let gapText = null;
                        
                        if (prevLesson && prevLesson.finishedAt && lesson.startedAt) {
                          const gapMs = new Date(lesson.startedAt).getTime() - new Date(prevLesson.finishedAt).getTime();
                          const gapMins = Math.round(gapMs / (1000 * 60));
                          if (gapMins >= 1440) {
                            const days = Math.floor(gapMins / 1440);
                            gapText = `${days}d ${Math.floor((gapMins % 1440) / 60)}h gap`;
                          } else if (gapMins >= 60) {
                            gapText = `${Math.floor(gapMins / 60)}h ${gapMins % 60}m gap`;
                          } else {
                            gapText = `${gapMins}m gap`;
                          }
                        }

                        return (
                          <div key={lesson.lessonId} className="relative">
                            {gapText && (
                              <div className="flex justify-center my-4">
                                <span className="bg-muted px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-muted-foreground border">
                                  {gapText}
                                </span>
                              </div>
                            )}
                            
                            <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">LESSON {lesson.lessonId}</span>
                                      <h4 className="font-bold">Duration: {formatDuration(lesson.lessonDurationMinutes)}</h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {lesson.startedAt ? format(new Date(lesson.startedAt), "MMM d, HH:mm") : "N/A"} 
                                      {lesson.finishedAt && ` → ${format(new Date(lesson.finishedAt), "HH:mm")}`}
                                    </p>
                                  </div>

                          <div className="flex flex-wrap gap-2">
                                    {lesson.quizzes?.map((q: any) => (
                                      <div key={q.quizId} className="bg-secondary/50 border rounded-lg p-2 min-w-[120px]">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase">Quiz {q.quizId}</div>
                                        <div className="text-sm font-semibold flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                                          {formatDuration(q.durationMinutes)}
                                        </div>
                                        {q.isSubmitted && q.submittedAt && (
                                          <div className="text-[9px] text-muted-foreground mt-1">
                                            Sub: {format(new Date(q.submittedAt), "HH:mm")}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {(!lesson.quizzes || lesson.quizzes.length === 0) && (
                                      <span className="text-xs italic text-muted-foreground">No quizzes taken</span>
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

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Enrolled Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.enrolledCourses}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.completedCourses}</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Course Progress
          </h2>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            {stats?.courses.map((course: any) => (
              <AccordionItem key={course.courseId} value={`course-${course.courseId}`} className="border rounded-lg px-4 bg-card">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${course.isCompleted ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                        {course.isCompleted ? <GraduationCap className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                      </div>
                      <div className="text-left">
                        <div className="font-bold">Course {course.courseId}</div>
                        <div className="text-xs text-muted-foreground">
                          {course.isCompleted ? `Completed in ${course.durationMinutes} mins` : 'In Progress'}
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-6">
                  <div className="space-y-8">
                    {course.lessons?.map((lesson: any) => (
                      <div key={lesson.lessonId} className="border rounded-lg p-4 space-y-4 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            Lesson {lesson.lessonId}
                            {lesson.isFinished ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </h3>
                          <div className="text-sm text-muted-foreground text-right">
                            {lesson.startedAt ? (
                              <div>Started: {format(new Date(lesson.startedAt), "MMM d, yyyy HH:mm")}</div>
                            ) : (
                              <div className="italic text-xs">No start record</div>
                            )}
                            {lesson.isFinished && (
                              <div className="font-medium text-primary">
                                Time to finish: {lesson.durationDays > 0 ? (
                                  `${lesson.durationDays} ${lesson.durationDays === 1 ? 'day' : 'days'}`
                                ) : (
                                  lesson.durationMinutes >= 60 ? (
                                    `${Math.floor(lesson.durationMinutes / 60)}h ${lesson.durationMinutes % 60}m`
                                  ) : (
                                    `${lesson.durationMinutes}m`
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {lesson.quizzes?.length > 0 && (
                          <div className="pl-6 space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lesson Quizzes</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Quiz ID</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Submitted At</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {lesson.quizzes?.map((quiz: any) => (
                                  <TableRow key={quiz.quizId}>
                                    <TableCell className="font-medium">Quiz {quiz.quizId}</TableCell>
                                    <TableCell>
                                      {quiz.isSubmitted ? (
                                        <span className="flex items-center gap-1.5 text-green-600">
                                          <CheckCircle2 className="h-4 w-4" /> Submitted
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1.5 text-muted-foreground">
                                          <Circle className="h-4 w-4" /> Pending
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {quiz.submittedAt ? format(new Date(quiz.submittedAt), "MMM d, yyyy HH:mm") : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    ))}
                    {course.lessons?.length === 0 && course.quizzes?.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No progress recorded for this course.
                      </div>
                    )}
                    {course.quizzes?.length > 0 && (
                      <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                        <h3 className="font-semibold text-lg flex items-center gap-2 text-muted-foreground">
                          General Quizzes
                        </h3>
                        <div className="pl-6">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Quiz ID</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Submitted At</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {course.quizzes.map((quiz: any) => (
                                <TableRow key={quiz.quizId}>
                                  <TableCell className="font-medium">Quiz {quiz.quizId}</TableCell>
                                  <TableCell>
                                    {quiz.isSubmitted ? (
                                      <span className="flex items-center gap-1.5 text-green-600">
                                        <CheckCircle2 className="h-4 w-4" /> Submitted
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1.5 text-muted-foreground">
                                        <Circle className="h-4 w-4" /> Pending
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {quiz.submittedAt ? format(new Date(quiz.submittedAt), "MMM d, yyyy HH:mm") : '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
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
