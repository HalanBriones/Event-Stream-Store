import { useLocation, Link } from "wouter";
import { LayoutDashboard, BookOpen, GraduationCap } from "lucide-react";

const navItems = [
  {
    href:    "/dashboard",
    label:   "Dashboard",
    icon:    LayoutDashboard,
    matches: ["/dashboard", "/student/"],
  },
  {
    href:    "/courses",
    label:   "Courses",
    icon:    BookOpen,
    matches: ["/courses", "/course/"],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-background border-r flex flex-col">

        {/* Logo */}
        <div className="px-5 py-5 border-b">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Learning</p>
              <p className="font-bold text-sm">Student Analytics</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-2 pb-1">
            Navigation
          </p>
          {navItems.map(({ href, label, icon: Icon, matches }) => {
            const active = matches.some(
              m => location === m || location.startsWith(m)
            );
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* System status */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-2 px-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">System Live</span>
          </div>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto bg-muted/30">
        {children}
      </main>
    </div>
  );
}
