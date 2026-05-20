// AI background generator for the beautify flow (Pro-only feature).
//
// Calls Google's Gemini image-generation endpoint
// (`gemini-2.5-flash-image-preview`, aka "nanobanana"). The response carries
// PNG bytes inline as base64, which we wrap in a `data:` URL so React
// Native's <Image source={{ uri }} /> can render it directly — no file
// system writes, no upload bucket. Generated backgrounds live in the
// beautify screen's component state and survive only until the user leaves
// the screen, which is fine for v1.
//
// The API key is read from EXPO_PUBLIC_GOOGLE_AI_API_KEY at module load,
// matching the existing EXPO_PUBLIC_ANTHROPIC_API_KEY pattern used for OCR.

const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Read the key lazily so tests can inject a value without fighting babel's
// build-time inlining of `process.env.EXPO_PUBLIC_*`.
let apiKeyOverride: string | null = null;

function getApiKey(): string {
  if (apiKeyOverride !== null) return apiKeyOverride;
  return process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY ?? '';
}

// Test seam: lets unit tests run without needing the env var set, and lets
// the "no key configured" case be exercised explicitly. Pass null to clear.
export function _setApiKeyForTests(key: string | null): void {
  apiKeyOverride = key;
}

// Wraps the user's prompt with framing that biases the model toward
// quote-card-friendly outputs: square, abstract/atmospheric, no text or
// faces (both of which would clash with the overlaid highlight).
function buildPrompt(userPrompt: string): string {
  const cleaned = userPrompt.trim().slice(0, 300);
  return [
    'Generate a square 1:1 background image suitable for overlaying a book quote.',
    'Style: abstract, atmospheric, painterly, soft lighting, rich colour, no text, no people, no faces, no logos.',
    'Composition should be balanced with no sharp focal points in the centre, so quote text overlays cleanly.',
    `Theme: ${cleaned || 'calm, contemplative, evocative of reading'}.`,
  ].join(' ');
}

export class AIBackgroundError extends Error {}

export async function generateAIBackground(userPrompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new AIBackgroundError(
      'AI image generation is not configured. Set EXPO_PUBLIC_GOOGLE_AI_API_KEY.'
    );
  }

  const body = {
    contents: [{ parts: [{ text: buildPrompt(userPrompt) }] }],
    generationConfig: {
      // Asking for IMAGE only — text parts in the reply would be ignored anyway.
      responseModalities: ['IMAGE'],
    },
  };

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e: unknown) {
    throw new AIBackgroundError(
      `Network error contacting the image generator: ${(e as Error)?.message ?? 'unknown'}`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AIBackgroundError(
      `Image generator returned ${res.status}: ${text.slice(0, 200) || 'no body'}`
    );
  }

  // Response shape: { candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }] }
  type InlinePart = { inlineData?: { mimeType?: string; data?: string } };
  type Candidate = { content?: { parts?: InlinePart[] } };
  const json = (await res.json()) as { candidates?: Candidate[] };

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  const data = imagePart?.inlineData?.data;
  const mime = imagePart?.inlineData?.mimeType ?? 'image/png';

  if (!data) {
    throw new AIBackgroundError(
      'The image generator did not return an image. Try a different prompt.'
    );
  }

  return `data:${mime};base64,${data}`;
}
