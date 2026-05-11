import * as ImageManipulator from 'expo-image-manipulator';

// Resize photos to this width before sending. Sonnet reads Kindle text fine at
// 1200px and the smaller payload cuts upload time noticeably.
const ANALYSIS_WIDTH = 1200;

// Sonnet 4.6 is materially better than Haiku at subtle visual contrast and
// at obeying boundary rules. ~3x the cost, still ~$0.006/extraction.
const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_VERSION = '2023-06-01';

const NONE_MARKER = 'NONE';

const PROMPT = [
  'This is a photograph of a Kindle e-reader screen. The user has highlighted',
  'a passage by selecting text on the device — highlighted text sits on a',
  'visibly darker grey rectangle compared to the surrounding page background.',
  '',
  'Your task: identify the exact boundaries of the darker rectangle, then',
  'return ONLY the text that falls inside those boundaries.',
  '',
  'Critical rules:',
  '- The first highlighted character is the first character on the darker background.',
  '  Do NOT start earlier in the sentence just because surrounding context would',
  '  make the quote feel more complete.',
  '- The last highlighted character is the last character on the darker background.',
  '  Do NOT continue past the end of the highlight, even if the sentence keeps',
  '  going on the page. If the highlight ends mid-word or mid-sentence, stop there.',
  '- Lines above and below the darker region are NOT highlighted, even if they',
  '  finish the sentence. Ignore them completely.',
  '- Look at the background colour behind every word before including it.',
  '  If the background is the lighter page colour, that word is not highlighted.',
  '',
  'Output format — STRICT:',
  '- Reply with exactly one <answer>...</answer> block and nothing else.',
  '- No reasoning, no preamble, no "Let me look...", no alternate guesses, no quotation marks around the text.',
  '- Inside the tags, put either:',
  '    (a) the highlighted text exactly as it appears, with multi-line highlights joined by single spaces and soft-hyphenated line breaks merged (e.g. "under-\\nstand" → "understand"); or',
  `    (b) "${NONE_MARKER}: <one short sentence explaining why — e.g. no highlight visible, image too blurry to read, not a Kindle screen>".`,
  '',
  'Example valid replies:',
  '<answer>The map is not the territory.</answer>',
  '<answer>NONE: no highlight visible</answer>',
].join('\n');

const ANSWER_OPEN = '<answer>';
const ANSWER_CLOSE = '</answer>';

export type HighlightResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'no-highlight' | 'no-api-key' | 'api-error' | 'network'; detail?: string };

export async function extractHighlightedText(originalUri: string): Promise<HighlightResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'no-api-key' };
  }

  // Resize and re-encode as JPEG with base64 so we can put it directly in the request.
  // High compress value preserves the subtle contrast between page and highlight.
  const resized = await ImageManipulator.manipulateAsync(
    originalUri,
    [{ resize: { width: ANALYSIS_WIDTH } }],
    {
      compress: 0.95,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );
  if (!resized.base64) {
    return { ok: false, reason: 'api-error' };
  }

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        // Highlights are short. Lower cap = faster generation and a hard ceiling
        // against the model dumping the whole page.
        max_tokens: 512,
        // Stop as soon as the model closes the answer tag. The model may
        // still emit reasoning before the opening tag — we strip that on
        // the client side. Sonnet 4.6 doesn't allow assistant-message
        // prefill, so we can't physically prevent the preamble; the tag
        // wrapper + post-parse is the next-best thing.
        stop_sequences: [ANSWER_CLOSE],
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: resized.base64,
                },
              },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });
  } catch {
    return { ok: false, reason: 'network' };
  }

  if (!response.ok) {
    // Pull the error body so we can see WHY the API rejected the request —
    // 400s in particular tell us about bad model ID, bad image, prefill etc.
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '(unreadable)';
    }
    if (__DEV__) {
      console.warn('[highlight] api error', response.status, body);
    }
    return { ok: false, reason: 'api-error' };
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch (e) {
    if (__DEV__) console.warn('[highlight] api response not json', e);
    return { ok: false, reason: 'api-error' };
  }

  const blocks: any[] = Array.isArray(payload?.content) ? payload.content : [];
  const raw = blocks
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
    .trim();

  // Sonnet may include reasoning before the opening tag. Pull out the answer
  // body explicitly. The stop sequence strips the closing tag, so we look for
  // <answer>...(end-of-string) — anything after the opener is the answer.
  const tagMatch = raw.match(/<answer>([\s\S]*?)(?:<\/answer>|$)/i);
  const text = (tagMatch ? tagMatch[1] : raw).trim();

  if (__DEV__) {
    // Surfaced in the Metro terminal so you can see exactly what the model said.
    console.log('[highlight] model response:', JSON.stringify(text));
  }

  if (!text) {
    return { ok: false, reason: 'no-highlight' };
  }

  // Strip a leading "NONE" / "NONE:" / "NONE: reason"
  const noneMatch = text.match(/^NONE\b\s*:?\s*(.*)$/is);
  if (noneMatch) {
    const detail = noneMatch[1]?.trim() || undefined;
    return { ok: false, reason: 'no-highlight', detail };
  }

  return { ok: true, text };
}

function getApiKey(): string | undefined {
  // Expo inlines EXPO_PUBLIC_* env vars at build time. For personal/dev builds
  // this is fine; for a production app this key should live behind a server.
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  return key && key.length > 0 ? key : undefined;
}
