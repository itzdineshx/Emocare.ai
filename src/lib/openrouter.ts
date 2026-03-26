import { retryAI } from '@/src/lib/ai-retry';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
const OPENROUTER_MODEL = (import.meta.env.VITE_OPENROUTER_MODEL as string | undefined) || 'google/gemini-2.0-flash-lite-001';
const OPENROUTER_MIN_INTERVAL_MS = Number(import.meta.env.VITE_OPENROUTER_MIN_INTERVAL_MS || 2500);

let lastRequestAt = 0;

async function throttleOpenRouterCalls() {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < OPENROUTER_MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, OPENROUTER_MIN_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

async function postOpenRouter(payload: Record<string, unknown>): Promise<any> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('VITE_OPENROUTER_API_KEY is missing.');
  }

  await throttleOpenRouterCalls();

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'EmoCare AI',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${errorBody}`);
  }

  return response.json();
}

function getMessageContent(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('\n').trim();
  }

  return '';
}

export async function generateOpenRouterText(prompt: string): Promise<string> {
  return retryAI(async () => {
    const data = await postOpenRouter({
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 320,
    });

    const text = getMessageContent(data);
    if (!text) {
      throw new Error('OpenRouter returned empty text response.');
    }

    return text;
  }, 3, 1500);
}

export async function generateOpenRouterVisionText(args: {
  prompt: string;
  base64Image?: string;
}): Promise<string> {
  return retryAI(async () => {
    const content = args.base64Image
      ? [
          { type: 'text', text: args.prompt },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${args.base64Image}` },
          },
        ]
      : args.prompt;

    const data = await postOpenRouter({
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content }],
      temperature: 0.4,
      max_tokens: 320,
    });

    const text = getMessageContent(data);
    if (!text) {
      throw new Error('OpenRouter returned empty text response.');
    }

    return text;
  }, 3, 1500);
}

export async function generateOpenRouterVisionJson(args: {
  prompt: string;
  base64Image: string;
}): Promise<any> {
  return retryAI(async () => {
    const data = await postOpenRouter({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `${args.prompt}\n\nReturn only valid JSON.` },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${args.base64Image}` },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });

    const text = getMessageContent(data);
    if (!text) {
      throw new Error('OpenRouter returned empty JSON response.');
    }

    return JSON.parse(text);
  }, 3, 1500);
}
