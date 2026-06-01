import { tool } from "@langchain/core/tools";
import { TavilySearch } from "@langchain/tavily";
import * as z from "zod";

export const searchWeather = tool(
  async ({ destination }: { destination: string }) => {
    const results = await new TavilySearch({ maxResults: 3 }).invoke({ query: `current weather in ${destination}` });
    return JSON.stringify(results);
  },
  {
    name: "search_weather_forecast",
    description: "Get the current weather for a location.",
    schema: z.object({
      destination: z.string().describe("location to get weather for"),
    }),
  }
);
