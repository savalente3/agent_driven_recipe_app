import { ChatOpenAI } from '@langchain/openai';

// Orchestrator — needs vision for image ingredient extraction
export const orchestratorModel = new ChatOpenAI({
    model: 'gpt-4o',
    maxTokens: 4000,
    timeout: 30000,
});

// Sub-agents — creative writing + reliable tool use, faster than gpt-4o
export const subAgentModel = new ChatOpenAI({
    model: 'gpt-4.1',
    maxTokens: 4000,
    timeout: 30000,
});

// Smart search agent — real-time intent and requirement extraction, fast and cheap
export const smartSearchModel = new ChatOpenAI({
    model: 'gpt-4o-mini',
    maxTokens: 200,
    timeout: 10000,
    temperature: 0,
});

