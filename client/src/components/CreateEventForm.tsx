import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, type CreateEventInput } from "@shared/routes";
import { useCreateEvent } from "@/hooks/use-events";
import { Loader2, Send } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CreateEventForm() {
  const { mutate: createEvent, isPending } = useCreateEvent();
  
  const form = useForm<CreateEventInput>({
    resolver: zodResolver(api.events.create.input),
    defaultValues: {
      eventType: "lesson_completed",
      userId: 1,
      courseId: 101,
      lessonId: 5,
      quizId: null,
      metadata: {},
    }
  });

  function onSubmit(data: CreateEventInput) {
    createEvent(data, {
      onSuccess: () => {
        // Optional: Reset form or keep values for rapid testing
        // form.reset(); 
      }
    });
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 md:p-8 bg-card rounded-2xl shadow-sm border border-border/50">
      <div className="mb-8">
        <h2 className="text-2xl font-bold font-display text-foreground tracking-tight">Log New Event</h2>
        <p className="text-muted-foreground mt-2">
          Test the event ingestion pipeline by manually submitting an event payload.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. lesson_viewed" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User ID</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field} 
                      onChange={e => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="courseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course ID</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field}
                      onChange={e => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lessonId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lesson ID (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field}
                      value={field.value || ''}
                      onChange={e => field.onChange(e.target.value ? e.target.valueAsNumber : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="metadata"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Metadata (JSON)</FormLabel>
                <FormControl>
                  <Textarea 
                    className="font-mono text-sm min-h-[100px]"
                    placeholder='{"browser": "chrome", "duration": 120}'
                    value={typeof field.value === 'object' ? JSON.stringify(field.value, null, 2) : field.value}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        field.onChange(parsed);
                      } catch {
                        // Allow typing invalid JSON temporarily
                        field.onChange(e.target.value); 
                      }
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Enter valid JSON object for additional event properties.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="
                inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all
                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
                disabled:pointer-events-none disabled:opacity-50
                bg-primary text-primary-foreground shadow hover:bg-primary/90 hover:shadow-lg
                h-12 px-8 py-2 w-full md:w-auto
              "
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Event Payload
                </>
              )}
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
}
