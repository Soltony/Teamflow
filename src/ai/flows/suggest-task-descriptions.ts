// This file is machine-generated - edit with care!
'use server';

/**
 * @fileOverview AI-powered task description suggestions.
 *
 * - suggestTaskDescriptions - A function that suggests task descriptions based on a task summary.
 * - SuggestTaskDescriptionsInput - The input type for the suggestTaskDescriptions function.
 * - SuggestTaskDescriptionsOutput - The return type for the suggestTaskDescriptions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTaskDescriptionsInputSchema = z.object({
  taskSummary: z
    .string()
    .describe('A brief summary of the task for which descriptions are needed.'),
});
export type SuggestTaskDescriptionsInput = z.infer<
  typeof SuggestTaskDescriptionsInputSchema
>;

const SuggestTaskDescriptionsOutputSchema = z.object({
  suggestedDescriptions: z
    .array(z.string())
    .describe('An array of suggested task descriptions.'),
});
export type SuggestTaskDescriptionsOutput = z.infer<
  typeof SuggestTaskDescriptionsOutputSchema
>;

export async function suggestTaskDescriptions(
  input: SuggestTaskDescriptionsInput
): Promise<SuggestTaskDescriptionsOutput> {
  return suggestTaskDescriptionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTaskDescriptionsPrompt',
  input: {schema: SuggestTaskDescriptionsInputSchema},
  output: {schema: SuggestTaskDescriptionsOutputSchema},
  prompt: `You are a project management assistant, and you are helping a project manager come up with clear and complete task descriptions.

  Given the following task summary, generate three suggested task descriptions that are clear, concise, and actionable.

  Task Summary: {{{taskSummary}}}`,
});

const suggestTaskDescriptionsFlow = ai.defineFlow(
  {
    name: 'suggestTaskDescriptionsFlow',
    inputSchema: SuggestTaskDescriptionsInputSchema,
    outputSchema: SuggestTaskDescriptionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
