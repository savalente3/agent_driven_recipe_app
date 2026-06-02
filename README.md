# AI-Driven Recipe & Meal Planner

An AI-powered app that turns a natural language query into a personalised recipe or weekly meal plan — factoring in your location, the current weather, what's in season, and your dietary preferences.

Built as a London workshop project to demonstrate how LLMs can be used not just as a feature inside an app, but as the product itself.

---

## What it does

Type something like **"Recipe for tonight with chicken and mushrooms"** or **"Meal plan for next week, 2 people, Vegan"** and the agent:

- Identifies your intent (recipe or meal plan)
- Reads the image if you upload one (ingredient detection)
- Fetches the current weather for your location
- Searches for what's in season locally
- Searches for recipe ideas combining all of that context
- Returns a full recipe or a structured week-by-week meal plan

---

## Main Features

### Conversational search bar
- Free-text input with inline keyword detection — typing **Recipe** or **Meal plan** highlights the keyword and unlocks the relevant mode
- Upload an image of your fridge/ingredients directly from the search bar
- Keywords are clickable and swappable without retyping

### Recipe finder
- Detects ingredients from an uploaded image using vision AI
- Weather-informed — rainy day = something comforting, sunny = something fresh
- Returns a full recipe with ingredients and step-by-step instructions
- Regenerate button to get a different suggestion

### Meal planner
- Requirement bubbles for date range, number of people, and dietary preferences (with dropdown suggestions)
- Agent decides the calendar structure (day / week / month blocks) based on the requested date range
- One meal per day, varied across the full range
- Bubbles auto-populate from what the agent understood in your query

### Location & weather
- Location input at the top feeds into both the weather fetch and seasonal ingredient search
- Weather icon appears next to location after a run

---

## Agent Architecture

This is the most important part. The app uses a **multi-agent pipeline** built on LangGraph and LangChain.

```
User query + image + location
        │
        ▼
┌─────────────────────────┐
│      Orchestrator       │  gpt-4o  (vision capable)
│                         │
│  1. Reads intent        │
│  2. Calls in parallel:  │──► search_weather(location)
│     • search_weather    │──► search_seasonal_ingredients(location)
│     • search_seasonal   │
│  3. Routes to sub-agent │
└────────────┬────────────┘
             │ passes: ingredients + weather + seasonal context
     ┌───────┴────────┐
     │                │
     ▼                ▼
┌─────────┐    ┌────────────┐
│  Recipe │    │  Meal Plan │   both: gpt-4.1
│ Sub-agent│   │  Sub-agent │
│         │    │            │
│ 1 tool  │    │ 1 tool     │
│ call:   │    │ call:      │
│ search_ │    │ search_    │
│ recipes │    │ recipes    │
└─────────┘    └────────────┘
```

### Why a multi-agent setup?

A single agent doing everything — intent detection, image analysis, weather, recipes, and output formatting — produces inconsistent, generic results. Splitting into an **orchestrator + specialists** means each agent has one clear job and does it well.

### Parallel tool calls

The orchestrator calls `search_weather` and `search_seasonal_ingredients` **simultaneously** in a single step before routing. Modern models (gpt-4o, gpt-4.1) emit both tool calls in one response; LangChain executes them concurrently. This removes one sequential round trip from the pipeline.

### Tools

| Tool | Used by | Purpose |
|------|---------|---------|
| `search_weather` | Orchestrator | Current weather via Tavily web search |
| `search_seasonal_ingredients` | Orchestrator | What's in season locally this month |
| `search_recipes` | Sub-agents | Recipe ideas informed by weather + season + ingredients |

### Models

| Agent | Model | Reason |
|-------|-------|--------|
| Orchestrator | `gpt-4o` | Needs vision for ingredient extraction from images |
| Recipe sub-agent | `gpt-4.1` | Creative writing, tool use, faster than gpt-4o |
| Meal plan sub-agent | `gpt-4.1` | Structured planning, multiple days, dietary constraints |

### Structured output

Every agent returns a typed Zod schema. The orchestrator wraps the sub-agent result in:
```json
{ "module": "recipe" | "meal-plan", "data": "<json string>" }
```
The frontend parses this directly into typed Angular components — no string parsing or guessing.

---

## Project Structure

```
agent_driven_recipe_app/
├── london-workshop-fe/          # Angular 19 frontend
│   └── src/app/
│       ├── home/                # Main page, search bar, animations
│       ├── recipe/              # Recipe card component
│       ├── meal-plan/           # Meal plan calendar component
│       ├── agent.service.ts     # LangGraph API client
│       └── models/              # Typed interfaces
│
└── london-workshpo/             # LangGraph backend
    └── src/agent/
        ├── agent.ts             # Orchestrator
        ├── config.ts            # Model configuration
        ├── sub-agents/
        │   ├── recipe-sub-agent.ts
        │   └── meal-plan-sub-agent.ts
        └── tools/
            ├── search-weather.ts
            ├── search-recipes.ts
            └── search-seasonal-products.ts
```

---

## Setup & Running

### Prerequisites

- Node.js 18+
- Angular CLI (`npm install -g @angular/cli`)
- A LangGraph account or local LangGraph dev server

### Environment variables

Create a `.env` file in `london-workshpo/` (a `.env.example` is provided as a template):

```env
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key
```

Get your keys:
- OpenAI: https://platform.openai.com/api-keys
- Tavily: https://app.tavily.com

### Running the backend

```bash
cd london-workshpo
npm install
npx @langchain/langgraph-cli dev
```

The agent server runs at `http://localhost:2024`.

### Running the frontend

```bash
cd london-workshop-fe
npm install
ng serve
```

Open `http://localhost:4200`.

---

## How to use

1. **Set your location** — type a city in the location field at the top
2. **Type a query** — use the keyword **Recipe** or **Meal plan** to switch modes
3. **Add requirements** (meal plan only) — fill in the date range, people, and dietary chips below the search bar, or just include them naturally in your query
4. **Upload an image** (recipe only) — click the 📎 icon to upload a photo of ingredients
5. **Hit Run** — the agent pipeline runs and returns the result
6. **Regenerate** — hit the regenerate button to get a different suggestion with the same inputs
