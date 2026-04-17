import OpenAIApi from 'openai';
import { getKey, hasKey, rotateKey } from '../utils/keys.js';
import { strictFormat } from '../utils/text.js';

export class GPT {
    static prefix = 'openai';
    constructor(model_name, url, params) {
        this.model_name = model_name;
        this.params = params;
        this.url = url; // store so that we know whether a custom URL has been set

        this._initClient();
    }

    _initClient() {
        let config = {};
        if (this.url)
            config.baseURL = this.url;

        if (hasKey('OPENAI_ORG_ID'))
            config.organization = getKey('OPENAI_ORG_ID');

        config.apiKey = getKey('OPENAI_API_KEY');

        this.openai = new OpenAIApi(config);
    }

    async sendRequest(turns, systemMessage, stop_seq='***') {
        let model = this.model_name || "gpt-4o-mini";
        let res = null;

        try {
            console.log('Awaiting openai api response from model', model);
            
            if (this.url) {
                let messages = [{'role': 'system', 'content': systemMessage}].concat(turns);
                messages = strictFormat(messages);
                const pack = {
                    model: model,
                    messages,
                    stop: stop_seq,
                    ...(this.params || {})
                };
                if (model.includes('o1') || model.includes('o3') || model.includes('5')) {
                    delete pack.stop;
                }
                let completion = await this.openai.chat.completions.create(pack);
                if (completion.choices[0].finish_reason == 'length')
                    throw new Error('Context length exceeded'); 
                console.log('Received.');
                res = completion.choices[0].message.content;
            } 
            else {
                let messages = strictFormat(turns);
                messages = messages.map(message => {
                    message.content += stop_seq;
                    return message;
                });
                const response = await this.openai.responses.create({
                    model: model,
                    instructions: systemMessage,
                    input: messages,
                    ...(this.params || {})
                });
                console.log('Received.');
                res = response.output_text;
                let stop_seq_index = res.indexOf(stop_seq);
                res = stop_seq_index !== -1 ? res.slice(0, stop_seq_index) : res;
            }
        }
        catch (err) {
            if (err.status === 401 || err.status === 429 || err.status >= 500) {
                console.warn(`OpenAI API Error (${err.status}). Checking for fallback keys...`);
                if (rotateKey('OPENAI_API_KEY')) {
                    this._initClient();
                    return await this.sendRequest(turns, systemMessage, stop_seq);
                }
            }

            if ((err.message == 'Context length exceeded' || err.code == 'context_length_exceeded') && turns.length > 1) {
                console.log('Context length exceeded, trying again with shorter context.');
                return await this.sendRequest(turns.slice(1), systemMessage, stop_seq);
            } else if (err.message && err.message.includes('image_url')) {
                res = 'Vision is only supported by certain models.';
            } else {
                console.error(err);
                res = 'My brain disconnected, try again.';
            }
        }
        return res;
    }

    async sendVisionRequest(messages, systemMessage, imageBuffer) {
        const imageMessages = [...messages];
        imageMessages.push({
            role: "user",
            content: [
                { type: "input_text", text: systemMessage },
                {
                    type: "input_image",
                    image_url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
                }
            ]
        });
        
        return this.sendRequest(imageMessages, systemMessage);
    }

    async embed(text) {
        if (text.length > 8191)
            text = text.slice(0, 8191);
        
        try {
            const embedding = await this.openai.embeddings.create({
                model: this.model_name || "text-embedding-3-small",
                input: text,
                encoding_format: "float",
            });
            return embedding.data[0].embedding;
        } catch (err) {
            if (err.status === 401 || err.status === 429 || err.status >= 500) {
                if (rotateKey('OPENAI_API_KEY')) {
                    this._initClient();
                    return await this.embed(text);
                }
            }
            throw err;
        }
    }

}

const sendAudioRequest = async (text, model, voice, url) => {
    const payload = {
        model: model,
        voice: voice,
        input: text
    }

    let config = {};

    if (url)
        config.baseURL = url;

    if (hasKey('OPENAI_ORG_ID'))
        config.organization = getKey('OPENAI_ORG_ID');

    config.apiKey = getKey('OPENAI_API_KEY');

    const openai = new OpenAIApi(config);

    const mp3 = await openai.audio.speech.create(payload);
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64 = buffer.toString("base64");
    return base64;
}

export const TTSConfig = {
    sendAudioRequest: sendAudioRequest,
    baseUrl: 'https://api.openai.com/v1',
}
