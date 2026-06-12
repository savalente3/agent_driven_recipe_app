import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AgentResponse, Recipe, MealPlanDay, RunResponse, ThreadResponse, SmartSearchResult } from '../models/recipe.model';

const STATUS_MESSAGES: Record<string, string> = {
    search_weather_forecast: 'Checking the weather...',
    search_seasonal_ingredients: 'Finding seasonal produce...',
    recipe_sub_agent: 'Writing your recipe...',
    meal_plan_sub_agent: 'Planning your meal plan...',
};

@Injectable({ providedIn: 'root' })
export class AIagentService {

    API = 'http://localhost:2024';

    result = signal<AgentResponse | null>(null);
    loadingStatus = signal<string>('');

    constructor(private http: HttpClient) {}

    private statusForToolCalls(names: string[]): string {
        const set = new Set(names);

        if (set.has('search_weather_forecast') && set.has('search_seasonal_ingredients')) {
            return 'Checking the weather and seasonal produce...';
        }

        for (const name of names) {
            if (STATUS_MESSAGES[name]) return STATUS_MESSAGES[name];
        }

        return 'Thinking...';
    }

    async runAgent(query: string, location: string, imageBase64?: string, model?: string,): Promise<void> {

        const content: any[] = [
            { type: 'text', text: `query: ${query}\nlocation: ${location}` }
        ];

        if (imageBase64) {
            content.push({ type: 'image_url', image_url: { url: imageBase64 } });
        }

        this.loadingStatus.set('Understanding your request...');

        const { thread_id } = await firstValueFrom(
            this.http.post<ThreadResponse>(`${this.API}/threads`, {})
        );

        const response = await fetch(`${this.API}/threads/${thread_id}/runs/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assistant_id: 'Agent',
                input: {
                    messages: [{ role: 'human', content }]
                },
                config: model ? { configurable: { model } } : undefined,
                stream_mode: ['updates']
            })
        });

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let structuredResponse: any = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const messages = buffer.split('\n\n');
            buffer = messages.pop() ?? '';

            for (const message of messages) {
                let eventType = 'message';
                let data = '';

                for (const line of message.split('\n')) {
                    if (line.startsWith('event:')) eventType = line.slice(6).trim();
                    else if (line.startsWith('data:')) data += line.slice(5).trim();
                }

                if (eventType !== 'updates' || !data) continue;

                let payload: any;
                try { payload = JSON.parse(data); } catch { continue; }

                for (const update of Object.values(payload) as any[]) {
                    if (update?.structuredResponse) {
                        structuredResponse = update.structuredResponse;
                    }

                    const lastMessage = update?.messages?.[update.messages.length - 1];
                    const toolCalls = lastMessage?.tool_calls;

                    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
                        const names = toolCalls.map((tc: any) => tc.name).filter(Boolean);
                        this.loadingStatus.set(this.statusForToolCalls(names));
                    }
                }
            }
        }

        this.loadingStatus.set('');
        this.result.set(structuredResponse ?? null);
    }

    async smartSearch(query: string): Promise<SmartSearchResult | null> {
        const { thread_id } = await firstValueFrom(
            this.http.post<ThreadResponse>(`${this.API}/threads`, {})
        );

        const response = await firstValueFrom(
            this.http.post<RunResponse>(`${this.API}/threads/${thread_id}/runs/wait`, {
                assistant_id: 'SmartSearchAgent',
                input: {
                    messages: [{ role: 'human', content: query }]
                }
            })
        );

        let sr: any = response.structuredResponse;
        if (!sr) {
            const msgs = (response as any).messages ?? [];
            const last = msgs[msgs.length - 1];
            const raw = typeof last?.content === 'string' ? last.content : null;
            if (raw) try { sr = JSON.parse(raw); } catch {}
        }
        return sr ?? null;
    }

    async regenerateMealPlanDay(day: MealPlanDay, location: string, dietary: string[] = []): Promise<Recipe | null> {
        const dietaryNote = dietary.length ? ` Dietary requirements: ${dietary.join(', ')}.` : '';
        const query = `Recipe for ${day.date}, something different from "${day.recipeName}".${dietaryNote} Use what's in season.`;

        const { thread_id } = await firstValueFrom(
            this.http.post<ThreadResponse>(`${this.API}/threads`, {})
        );

        const response = await firstValueFrom(
            this.http.post<RunResponse>(`${this.API}/threads/${thread_id}/runs/wait`, {
                assistant_id: 'Agent',
                input: {
                    messages: [{ role: 'human', content: `query: ${query}\nlocation: ${location}` }]
                },
                config: { configurable: { model: 'gpt-4o' } }
            })
        );

        const sr = response.structuredResponse as AgentResponse | undefined;
        return sr?.module === 'recipe' ? (sr.data as Recipe) : null;
    }

    updateMealPlanDay(date: string, recipe: Recipe): void {
        const current = this.result();
        if (current?.module !== 'meal-plan') return;

        const mealPlan = current.data;
        const blocks = mealPlan.blocks.map(block => ({
            ...block,
            days: block.days.map(d =>
                d.date === date
                    ? { ...d, recipeName: recipe.recipeName, ingredients: recipe.ingredients, steps: recipe.steps, imageUrl: recipe.imageUrl ?? null }
                    : d
            ),
        }));

        this.result.set({ ...current, data: { ...mealPlan, blocks } });
    }
}
