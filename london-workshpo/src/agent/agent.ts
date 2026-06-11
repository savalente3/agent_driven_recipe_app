import { createAgent } from "langchain";
import * as z from "zod";
import { orchestratorModel } from "./config.js";
import { recipeSubAgentTool } from "./sub-agents/recipe-sub-agent.js";
import { mealPlanSubAgentTool } from "./sub-agents/meal-plan-sub-agent.js";
import { searchWeather } from "./tools/search-weather.js";
import { searchSeasonalProducts } from "./tools/search-seasonal-products.js";

const orchestratorSchema = z.object({
  module: z.enum(['recipe', 'meal-plan']),
  data: z.record(z.unknown()).describe("The exact object returned by the sub-agent tool call. Place it here as-is — do not stringify it.")
});

const systemPrompt = `You are an orchestration agent. The user gives you a search query, a location, and optionally an image.

Steps:
0. If an image is provided, identify the ingredients visible in it before proceeding.
1. Read the query and identify the intent — either "recipe" or "meal plan".
2. Call search_weather_forecast and search_seasonal_ingredients simultaneously in the same step — pass the location to both.
3. If the intent is "recipe", call recipe_sub_agent with the identified ingredients, location, weather result, and seasonal ingredients.
4. If the intent is "meal plan", extract from the query:
   - dates: date range (default "next 7 days" if not specified)
   - people: number of people (null if not mentioned)
   - dietary: array of dietary preferences or restrictions (empty array if none)
   Then call meal_plan_sub_agent with all of these plus location, weather, and seasonal ingredients.
5. The object returned by the sub-agent IS the data. Place it directly in the "data" field — do not stringify it.
6. If no intent is given assume meal plan as default.`.trim();

export const agent = createAgent({
  model: orchestratorModel,
  tools: [searchWeather, searchSeasonalProducts, recipeSubAgentTool, mealPlanSubAgentTool],
  systemPrompt,
  responseFormat: orchestratorSchema
});
