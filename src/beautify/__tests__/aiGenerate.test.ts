// Behavioural tests for the Gemini image-gen wrapper. We mock global.fetch
// rather than the function we're testing, so this also catches regressions
// in the request body shape and the response-parsing path.

import { generateAIBackground, AIBackgroundError, _setApiKeyForTests } from '../aiGenerate';

const ORIGINAL_FETCH = global.fetch;

beforeEach(() => {
  _setApiKeyForTests('test-key');
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  _setApiKeyForTests(null);
});

test('returns a data: URL built from the inline base64 image', async () => {
  global.fetch = jest.fn(async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }],
            },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  ) as unknown as typeof fetch;

  const uri = await generateAIBackground('warm misty mountains');
  expect(uri).toBe('data:image/png;base64,AAAA');
});

test('sends a POSTed JSON body containing the user prompt', async () => {
  const fetchMock = jest.fn(async () =>
    new Response(
      JSON.stringify({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'A' } }] } },
        ],
      }),
      { status: 200 }
    )
  );
  global.fetch = fetchMock as unknown as typeof fetch;

  await generateAIBackground('coastal cliffs at sunset');

  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toContain('gemini-2.5-flash-image');
  expect(url).toContain('key=test-key');
  expect(init.method).toBe('POST');
  const body = JSON.parse(init.body as string) as {
    contents: { parts: { text: string }[] }[];
  };
  expect(body.contents[0].parts[0].text).toContain('coastal cliffs at sunset');
});

test('throws AIBackgroundError on non-2xx responses', async () => {
  global.fetch = jest.fn(async () =>
    new Response('quota exceeded', { status: 429 })
  ) as unknown as typeof fetch;
  await expect(generateAIBackground('x')).rejects.toBeInstanceOf(AIBackgroundError);
});

test('throws AIBackgroundError when the response has no inline image data', async () => {
  global.fetch = jest.fn(async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'sorry' }] } }] }), {
      status: 200,
    })
  ) as unknown as typeof fetch;
  await expect(generateAIBackground('x')).rejects.toBeInstanceOf(AIBackgroundError);
});

test('throws AIBackgroundError when network fetch itself fails', async () => {
  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  await expect(generateAIBackground('x')).rejects.toBeInstanceOf(AIBackgroundError);
});

test('throws a configuration error when no API key is set', async () => {
  _setApiKeyForTests('');
  await expect(generateAIBackground('x')).rejects.toBeInstanceOf(AIBackgroundError);
  await expect(generateAIBackground('x')).rejects.toThrow(/not configured/i);
});
