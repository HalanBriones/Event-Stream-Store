import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { api } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, BookOpen, CheckCircle2, Circle, Clock, GraduationCap } from "lucide-react";
import { format } from "date-fns";

export default function StudentDetailsPage() {
  const { id } = useParams();
  const userId = Number(id);

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

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Student Details: {userId}</h1>
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
                          {lesson.isFinished && (
                            <div className="text-sm text-muted-foreground text-right">
                              <div>Finished: {format(new Date(lesson.finishedAt), "MMM d, yyyy HH:mm")}</div>
                              <div className="font-medium text-primary">Time to finish: {lesson.durationDays || 0} {lesson.durationDays === 1 ? 'day' : 'days'}</div>
                            </div>
                          )}
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
