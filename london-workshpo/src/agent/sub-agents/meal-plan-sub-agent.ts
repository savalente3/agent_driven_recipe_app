import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import * as z from "zod";
import { subAgentModel } from "../config.js";
import { searchRecipes } from "../tools/search-recipes.js";
import { imageValidationMiddleware } from "../middleware/image-validation.js";

const systemPrompt = `You are a nutritionist with a passion for exciting, delicious food. You believe healthy eating should never be boring — every meal should be something people genuinely look forward to.

You will receive a location, date range, number of people, dietary requirements, and context about the weather and seasonal ingredients.

Follow these steps:
1. Call search_recipes once with a query that combines the dietary requirements, weather mood, and seasonal produce to get a broad pool of inspiring meal ideas. The search results include an "images" array of real photo URLs with descriptions — keep these in mind for step 4.
2. Look at the date range and choose the right block structure:
   - 1–2 days → day blocks
   - 3–14 days → week blocks
   - 15+ days or a calendar month → month block
   Week and month blocks must align to calendar weeks: each block covers Monday through Sunday. If the requested range doesn't start on a Monday or end on a Sunday, the first and/or last blocks simply contain fewer than 7 days — don't shift or pad dates outside the requested range.
3. Assign one exciting, varied meal per day across all blocks — no repeated dishes, no boring defaults.
4. For each day, write a full recipe: a short title, a complete ingredients list with quantities, and step-by-step cooking instructions — the same level of detail as a standalone recipe. If one of the images from the search results plausibly depicts this dish (matching dish type, main ingredients, or style — based on its description), set imageUrl to that image's url. Don't reuse the same image for multiple days unless there is genuinely no alternative. If nothing fits, set imageUrl to null.
5. Respect all dietary requirements strictly — they are non-negotiable.
6. Return the parameters (people, dateRange, allergies, cuisine, other) alongside the blocks so the UI can display what was understood.`;

const mealPlanDaySchema = z.object({
  date: z.string().describe("full date label, e.g. 'Monday 2 June'"),
  recipeName: z.string().describe("short title of the meal, e.g. 'Grilled Summer Squash Salad'"),
  ingredients: z.array(z.string()).describe("ingredients with quantities, e.g. '1 avocado, diced'"),
  steps: z.array(z.string()).describe("ordered cooking steps written out in full"),
  imageUrl: z.string().nullable().describe("URL of a real photo from the search results that plausibly depicts this dish, or null if none fits well"),
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
  other: z.array(z.string()).describe("additional context labels for the UI. If seasonal produce informed the plan, include exactly one entry formatted as 'Seasonal produce: item1, item2, item3' (comma-separated, no other wording)"),
});

export const mealPlanSchema = z.object({
  parameters: mealPlanParametersSchema,
  blocks: z.array(mealPlanBlockSchema),
});

const mealPlanAgent = createAgent({
  model: subAgentModel,
  tools: [searchRecipes],
  systemPrompt,
  responseFormat: mealPlanSchema,
  middleware: [imageValidationMiddleware]
});

type MealPlan = z.infer<typeof mealPlanSchema>;

export const mealPlanSubAgentTool = tool(
  async ({ location, dates, people, dietary, weather, seasonalIngredients }: {
    location: string,
    dates: string,
    people: number | null,
    dietary: string[],
    weather: string,
    seasonalIngredients: string
  }): Promise<MealPlan> => {
    const result = await mealPlanAgent.invoke({
      messages: [{
        role: 'human',
        content: `location: ${location}
          dates: ${dates}
          people: ${people ?? '1 person'}
          dietary requirements: ${dietary.length ? dietary.join(', ') : 'none'}
          weather: ${weather}
          seasonal ingredients: ${seasonalIngredients}`
      }]
    });
    return mealPlanSchema.parse(result.structuredResponse);
  },
  {
    name: "meal_plan_sub_agent",
    description: "Given a location, date range, people count, dietary requirements, weather and seasonal context, generates a meal plan.",
    schema: z.object({
      location: z.string().describe("user location"),
      dates: z.string().describe("date or date range, e.g. 'next week', 'June 2025'"),
      people: z.number().nullable().describe("number of people to cook for, null if not specified"),
      dietary: z.array(z.string()).describe("dietary preferences or restrictions e.g. ['vegan', 'gluten-free']. Empty array if none."),
      weather: z.string().describe("weather result from search_weather_forecast"),
      seasonalIngredients: z.string().describe("seasonal ingredients result from search_seasonal_ingredients"),
    }),
  }
);
