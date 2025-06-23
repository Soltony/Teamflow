'use server';

import { suggestTaskDescriptions } from '@/ai/flows/suggest-task-descriptions';
import { z } from 'zod';

const SuggestSchema = z.object({
  taskSummary: z.string().min(5, "Task summary must be at least 5 characters long."),
});

export async function handleSuggestDescriptions(prevState: any, formData: FormData) {
  const validatedFields = SuggestSchema.safeParse({
    taskSummary: formData.get('taskSummary'),
  });

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors,
      suggestions: [],
    };
  }

  try {
    const result = await suggestTaskDescriptions({ taskSummary: validatedFields.data.taskSummary });
    return {
      suggestions: result.suggestedDescriptions,
      error: null,
    };
  } catch (error) {
    return {
      error: { _errors: ["Failed to get suggestions from AI."] },
      suggestions: [],
    };
  }
}
