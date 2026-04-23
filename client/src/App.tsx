import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Dashboard from "@/pages/dashboard";
import StudentDetailsPage from "@/pages/student-details";
import CoursesPage from "@/pages/courses";
import CourseDetailsPage from "@/pages/course-details";
import NotFound from "@/pages/not-found";

const withLayout = (Component: React.ComponentType) => () => (
  <Layout>
    <Component />
  </Layout>
);

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard"   component={withLayout(Dashboard)} />
      <Route path="/student/:id" component={withLayout(StudentDetailsPage)} />
      <Route path="/courses"     component={withLayout(CoursesPage)} />
      <Route path="/course/:id"  component={withLayout(CourseDetailsPage)} />
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
