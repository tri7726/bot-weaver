import OpenAIApi from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Tests the validity of an API key for a given provider.
 * @param {string} provider - 'openai', 'xai', 'anthropic', 'google', etc.
 * @param {string} apiKey - The key to test.
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testApiKey(provider, apiKey) {
    try {
        if (provider === 'openai' || provider === 'xai' || provider === 'deepseek' || provider === 'groq') {
            const baseURL = {
                'openai': 'https://api.openai.com/v1',
                'xai': 'https://api.x.ai/v1',
                'deepseek': 'https://api.deepseek.com',
                'groq': 'https://api.groq.com/openai/v1'
            }[provider];

            const openai = new OpenAIApi({ apiKey, baseURL });
            // Simple request to list models to verify key
            await openai.models.list();
            return { success: true, message: 'Connection successful.' };
        }

        if (provider === 'anthropic') {
            const anthropic = new Anthropic({ apiKey });
            // Anthropic doesn't have a simple list models, try a tiny completion
            await anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'ping' }]
            });
            return { success: true, message: 'Connection successful.' };
        }

        if (provider === 'google') {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            await model.generateContent("ping");
            return { success: true, message: 'Connection successful.' };
        }

        return { success: false, message: `Provider "${provider}" not supported for testing yet.` };
    } catch (err) {
        let errMsg = err.message;
        if (err.status === 401) errMsg = 'Invalid API key.';
        else if (err.status === 429) errMsg = 'Rate limit exceeded / No quota.';
        return { success: false, message: errMsg };
    }
}
