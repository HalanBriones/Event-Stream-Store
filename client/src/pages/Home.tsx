import { CreateEventForm } from "@/components/CreateEventForm";
import { Activity, Database, Server } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Hero Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">EventLog</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>System Online</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto space-y-12">
          
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-primary">
              Event Ingestion System
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              High-performance event tracking API. Currently in Phase 1 development mode.
              Use the interface below to test data transmission to the backend.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-secondary/30 border border-border/50">
              <Server className="h-8 w-8 mb-4 text-primary" />
              <h3 className="font-bold mb-2">REST API</h3>
              <p className="text-sm text-muted-foreground">Standardized POST endpoints for reliable data ingestion from any client.</p>
            </div>
            <div className="p-6 rounded-2xl bg-secondary/30 border border-border/50">
              <Database className="h-8 w-8 mb-4 text-primary" />
              <h3 className="font-bold mb-2">Structured Data</h3>
              <p className="text-sm text-muted-foreground">Type-safe schema validation ensuring data integrity before storage.</p>
            </div>
            <div className="p-6 rounded-2xl bg-secondary/30 border border-border/50">
              <Activity className="h-8 w-8 mb-4 text-primary" />
              <h3 className="font-bold mb-2">Real-time Ready</h3>
              <p className="text-sm text-muted-foreground">Built on a scalable architecture ready for high-throughput requirements.</p>
            </div>
          </div>

          <CreateEventForm />
          
        </div>
      </main>

      <footer className="border-t border-border/40 py-8 bg-muted/20">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} EventLog System. All systems nominal.</p>
        </div>
      </footer>
    </div>
  );
}
