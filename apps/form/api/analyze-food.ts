import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { FoodAnalysisSchema } from '../src/lib/foodSchema.js';
import { methodOnly, requireAccess } from './_lib/http.js';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const SYSTEM = `You estimate food from a single photo for a personal nutrition log.
List each distinct food or drink you can see as its own item.
Estimate the edible portion in grams from visual cues: plate and cutlery size, packaging, typical servings.
Give kilocalories and protein in grams for that portion, using standard nutrition references.
Be honest about uncertainty: use "high" confidence only when the food and its portion are clear.
Hidden oils, sauces, fillings and mixed dishes lower confidence. When something material is ambiguous, ask one short question.
Never invent items you cannot see. If the photo shows no food or drink, return is_food false and no items.`;

const DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodOnly(req, res, 'POST') || !requireAccess(req, res)) return;
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Food recognition is not set up. Add ANTHROPIC_API_KEY on the server.' });
  }
  const match = typeof req.body?.image === 'string' ? DATA_URL.exec(req.body.image) : null;
  if (!match) return res.status(400).json({ error: 'Send a JPEG, PNG, WebP or GIF photo.' });
  const [, mediaType, data] = match;
  if (data.length > 5_000_000) return res.status(413).json({ error: 'Photo is too large.' });

  const client = new Anthropic();
  try {
    const message = await client.beta.messages.parse({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'medium', format: betaZodOutputFormat(FoodAnalysisSchema) },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg', data } },
            { type: 'text', text: 'Identify the food in this photo and estimate each item.' },
          ],
        },
      ],
    });
    if (message.stop_reason === 'refusal')
      return res.status(422).json({ error: 'The photo could not be analysed. Enter the food manually.' });
    if (!message.parsed_output) return res.status(502).json({ error: 'The analysis came back incomplete. Try again.' });
    return res.status(200).json(message.parsed_output);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError)
      return res.status(503).json({ error: 'The server API key was rejected. Check ANTHROPIC_API_KEY.' });
    if (e instanceof Anthropic.RateLimitError)
      return res.status(429).json({ error: 'Too many requests right now. Wait a moment and try again.' });
    if (e instanceof Anthropic.BadRequestError)
      return res.status(400).json({ error: 'The photo could not be processed. Try another one.' });
    if (e instanceof Anthropic.APIConnectionError)
      return res.status(502).json({ error: 'Could not reach the recognition service. Try again.' });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: 'The recognition service had a problem. Try again.' });
    console.error('analyze-food failed', e);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
}
