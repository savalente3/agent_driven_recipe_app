import { tool } from "@langchain/core/tools";
import { TavilySearch } from "@langchain/tavily";
import * as z from "zod";

export const searchSeasonalProducts = tool(
  async ({ location }: { location: string }) => {
    const month = new Date().toLocaleString('en', { month: 'long' });
    const query = `seasonal fruit and vegetables in ${location} in ${month}`;
    const results = await new TavilySearch({ maxResults: 3 }).invoke({ query });
    return JSON.stringify(results);
  },
  {
    name: "search_seasonal_ingredients",
    description: "Search for seasonal fruit and vegetables available in a location this month.",
    schema: z.object({
      location: z.string().describe("country or city to get seasonal produce for"),
    }),
  }
);
