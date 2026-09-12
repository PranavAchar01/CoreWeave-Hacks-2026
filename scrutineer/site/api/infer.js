// A relay, not a store.
//
// The page runs in a browser, and neither model endpoint allows a browser to call it directly, so
// one request shape is forwarded here and nothing else. The visitor's key travels in the request
// body, is used once for the upstream call, and is never written to disk, a log, or a response.
// Everything the visitor's key can reach is on this allowlist; everything else is refused.

const UPSTREAM = {
  wandb: {
    url: 'https://api.inference.wandb.ai/v1/chat/completions',
    models: new Set([
      'OpenPipe/Qwen3-14B-Instruct',
      'openai/gpt-oss-20b',
      'ibm-granite/granite-4.1-8b',
      'Qwen/Qwen3.6-27B',
    ]),
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    models: new Set(['claude-sonnet-5', 'claude-haiku-4-5-20251001', 'claude-opus-5']),
  },
};

// A complete HTML document with inline CSS runs well past 2000 tokens; capping there returned
// pages truncated mid-tag, which render as garbage and audit as nonsense.
const MAX_TOKENS = 8000;
const MAX_CHARS = 24000;

// Crude per-instance throttle. It is not a security boundary — the visitor's own key is the real
// cost control — it just stops one tab from hammering the function.
const seen = new Map();
function throttled(ip) {
  const now = Date.now();
  const hits = (seen.get(ip) || []).filter((t) => now - t < 60_000);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 2000) seen.clear();
  return hits.length > 90;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = (req.headers['x-forwarded-for'] || 'anon').split(',')[0].trim();
  if (throttled(ip)) return res.status(429).json({ error: 'too many requests from this address' });

  const b = req.body || {};
  const site = UPSTREAM[b.provider];
  if (!site) return res.status(400).json({ error: 'unknown provider' });
  if (!site.models.has(b.model)) return res.status(400).json({ error: `model not on the allowlist: ${b.model}` });
  if (typeof b.key !== 'string' || b.key.length < 20 || b.key.length > 300) {
    return res.status(400).json({ error: 'no usable key supplied' });
  }
  const system = String(b.system || '').slice(0, MAX_CHARS);
  const user = String(b.user || '').slice(0, MAX_CHARS);
  const maxTokens = Math.min(MAX_TOKENS, Math.max(16, parseInt(b.max_tokens, 10) || 4000));
  const temperature = Math.min(1.5, Math.max(0, Number(b.temperature) || 0));

  try {
    let upstream, payload, headers;
    if (b.provider === 'anthropic') {
      headers = { 'content-type': 'application/json', 'x-api-key': b.key, 'anthropic-version': '2023-06-01' };
      payload = { model: b.model, max_tokens: maxTokens, temperature, system,
                  messages: [{ role: 'user', content: user }] };
    } else {
      headers = { 'content-type': 'application/json', authorization: `Bearer ${b.key}` };
      if (b.project) headers['OpenAI-Project'] = String(b.project).slice(0, 120);
      payload = { model: b.model, max_tokens: maxTokens, temperature,
                  messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
      if (b.json_schema) {
        payload.response_format = { type: 'json_schema', json_schema: { name: 'decision', strict: true, schema: b.json_schema } };
      }
      if (Number.isInteger(b.seed)) payload.seed = b.seed;
    }
    upstream = await fetch(site.url, { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      // pass the upstream's own complaint through; it is the visitor's key and their answer
      return res.status(upstream.status).json({ error: data?.error?.message || `upstream ${upstream.status}` });
    }
    const text = b.provider === 'anthropic'
      ? (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
      : data?.choices?.[0]?.message?.content || '';
    const usage = b.provider === 'anthropic'
      ? { in: data?.usage?.input_tokens || 0, out: data?.usage?.output_tokens || 0 }
      : { in: data?.usage?.prompt_tokens || 0, out: data?.usage?.completion_tokens || 0 };
    return res.status(200).json({ text, usage });
  } catch (e) {
    return res.status(502).json({ error: 'relay could not reach the model endpoint' });
  }
}
