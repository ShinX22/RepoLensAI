import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

export const MODEL_NAME = 'gemini-3.8-flash';

export function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Executes a structured JSON prompt against the Gemini API.
 * Includes timeout handling and clean error reporting.
 */
export async function generateLlmJson(prompt: string, systemInstruction?: string, timeoutMs = 25000): Promise<any> {
  const ai = getAiClient();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    clearTimeout(timer);

    const rawText = response.text || '';
    if (!rawText.trim()) {
      throw new Error('Received empty response from model');
    }

    // Strip markdown code fences if present
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      // Attempt repair by finding the first '{' and last '}'
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const sliced = cleaned.substring(firstBrace, lastBrace + 1);
        return JSON.parse(sliced);
      }
      throw new Error(`Invalid JSON syntax in model response: ${rawText.slice(0, 150)}...`);
    }
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`LLM generation timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

/**
 * Smoke test for Gemini connectivity and JSON output validation.
 */
export async function testLlmConnection(): Promise<{ ok: boolean; model: string; message: string }> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { ok: false, model: MODEL_NAME, message: 'GEMINI_API_KEY is not configured in environment' };
    }

    const res = await generateLlmJson(
      'Respond with JSON {"status": "ok", "app": "RepoLens AI"}',
      'You are a testing assistant. Output valid JSON only.',
      12000
    );
    if (res && res.status === 'ok') {
      return { ok: true, model: MODEL_NAME, message: 'LLM connection successful and output verified' };
    }
    return { ok: false, model: MODEL_NAME, message: 'LLM output did not match expected structure' };
  } catch (err: any) {
    return { ok: false, model: MODEL_NAME, message: err.message || 'LLM connection failed' };
  }
}
