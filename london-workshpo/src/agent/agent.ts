import { createAgent } from "langchain";
import * as z from "zod";
import { orchestratorModel } from "./config.js";
import { recipeSubAgentTool } from "./sub-agents/recipe-sub-agent.js";
import { mealPlanSubAgentTool } from "./sub-agents/meal-plan-sub-agent.js";
import { searchWeather } from "./tools/search-weather.js";
import { searchSeasonalProducts } from "./tools/search-seasonal-products.js";

const orchestratorSchema = z.object({
  module: z.enum(['recipe', 'meal-plan']),
  data: z.string().describe("The exact JSON object returned by the sub-agent tool call, stringified. For recipe this will contain recipeName, ingredients and steps. For meal-plan this will contain parameters and blocks. Copy it exactly as returned by the tool.")
});

const systemPrompt = `You are an orchestration agent. The user gives you a search query, a location, and optionally an image and a date range.

Steps:
0. If an image is provided, identify the ingredients visible in it before proceeding.
1. Read the query and identify the intent — either "recipe" or "meal plan".
2. Call search_weather_forecast and search_seasonal_ingredients simultaneously in the same step — pass the location to both.
3. If the intent is "recipe", call recipe_sub_agent with the identified ingredients, location, weather result, and seasonal ingredients.
4. If the intent is "meal plan", extract the date range from the query (default "next 7 days" if not specified), then call meal_plan_sub_agent with the location, dates, weather result, and seasonal ingredients.
5. The value returned by the sub-agent tool IS the recipe or meal plan. JSON stringify that return value and place it in the "data" field of your response.
6. If no intent is given assume meal plan as default.`.trim();

export const agent = createAgent({
  model: orchestratorModel,
  tools: [searchWeather, searchSeasonalProducts, recipeSubAgentTool, mealPlanSubAgentTool],
  systemPrompt,
  responseFormat: orchestratorSchema
});
