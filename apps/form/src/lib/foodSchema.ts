import { z } from 'zod';

export const FoodItemSchema = z.object({
  name: z.string().describe('Specific food name, e.g. "Grilled chicken breast"'),
  grams: z.number().describe('Estimated edible portion weight in grams'),
  calories: z.number().describe('Estimated kilocalories for that portion'),
  protein: z.number().describe('Estimated protein in grams for that portion'),
  confidence: z.enum(['high', 'medium', 'low']),
  note: z.string().describe('One short sentence on what drives the estimate or what is uncertain; empty if nothing'),
});

export const FoodAnalysisSchema = z.object({
  is_food: z.boolean().describe('False when the photo shows no food or drink'),
  items: z.array(FoodItemSchema),
  question: z
    .string()
    .describe('If anything is ambiguous (hidden ingredients, sauce, portion), one question for the person; empty otherwise'),
});

export type FoodItem = z.infer<typeof FoodItemSchema>;
export type FoodAnalysis = z.infer<typeof FoodAnalysisSchema>;
