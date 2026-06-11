export interface Recipe {
  recipeName: string;
  ingredients: string[];
  steps: string[];
}

export interface ThreadResponse {
  thread_id: string;
}

export interface RecipeAgentResponse {
  module: 'recipe';
  data: Recipe;
}

export interface MealPlanDay {
  date: string;
  recipeName: string;
  ingredients: string[];
  steps: string[];
}

export interface MealPlanBlock {
  type: 'day' | 'week' | 'month';
  label: string;
  days: MealPlanDay[];
}

export interface MealPlanParameters {
  people: number | null;
  dateRange: string;
  allergies: string[];
  cuisine: string[];
  other: string[];
}

export interface MealPlan {
  parameters: MealPlanParameters;
  blocks: MealPlanBlock[];
}

export interface MealPlanAgentResponse {
  module: 'meal-plan';
  data: MealPlan;
}

export type AgentResponse = RecipeAgentResponse | MealPlanAgentResponse;

export interface RunResponse {
  structuredResponse: AgentResponse;
}

export interface SmartSearchResult {
  intent: 'recipe' | 'meal-plan' | null;
  people: number | null;
  dietary: string[];
  dateRange: string | null;
}