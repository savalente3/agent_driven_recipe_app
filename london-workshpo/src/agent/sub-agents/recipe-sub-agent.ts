import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import * as z from "zod";
import { subAgentModel } from "../config.js";
import { searchRecipes } from "../tools/search-recipes.js";
import { imageValidationMiddleware } from "../middleware/image-validation.js";

const systemPrompt = `You are a talented, instinctive chef. You cook from the heart — whatever feels right, right now. Someone opens their fridge and tells you what they've got, and you immediately know what to make.
You let the weather outside inspire the mood of the dish — not just the temperature, but the feeling. A grey rainy afternoon calls for something comforting and indulgent. A bright sunny day calls for something fresh and vibrant.
You never default to the obvious. You reach for bold flavours, unexpected combinations, and techniques that make simple ingredients shine. You draw from any cuisine in the world — Italian, Japanese, Mexican, Middle Eastern, whatever fits the moment.
Make it delicious. Make it exciting. Make it something worth cooking tonight.

You will receive ingredients, the current weather, and what's in season locally.

Steps:
1. Call search_recipes with a descriptive query that combines the ingredients, weather mood, and seasonal produce — e.g. "hearty mushroom risotto for a rainy day using seasonal autumn courgettes". The search results include an "images" array of real photo URLs with descriptions — keep these in mind for step 4.
2. Pick the most exciting, fitting recipe from the results — trust your instincts.
3. Write out the full recipe: name, ingredients with quantities, and step-by-step cooking instructions.
4. If one of the images from the search results plausibly depicts this dish (matching dish type, main ingredients, or style — based on its description), set imageUrl to that image's url. If nothing fits well, set imageUrl to null.`;

export const recipeSchema = z.object({
  recipeName: z.string().describe("name of the recipe"),
  ingredients: z.array(z.string()).describe("ingredients with quantities, e.g. '1 avocado, diced'"),
  steps: z.array(z.string()).describe("ordered cooking steps written out in full"),
  imageUrl: z.string().nullable().describe("URL of a real photo from the search results that plausibly depicts this dish, or null if none fits well"),
});

const recipeAgent = createAgent({
  model: subAgentModel,
  tools: [searchRecipes],
  systemPrompt,
  responseFormat: recipeSchema,
  middleware: [imageValidationMiddleware]
});

type Recipe = z.infer<typeof recipeSchema>;

export const recipeSubAgentTool = tool(
  async ({ ingredients, location, weather, seasonalIngredients }: {
    ingredients: string[],
    location: string,
    weather: string,
    seasonalIngredients: string
  }): Promise<Recipe> => {
    const result = await recipeAgent.invoke({
      messages: [{
        role: 'human',
        content: `location: ${location}\ningredients: ${ingredients.join(', ')}\nweather: ${weather}\nseasonal ingredients: ${seasonalIngredients}`
      }]
    });
    return recipeSchema.parse(result.structuredResponse);
  },
  {
    name: "recipe_sub_agent",
    description: "Given ingredients, location, weather and seasonal context, finds a recipe.",
    schema: z.object({
      ingredients: z.array(z.string()).describe("ingredients identified from the image or query"),
      location: z.string().describe("user location"),
      weather: z.string().describe("weather result from search_weather_forecast"),
      seasonalIngredients: z.string().describe("seasonal ingredients result from search_seasonal_ingredients"),
    }),
  }
);
