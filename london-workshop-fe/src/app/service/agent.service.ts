import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AgentResponse, RunResponse, ThreadResponse, SmartSearchResult } from '../models/recipe.model';

const API = 'http://localhost:2024';

@Injectable({ providedIn: 'root' })
export class AIagentService {

    result = signal<AgentResponse | null>(null);

    constructor(private http: HttpClient) {}

    async runAgent(query: string, location: string, imageBase64?: string, model?: string,): Promise<void> {

        const content: any[] = [
            { type: 'text', text: `query: ${query}\nlocation: ${location}` }
        ];

        if (imageBase64) {
            content.push({ type: 'image_url', image_url: { url: imageBase64 } });
        }

        const { thread_id } = await firstValueFrom(
            this.http.post<ThreadResponse>(`${API}/threads`, {})
        );

        const response = await firstValueFrom(
            this.http.post<RunResponse>(`${API}/threads/${thread_id}/runs/wait`, {
                assistant_id: 'Agent',
                input: {
                    messages: [{ role: 'human', content }]
                },
                config: model ? { configurable: { model } } : undefined
            })
        );

        let sr: any = response.structuredResponse;
        if (!sr) {
            const msgs = (response as any).messages ?? [];
            const last = msgs[msgs.length - 1];
            const raw = typeof last?.content === 'string' ? last.content : null;
            if (raw) try { sr = JSON.parse(raw); } catch {}
        }
        this.result.set(sr ?? null);
    }

    async smartSearch(query: string): Promise<SmartSearchResult | null> {
        const { thread_id } = await firstValueFrom(
            this.http.post<ThreadResponse>(`${API}/threads`, {})
        );

        const response = await firstValueFrom(
            this.http.post<RunResponse>(`${API}/threads/${thread_id}/runs/wait`, {
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
}
