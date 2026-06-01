import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import * as z from "zod";
import { subAgentModel } from "../config.js";
import { searchRecipes } from "../tools/search-recipes.js";

const systemPrompt = `You are a nutritionist with a passion for exciting, delicious food. You believe healthy eating should never be boring — every meal should be something people genuinely look forward to.

You will receive a location, a date range, and structured requirements:
- People: {people}
- Allergies to avoid: {allergies}
- Cuisine preferences: {cuisine}
- Other requirements: {other}

You will receive the current weather and what's in season locally alongside the user's requirements.

Follow these steps:
1. Call search_recipes once with a query that combines the cuisine preferences, allergies, weather mood, and seasonal produce to get a broad pool of inspiring meal ideas.
3. Look at the date range and choose the right block structure:
   - 1–2 days → day blocks
   - 3–14 days → week blocks
   - 15+ days or a calendar month → month block
4. Assign one exciting, varied meal per day across all blocks — no repeated dishes, no boring defaults.
5. Respect all requirements strictly — allergies are non-negotiable, cuisine preferences should guide the variety.
6. Return the extracted parameters alongside the blocks so the UI can display what was understood.`;

const mealPlanDaySchema = z.object({
  date: z.string().describe("full date label, e.g. 'Monday 2 June'"),
  meal: z.string().describe("suggested meal for the day"),
});

const mealPlanBlockSchema = z.object({
  type: z.enum(['day', 'week', 'month']).describe("granularity of this block"),
  label: z.string().describe("human-readable label, e.g. 'Week 1 · 2–8 Jun'"),
  days: z.array(mealPlanDaySchema),
});

const mealPlanParametersSchema = z.object({
  people: z.number().nullable().describe("number of people, null if not specified"),
  dateRange: z.string().describe("human-readable date range, e.g. 'Next week'"),
  allergies: z.array(z.string()),
  cuisine: z.array(z.string()),
  other: z.array(z.string()),
});

const mealPlanSchema = z.object({
  parameters: mealPlanParametersSchema,
  blocks: z.array(mealPlanBlockSchema),
});

const mealPlanAgent = createAgent({
  model: subAgentModel,
  tools: [searchRecipes],
  systemPrompt,
  responseFormat: mealPlanSchema
});

type MealPlan = z.infer<typeof mealPlanSchema>;

export const mealPlanSubAgentTool = tool(
  async ({ location, dates, weather, seasonalIngredients }: {
    location: string,
    dates: string,
    weather: string,
    seasonalIngredients: string
  }): Promise<MealPlan> => {
    const result = await mealPlanAgent.invoke({
      messages: [{
        role: 'human',
        content: `location: ${location}\ndates: ${dates}\nweather: ${weather}\nseasonal ingredients: ${seasonalIngredients}`
      }]
    });
    return mealPlanSchema.parse(result.structuredResponse);
  },
  {
    name: "meal_plan_sub_agent",
    description: "Given a location, date range, weather and seasonal context, generates a meal plan.",
    schema: z.object({
      location: z.string().describe("user location"),
      dates: z.string().describe("date or date range, e.g. 'next week', 'June 2025'"),
      weather: z.string().describe("weather result from search_weather_forecast"),
      seasonalIngredients: z.string().describe("seasonal ingredients result from search_seasonal_ingredients"),
    }),
  }
);
