import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type CreateEventInput, type EventResponse } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useCreateEvent() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: CreateEventInput) => {
      // Validate input on client side before sending
      const validated = api.events.create.input.parse(data);
      
      const res = await fetch(api.events.create.path, {
        method: api.events.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create event');
      }

      const responseData = await res.json();
      return api.events.create.responses[201].parse(responseData);
    },
    onSuccess: () => {
      toast({
        title: "Event Logged",
        description: "The event has been successfully recorded in the database.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  });
}
