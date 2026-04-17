import Anthropic from '@anthropic-ai/sdk';
import { strictFormat } from '../utils/text.js';
import { getKey, rotateKey } from '../utils/keys.js';

export class Claude {
    static prefix = 'anthropic';
    constructor(model_name, url, params) {
        this.model_name = model_name;
        this.url = url;
        this.params = params || {};

        this._initClient();
    }

    _initClient() {
        let config = {};
        if (this.url)
            config.baseURL = this.url;
        
        config.apiKey = getKey('ANTHROPIC_API_KEY');

        this.anthropic = new Anthropic(config);
    }

    async sendRequest(turns, systemMessage) {
        const messages = strictFormat(turns);
        let res = null;
        try {
            console.log(`Awaiting anthropic response from ${this.model_name}...`)
            if (!this.params.max_tokens) {
                if (this.params.thinking?.budget_tokens) {
                    this.params.max_tokens = this.params.thinking.budget_tokens + 1000;
                } else {
                    this.params.max_tokens = 4096;
                }
            }
            const resp = await this.anthropic.messages.create({
                model: this.model_name || "claude-sonnet-4-20250514",
                system: systemMessage,
                messages: messages,
                ...(this.params || {})
            });

            console.log('Received.')
            const textContent = resp.content.find(content => content.type === 'text');
            if (textContent) {
                res = textContent.text;
            } else {
                console.warn('No text content found in the response.');
                res = 'No response from Claude.';
            }
        }
        catch (err) {
            // Rotation Logic
            if (err.status === 401 || err.status === 429 || err.status >= 500) {
                if (rotateKey('ANTHROPIC_API_KEY')) {
                    this._initClient();
                    return await this.sendRequest(turns, systemMessage);
                }
            }

            if (err.message && err.message.includes("does not support image input")) {
                res = "Vision is only supported by certain models.";
            } else {
                console.error(err);
                res = "My brain disconnected, try again.";
            }
        }
        return res;
    }

    async sendVisionRequest(turns, systemMessage, imageBuffer) {
        const imageMessages = [...turns];
        imageMessages.push({
            role: "user",
            content: [
                {
                    type: "text",
                    text: systemMessage
                },
                {
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: "image/jpeg",
                        data: imageBuffer.toString('base64')
                    }
                }
            ]
        });

        return this.sendRequest(imageMessages, systemMessage);
    }

    async embed(text) {
        throw new Error('Embeddings are not supported by Claude.');
    }
}
