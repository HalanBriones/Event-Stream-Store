import { useLocation, Link } from "wouter";
import { GraduationCap } from "lucide-react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", matches: ["/dashboard", "/student/"] },
  { href: "/courses",   label: "Courses",   matches: ["/courses", "/course/"] },
];

export default function Header() {
  const [location] = useLocation();

  return (
    <header className="bg-background border-b sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-base">Student Analytics</span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label, matches }) => {
            const active = matches.some(m => location === m || location.startsWith(m));
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* System Live */}
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          System Live
        </div>
      </div>
    </header>
  );
}
