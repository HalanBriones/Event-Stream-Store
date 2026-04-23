import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/Header";
import Home from "@/pages/Home";
import Dashboard from "@/pages/dashboard";
import StudentDetailsPage from "@/pages/student-details";
import CoursesPage from "@/pages/courses";
import CourseDetailsPage from "@/pages/course-details";
import NotFound from "@/pages/not-found";

const withHeader = (Component: React.ComponentType) => () => (
  <div className="min-h-screen bg-muted/30">
    <Header />
    <main>
      <Component />
    </main>
  </div>
);

function Router() {
  return (
    <Switch>
      <Route path="/"           component={Home} />
      <Route path="/dashboard"  component={withHeader(Dashboard)} />
      <Route path="/student/:id" component={withHeader(StudentDetailsPage)} />
      <Route path="/courses"    component={withHeader(CoursesPage)} />
      <Route path="/course/:id" component={withHeader(CourseDetailsPage)} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
