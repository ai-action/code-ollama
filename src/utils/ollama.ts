import { Ollama } from 'ollama';

import type { Role } from '../constants';

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'gemma4';

const client = new Ollama({ host: OLLAMA_HOST });

export interface Message {
  role: Role;
  content: string;
}

export async function* streamChat(
  messages: Message[],
  model: string = DEFAULT_MODEL,
): AsyncGenerator<string, void, unknown> {
  const response = await client.chat({
    model,
    messages,
    stream: true,
  });

  for await (const chunk of response) {
    if (chunk.message.content) {
      yield chunk.message.content;
    }
  }
}

export async function listModels(): Promise<string[]> {
  const response = await client.list();
  return response.models.map(({ name }) => name);
}
