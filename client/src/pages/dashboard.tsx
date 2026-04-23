import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Activity, Users, BookOpen, ChevronRight, CheckCircle2, Clock } from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: events, isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: [api.events.list.path],
  });

  const { data: students, isLoading: studentsLoading } = useQuery<any[]>({
    queryKey: [api.events.students.path],
  });

  const isLoading = eventsLoading || studentsLoading;

  const totalEvents   = events?.length ?? 0;
  const uniqueUsers   = students?.length ?? 0;
  const uniqueCourses = new Set(events?.map(e => e.courseId)).size;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">

      {/* ── Page title ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monitor student engagement and course progress
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">

        <Card className="border-none shadow-sm bg-background">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Interactions
              </span>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold">{totalEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">Events logged</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-background">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Students
              </span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold">{uniqueUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique learners tracked</p>
          </CardContent>
        </Card>

        <Card
          className="border-none shadow-sm bg-background cursor-pointer hover:shadow-md hover:border-orange-200 transition-all group"
          onClick={() => setLocation("/courses")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Courses
              </span>
              <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-orange-600" />
              </div>
            </div>
            <div className="text-3xl font-bold">{uniqueCourses}</div>
            <p className="text-xs text-orange-600 font-medium mt-1 group-hover:underline">
              View all courses →
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Student directory ────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Student Directory</h2>
            <p className="text-xs text-muted-foreground">{uniqueUsers} learners tracked</p>
          </div>
        </div>

        {/* Column headers */}
        {students && students.length > 0 && (
          <div className="grid grid-cols-12 gap-4 px-4 pb-1">
            <span className="col-span-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Student</span>
            <span className="col-span-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
            <span className="col-span-5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Courses</span>
          </div>
        )}

        <div className="space-y-2">
          {students?.map(student => {
            const allDone = student.enrolledCount > 0 && student.enrolledCount === student.completedCount;
            const inProgress = student.enrolledCount > student.completedCount;

            return (
              <Card
                key={student.userId}
                className="border-none shadow-sm bg-background hover:shadow-md transition-all cursor-pointer group"
                onClick={() => setLocation(`/student/${student.userId}`)}
                data-testid={`card-student-${student.userId}`}
              >
                <CardContent className="p-4">
                  <div className="grid grid-cols-12 gap-4 items-center">

                    {/* Student ID */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                        {student.userId}
                      </div>
                      <span className="font-semibold text-sm">Student #{student.userId}</span>
                    </div>

                    {/* Status badge */}
                    <div className="col-span-3">
                      {inProgress ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-500/10 text-green-700 border border-green-200">
                          <Clock className="h-3 w-3" /> Active
                        </span>
                      ) : allDone ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-700 border border-blue-200">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border">
                          No Activity
                        </span>
                      )}
                    </div>

                    {/* Courses progress */}
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                          <span>{student.enrolledCount} enrolled</span>
                          <span className="font-semibold text-foreground">{student.completedCount} done</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{
                              width: student.enrolledCount > 0
                                ? `${(student.completedCount / student.enrolledCount) * 100}%`
                                : "0%"
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="col-span-1 flex justify-end">
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {students?.length === 0 && (
            <Card className="border-none shadow-sm border-dashed bg-background">
              <CardContent className="py-16 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-semibold text-muted-foreground">No students yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Start logging enrollment events to see students here.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
