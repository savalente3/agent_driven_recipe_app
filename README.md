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

### Smart conversational search bar
- **Real-time keyword detection** — as you type "Recipe" or "Meal plan", the keyword auto-highlights with a ▾ indicator
- **Click to swap keywords** — click a highlighted keyword to replace it instantly without retyping the whole query
- **Rich text input** — contenteditable div, not a plain `<input>`, so cursor tracking and inline styling work seamlessly
- **Direct image upload** — 📎 button to upload ingredient photos without leaving the search bar; vision AI analyzes them immediately
- **Intent routing** — the search bar alone determines which agent pipeline runs (recipe vs meal plan) based on which keyword you used

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

### 1. Get API keys

You'll need keys from OpenAI and Tavily:

- **OpenAI API key**: https://platform.openai.com/api-keys
- **Tavily API key**: https://app.tavily.com

### 2. Set up the backend

```bash
cd london-workshpo
```

Create a `.env` file (`.env.example` is provided as a template):

```env
OPENAI_API_KEY=sk-...your-openai-key-here...
TAVILY_API_KEY=tvly-...your-tavily-key-here...
LANGSMITH_API_KEY=ls_...optional-for-debugging...

LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com
LANGCHAIN_TRACING_V2=true
```

Install dependencies and start the agent server:

```bash
npm install
npx @langchain/langgraph-cli dev
```

The agent server will start at **`http://localhost:2024`** and wait for requests.

### 3. Set up the frontend

In a **new terminal**, from the project root:

```bash
cd london-workshop-fe
npm install
ng serve
```

Angular will start the dev server at **`http://localhost:4200`**.

### 4. Open the app

Go to **`http://localhost:4200`** in your browser. Both the frontend and backend are now running and communicating.

---

## How to use the app

### Recipe mode

1. **Set location** — type a city in the location field (top)
2. **Type a query** — mention "Recipe" or include it naturally: *"Recipe for tonight with chicken"*
3. **Upload ingredients** (optional) — click 📎 to upload a photo of your fridge
4. **Hit Run** — the agent:
   - Detects ingredients from the image (if provided)
   - Fetches current weather
   - Searches for recipe ideas combining all context
   - Returns a full recipe with steps
5. **Regenerate** — click the button to get a different recipe suggestion

### Meal plan mode

1. **Set location** — type a city in the location field
2. **Type a query** — mention "Meal plan": *"Meal plan for next week, 2 people, vegan"*
3. **Add requirements** — the requirement bubbles appear below the search bar:
   - **Date range** — click to type or use the dropdown (defaults to 1 week)
   - **People** — how many to cook for
   - **Dietary** — click to pick from: Vegetarian, Vegan, Gluten-free, Dairy-free, Nut-free, Halal
4. **Hit Run** — the agent:
   - Fetches weather for the date range
   - Searches for recipes matching your requirements
   - Generates a calendar (day/week/month blocks) with one meal per day
   - Auto-populates the requirement bubbles with what it understood
5. **Regenerate** — click to get a different meal plan

---

## Troubleshooting

**Agent server won't start**
- Check that both API keys are set in `.env`
- Ensure port 2024 is free (check `lsof -i :2024`)
- Look at the terminal output for error messages

**Frontend won't compile**
- Try `npm install` again, then `ng serve`
- Check that you're using Node 18+

**Search results are empty**
- Tavily needs internet connection
- Check that `TAVILY_API_KEY` is valid
- Try a different query or location

**Image upload fails**
- Ensure the file is a valid image (PNG/JPG)
- File size should be under 10MB
