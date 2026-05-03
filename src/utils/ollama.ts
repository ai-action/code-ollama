import { Ollama } from 'ollama';

import type { Role } from '../constants';
import { loadConfig } from './config';

const { host, model: DEFAULT_MODEL } = loadConfig();

const client = new Ollama({ host });

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
  const { models } = await client.list();
  return models.map(({ name }) => name);
}
