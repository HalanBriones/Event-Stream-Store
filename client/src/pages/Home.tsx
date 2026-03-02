import { Activity, LayoutDashboard, Users, BookOpen, GraduationCap } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">LearnTracker</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="default" size="sm" className="gap-2" data-testid="button-go-to-dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto space-y-12 text-center">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight text-primary">
              Student Progress Analytics
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Monitor learning paths, lesson durations, and student engagement with high-precision insights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <Card className="bg-secondary/30 border-border/50">
              <CardHeader>
                <Users className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Student Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">View individual student progress, enrollment dates, and completed courses at a glance.</p>
              </CardContent>
            </Card>
            <Card className="bg-secondary/30 border-border/50">
              <CardHeader>
                <BookOpen className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Lesson Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Analyze time spent on each lesson and gaps between learning sessions to identify plateaus.</p>
              </CardContent>
            </Card>
            <Card className="bg-secondary/30 border-border/50">
              <CardHeader>
                <Activity className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Rushing Detection</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Automatically flag students completing lessons too quickly to ensure genuine learning happens.</p>
              </CardContent>
            </Card>
          </div>

          <div className="pt-8">
            <Link href="/dashboard">
              <Button size="lg" className="h-14 px-8 text-lg rounded-2xl shadow-xl hover:shadow-2xl transition-all" data-testid="button-enter-management-dashboard">
                Enter Management Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 py-8 bg-muted/20">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} LearnTracker Analytics. Built for educators.</p>
        </div>
      </footer>
    </div>
  );
}