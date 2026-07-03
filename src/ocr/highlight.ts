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
  'This is a photograph or screenshot of a page of text. The user has marked',
  'one or more passages as "highlighted". A highlight can take any of these',
  'visual forms:',
  '  - A darker gray rectangle behind the text (Kindle / e-ink readers).',
  '  - A translucent colored overlay — yellow, pink, green, blue, orange, etc.',
  '    — over the text (highlighter pen on paper, or digital highlights in',
  '    Apple Books, Kobo, Google Play Books, PDF viewers, web articles).',
  '  - A colored underline beneath the text.',
  '  - A hand-drawn bracket, box, or vertical bar in the margin enclosing',
  '    the passage.',
  '',
  'Your task: identify the exact boundaries of the marked region(s), then',
  'return ONLY the text that falls inside.',
  '',
  'Critical rules:',
  '- The first marked character is the first character whose background or',
  '  underline differs from the surrounding plain text. Do NOT start earlier',
  '  in the sentence just because surrounding context would make the quote',
  '  feel more complete.',
  '- The last marked character is the last character covered by the marking.',
  '  Do NOT continue past it, even if the sentence keeps going. If the',
  '  marking ends mid-word or mid-sentence, stop there.',
  '- Lines above and below the marked region are NOT highlighted, even if',
  '  they finish the sentence. Ignore them.',
  '- Look at the background, underline, or surrounding bracket for every',
  '  word before including it. If the word is in plain unmarked text, leave',
  '  it out.',
  '- If multiple distinct passages are marked on the page (even in different',
  '  colors), include all of them, in reading order, separated by a blank',
  '  line. Treat each contiguous marking as one passage.',
  '- Merge soft-hyphenated line breaks (e.g. "under-\\nstand" → "understand")',
  '  and join wrapped lines within a single passage by a space.',
  '',
  'Output format — STRICT:',
  '- Reply with exactly one <answer>...</answer> block and nothing else.',
  '- No reasoning, no preamble, no "Let me look...", no alternate guesses, no quotation marks around the text.',
  '- Inside the tags, put either:',
  '    (a) the highlighted text exactly as it appears (multiple passages',
  '        separated by a blank line); or',
  `    (b) "${NONE_MARKER}: <one short sentence explaining why — e.g. no highlight visible, image too blurry to read, no text on page>".`,
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
