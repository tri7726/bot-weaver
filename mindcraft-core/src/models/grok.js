import OpenAIApi from 'openai';
import { getKey, rotateKey } from '../utils/keys.js';

// xAI doesn't supply a SDK for their models, but fully supports OpenAI and Anthropic SDKs
export class Grok {
    static prefix = 'xai';
    constructor(model_name, url, params) {
        this.model_name = model_name;
        this.url = url;
        this.params = params;

        this._initClient();
    }

    _initClient() {
        let config = {};
        if (this.url)
            config.baseURL = this.url;
        else
            config.baseURL = "https://api.x.ai/v1"

        config.apiKey = getKey('XAI_API_KEY');
        this.openai = new OpenAIApi(config);
    }

    async sendRequest(turns, systemMessage) {
        let messages = [{'role': 'system', 'content': systemMessage}].concat(turns);

        const pack = {
            model: this.model_name || "grok-3-mini-latest",
            messages,
            ...(this.params || {})
        };

        let res = null;
        try {
            console.log('Awaiting xai api response...')
            let completion = await this.openai.chat.completions.create(pack);
            if (completion.choices[0].finish_reason == 'length')
                throw new Error('Context length exceeded'); 
            console.log('Received.')
            res = completion.choices[0].message.content;
        }
        catch (err) {
            // Rotation Logic
            if (err.status === 401 || err.status === 429 || err.status >= 500) {
                console.warn(`Grok API Error (${err.status}). Checking for fallback keys...`);
                if (rotateKey('XAI_API_KEY')) {
                    this._initClient(); // Re-init with new key
                    return await this.sendRequest(turns, systemMessage);
                }
            }

            if ((err.message == 'Context length exceeded' || err.code == 'context_length_exceeded') && turns.length > 1) {
                console.log('Context length exceeded, trying again with shorter context.');
                return await this.sendRequest(turns.slice(1), systemMessage);
            } else if (err.message && err.message.includes('single `text` element')) {
                res = 'Vision is only supported by certain models.';
            } else {
                console.error(err);
                res = 'My brain disconnected, try again.';
            }
        }
        return res ? res.replace(/<\|separator\|>/g, '*no response*') : '*no response*';
    }

    async sendVisionRequest(messages, systemMessage, imageBuffer) {
        const imageMessages = [...messages];
        imageMessages.push({
            role: "user",
            content: [
                { type: "text", text: systemMessage },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
                    }
                }
            ]
        });
        
        return this.sendRequest(imageMessages, systemMessage);
    }
    
    async embed(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: "grok-embedding-v1", 
                input: text,
            });
            return response.data[0].embedding;
        } catch (err) {
            console.error("Grok embedding error:", err);
            // Fallback or throw
            throw err;
        }
    }
}



