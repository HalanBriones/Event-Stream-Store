import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, CheckCircle2, Clock, ChevronRight, GraduationCap } from "lucide-react";
import { format } from "date-fns";

export default function CoursesPage() {
  const [, setLocation] = useLocation();

  const { data: courses, isLoading } = useQuery<any[]>({
    queryKey: [api.events.courses.path],
    queryFn: () => fetch(api.events.courses.path).then(res => res.json()),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

      {/* ── Page title ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Courses Offered</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {courses?.length ?? 0} courses in the system
        </p>
      </div>

      {/* ── Summary stat cards ─────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">

        <Card className="border border-border shadow-sm bg-background border-l-4 border-l-orange-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Courses</span>
              <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-orange-600" />
              </div>
            </div>
            <div className="text-3xl font-bold">{courses?.length ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-background border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Enrollments</span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold">
              {courses?.reduce((sum, c) => sum + c.totalEnrolled, 0) ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-background border-l-4 border-l-green-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Completions</span>
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold">
              {courses?.reduce((sum, c) => sum + c.totalCompleted, 0) ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Course list ─────────────────────────────────────────────── */}
      <Card className="border border-border shadow-sm overflow-hidden">

        {/* Section header */}
        <CardHeader className="bg-muted/50 border-b border-border py-4 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">All Courses</CardTitle>
            </div>
          </div>
        </CardHeader>

        {/* Column labels */}
        {courses && courses.length > 0 && (
          <div className="grid grid-cols-12 gap-4 px-6 py-2.5 bg-muted/20 border-b border-border">
            <span className="col-span-5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Course</span>
            <span className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Enrolled</span>
            <span className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Completed</span>
            <span className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Completion</span>
          </div>
        )}

        {/* Rows */}
        <div className="divide-y divide-border">
          {courses?.map(course => (
            <div
              key={course.courseId}
              className="grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-muted/30 cursor-pointer transition-colors group"
              onClick={() => setLocation(`/course/${course.courseId}`)}
              data-testid={`card-course-${course.courseId}`}
            >
              {/* Course identity */}
              <div className="col-span-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                  <BookOpen className="h-5 w-5 text-orange-600 group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <p className="font-semibold">Course {course.courseId}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {course.totalLessons} {course.totalLessons === 1 ? "Lesson" : "Lessons"}
                    </span>
                    {course.lastActivityAt && (
                      <span>· Last active {format(new Date(course.lastActivityAt), "MMM d, yyyy")}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Enrolled */}
              <div className="col-span-2 text-center">
                <div className="flex items-center gap-1.5 justify-center">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-lg font-bold">{course.totalEnrolled}</span>
                </div>
              </div>

              {/* Completed */}
              <div className="col-span-2 text-center">
                <div className="flex items-center gap-1.5 justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-lg font-bold">{course.totalCompleted}</span>
                </div>
              </div>

              {/* Completion rate bar */}
              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${course.completionRate}%`,
                        background:
                          course.completionRate >= 70 ? "#22c55e" :
                          course.completionRate >= 40 ? "#f97316" : "#ef4444",
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold w-9 text-right">{course.completionRate}%</span>
                </div>
              </div>

              <div className="col-span-1 flex justify-end">
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}

          {courses?.length === 0 && (
            <div className="py-16 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-semibold text-muted-foreground">No courses found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Start logging enrollment events to see courses here.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
