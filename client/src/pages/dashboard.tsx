import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Activity, Users, BookOpen, ChevronRight,
  CheckCircle2, Clock, GraduationCap, Trash2,
} from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: events, isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: [api.events.list.path],
  });

  const { data: students, isLoading: studentsLoading } = useQuery<any[]>({
    queryKey: [api.events.students.path],
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/admin/clear-events"),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "All events cleared", description: "The database has been wiped successfully." });
    },
    onError: () => {
      toast({ title: "Failed to clear events", variant: "destructive" });
    },
  });

  const isLoading = eventsLoading || studentsLoading;

  const totalEvents   = events?.length ?? 0;
  const uniqueUsers   = students?.length ?? 0;
  const uniqueCourses = new Set(events?.map(e => e.courseId)).size;

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor student engagement and course progress
          </p>
        </div>

        {/* Clear all events button */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2"
              data-testid="button-clear-events"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All Events
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all events?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete every event from the database — all students, courses,
                lessons, and quiz data will be wiped. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-clear">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => clearMutation.mutate()}
                data-testid="button-confirm-clear"
              >
                {clearMutation.isPending ? "Clearing…" : "Yes, clear everything"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">

        <Card className="border border-border shadow-sm bg-background border-l-4 border-l-primary">
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
            <p className="text-xs text-muted-foreground mt-1">Events logged in system</p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-background border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Students
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
          className="border border-border shadow-sm bg-background border-l-4 border-l-orange-500 cursor-pointer hover:shadow-md transition-all group"
          onClick={() => setLocation("/courses")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Courses Offered
              </span>
              <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-orange-600" />
              </div>
            </div>
            <div className="text-3xl font-bold">{uniqueCourses}</div>
            <p className="text-xs text-orange-600 font-medium mt-1 group-hover:underline">
              Click to explore courses →
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Student directory ────────────────────────────────────────── */}
      <Card className="border border-border shadow-sm overflow-hidden">

        {/* Section header */}
        <CardHeader className="bg-muted/50 border-b border-border py-4 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Student Directory</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground bg-background border border-border rounded-full px-2.5 py-1 font-medium">
              {uniqueUsers} learner{uniqueUsers !== 1 ? "s" : ""}
            </span>
          </div>
        </CardHeader>

        {/* Column header row */}
        {students && students.length > 0 && (
          <div className="grid grid-cols-12 gap-4 px-6 py-2.5 bg-muted/20 border-b border-border">
            <span className="col-span-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Student</span>
            <span className="col-span-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
            <span className="col-span-5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Course Progress</span>
          </div>
        )}

        {/* Student rows */}
        <div className="divide-y divide-border">
          {students?.map(student => {
            const allDone    = student.enrolledCount > 0 && student.enrolledCount === student.completedCount;
            const inProgress = student.enrolledCount > student.completedCount;

            return (
              <div
                key={student.userId}
                className="grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-muted/30 cursor-pointer transition-colors group"
                onClick={() => setLocation(`/student/${student.userId}`)}
                data-testid={`card-student-${student.userId}`}
              >
                {/* Student identity */}
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
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
                      No Activity
                    </span>
                  )}
                </div>

                {/* Courses progress bar */}
                <div className="col-span-5 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>{student.enrolledCount} enrolled</span>
                      <span className="font-semibold text-foreground">{student.completedCount} completed</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{
                          width: student.enrolledCount > 0
                            ? `${(student.completedCount / student.enrolledCount) * 100}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="col-span-1 flex justify-end">
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );
          })}

          {students?.length === 0 && (
            <div className="py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-semibold text-muted-foreground">No students yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Start logging enrollment events to see students here.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
