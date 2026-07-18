// Singleton klienta Anthropic + stała modelu (wcześniej `new Anthropic(...)`
// i 'claude-opus-4-8' zaszyte na sztywno w 8 plikach — zmiana modelu = 8 edycji).
import Anthropic from '@anthropic-ai/sdk';

export const AI_MODEL = process.env.AI_MODEL || 'claude-opus-4-8';

let client: Anthropic | null = null;
export const getAnthropic = (): Anthropic => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
