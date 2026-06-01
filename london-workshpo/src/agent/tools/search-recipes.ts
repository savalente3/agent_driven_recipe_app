import { tool } from "@langchain/core/tools";
import { TavilySearch } from "@langchain/tavily";
import * as z from "zod";

export const searchRecipes = tool(
  async ({ query }: { query: string }) => {
    const input = z.object({ query: z.string() }).parse({ query });
    return await new TavilySearch({ maxResults: 5 }).invoke(input);
  },
  {
    name: "search_recipes",
    description: "Search the web for recipe ideas. Pass a descriptive query including cuisine preferences, dietary restrictions, and weather mood.",
    schema: z.object({
      query: z.string().describe("search query, e.g. 'light summer meals no tomato Italian'"),
    }),
  }
);
