"use client";

import { useFormState } from "react-dom";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { handleSuggestDescriptions } from "@/app/actions";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

type TaskSuggestionProps = {
  onSelectSuggestion: (description: string) => void;
  taskTitle: string;
};

const initialState = {
  suggestions: [],
  error: null,
};

export function TaskSuggestion({
  onSelectSuggestion,
  taskTitle,
}: TaskSuggestionProps) {
  const [state, formAction] = useFormState(handleSuggestDescriptions, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.error?._errors) {
      toast({
        variant: "destructive",
        title: "Error",
        description: state.error._errors.join(", "),
      });
    }
  }, [state, toast]);

  return (
    <div className="p-4 border rounded-lg bg-muted/50">
        <form action={formAction} className="flex items-end gap-2 mb-4">
            <div className="flex-grow">
                <Label htmlFor="taskSummary" className="text-xs">Task Title</Label>
                <Input
                    id="taskSummary"
                    name="taskSummary"
                    defaultValue={taskTitle}
                    placeholder="e.g., 'Develop homepage UI'"
                    required
                />
            </div>
            <Button type="submit" variant="outline" size="icon">
                <Wand2 className="w-4 h-4" />
                <span className="sr-only">Suggest Descriptions</span>
            </Button>
        </form>
        {state.suggestions && state.suggestions.length > 0 && (
            <div className="space-y-2">
                <p className="text-sm font-medium">Suggestions:</p>
                <div className="flex flex-col gap-2">
                {state.suggestions.map((suggestion, index) => (
                    <Button
                        key={index}
                        variant="ghost"
                        className="text-left justify-start h-auto"
                        onClick={() => onSelectSuggestion(suggestion)}
                    >
                    {suggestion}
                    </Button>
                ))}
                </div>
            </div>
        )}
    </div>
  );
}
