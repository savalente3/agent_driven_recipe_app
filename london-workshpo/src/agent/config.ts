import { ChatOpenAI } from '@langchain/openai';

export const orchestratorModel = new ChatOpenAI({
    model: 'gpt-4o',
    maxTokens: 4000,
    timeout: 30000,
});

export const subAgentModel = new ChatOpenAI({
    model: 'gpt-4.1',
    maxTokens: 8000,
    timeout: 60000,
});

export const smartSearchModel = new ChatOpenAI({
    model: 'gpt-4o-mini',
    maxTokens: 200,
    timeout: 10000,
    temperature: 0,
});

