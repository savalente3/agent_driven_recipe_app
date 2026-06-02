import { createAgent } from "langchain";
import * as z from "zod";
import { smartSearchModel } from "./config.js";

const smartSearchSchema = z.object({
    intent: z.enum(['recipe', 'meal-plan']).nullable().describe(
        "The user's intent. 'recipe' for a single meal or dish, 'meal-plan' for multiple meals across days. Null if not clear enough to determine."
    ),
    people: z.number().nullable().describe(
        "Number of people to cook for. Null if not mentioned."
    ),
    dietary: z.array(z.string()).describe(
        "Dietary preferences or restrictions mentioned e.g. ['vegan', 'gluten-free']. Empty array if none."
    ),
    dateRange: z.string().nullable().describe(
        "The date range for a meal plan e.g. '1 week', '3 days', '1 month'. Null if not mentioned."
    ),
});

const systemPrompt = `You are a smart search assistant for a recipe and meal planning app.

Your only job is to extract structured fields from the user's query. Do not generate, invent, or assume anything not explicitly stated.

## Intent rules
- 'recipe' = the user wants a single dish or meal idea (now, tonight, today, quick, lunch, dinner, breakfast, something to eat)
- 'meal-plan' = the user wants multiple meals planned across several days (plan, week, days, schedule, meal prep)
- If unclear → null

## Strict extraction rules
- dietary: ONLY include if the user explicitly mentions a food restriction or preference (vegan, vegetarian, gluten-free, dairy-free, nut-free, halal). Ingredients are NOT dietary requirements. If not mentioned → empty array [].
- people: ONLY if a number of people is explicitly mentioned. If not → null.
- dateRange: ONLY if a specific time range is mentioned (next week, 3 days, this month). "today" or "tonight" is NOT a date range → null.

## Examples
- "I want something to eat today" → intent: recipe, people: null, dietary: [], dateRange: null
- "quick dinner idea" → intent: recipe, people: null, dietary: [], dateRange: null
- "what should I make for lunch" → intent: recipe, people: null, dietary: [], dateRange: null
- "plan my meals for next week" → intent: meal-plan, people: null, dietary: [], dateRange: '1 week'
- "meal prep for the whole week, 4 people" → intent: meal-plan, people: 4, dietary: [], dateRange: '1 week'
- "something vegan and quick" → intent: recipe, people: null, dietary: ['vegan'], dateRange: null
- "5 day meal plan, gluten-free, 2 people" → intent: meal-plan, people: 2, dietary: ['gluten-free'], dateRange: '5 days'
- "I need to sort food for me and my partner this week" → intent: meal-plan, people: 2, dietary: [], dateRange: '1 week'`.trim();

export const smartSearchAgent = createAgent({
    model: smartSearchModel,
    tools: [],
    systemPrompt,
    responseFormat: smartSearchSchema,
});
