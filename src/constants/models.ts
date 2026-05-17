export interface ModelCatalogEntry {
  label: string;
  value: string;
}

/**
 * @see https://ollama.com/library
 */
export const CATALOG: ModelCatalogEntry[] = [
  { label: 'Gemma 4 (gemma4:latest)', value: 'gemma4:latest' },
  { label: 'Granite 4 (granite4.1:8b)', value: 'granite4.1:8b' },
  {
    label: 'Qwen 2.5 Coder (qwen2.5-coder:latest)',
    value: 'qwen2.5-coder:latest',
  },
  {
    label: 'DeepSeek Coder V2 (deepseek-coder-v2:latest)',
    value: 'deepseek-coder-v2:latest',
  },
];
