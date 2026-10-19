// AVIANART relay: a free Cloudflare Worker that lets this app's pages talk to
// avianart.games, in case AVIANART doesn't allow other sites to read it (CORS).
//
// It only passes on what the app needs:
//   GET  /api.php?action=presets                     AVIANART's preset list
//   POST /api.php?action=generate&preset=<preset>   roll a seed (a preset name, or namespace/preset)
//   POST /api.php?action=generate                   roll your own settings (AVIANART's customizer)
//   GET  /api.php?action=permlink&hash=<hash>        a seed (and its progress)
//   GET  /file?u=<url>                               a seed's base patch (.bps)
// and only for the pages listed in ALLOWED. Finished seeds are kept for a day.
//
// Deploy: dash.cloudflare.com → Workers & Pages → Create → Create Worker,
// name it "avianart-relay", Deploy, Edit code, paste this file, Deploy.

const ALLOWED = [
  'https://hugecrankhank.github.io',
];
const API = 'https://avianart.games/api.php';
// where AVIANART keeps base patches (it sends their address with each seed)
const FILE_HOSTS = /(^|\.)avianart\.games$|\.amazonaws\.com$|\.digitaloceanspaces\.com$|\.r2\.dev$|(^|\.)hiimcody1\.com$/;

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const ok = ALLOWED.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (!ok) return new Response('Not allowed', { status: 403 });
    const h = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

    const url = new URL(request.url);
    const json = (body, status = 200) => new Response(body, { status, headers: { ...h, 'Content-Type': 'application/json' } });

    if (url.pathname === '/api.php') {
      const action = url.searchParams.get('action');
      if (action === 'generate' && request.method === 'POST') {
        // a preset by name, or (no preset) your own settings, as AVIANART's customizer sends them
        const preset = url.searchParams.get('preset');
        if (preset !== null && !/^[a-z0-9_.-]{1,64}(\/[a-z0-9_.-]{1,64})?$/i.test(preset)) return json('{"status":400,"response":{"message":"bad preset"}}', 400);
        const body = await request.text();
        if (body.length > 16000) return json('{"status":400,"response":{"message":"too big"}}', 400);
        const r = await fetch(`${API}?action=generate` + (preset !== null ? `&preset=${encodeURIComponent(preset)}` : ''), {
          method: 'POST', headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/json' }, body,
        });
        return json(await r.text(), r.status);
      }
      if (action === 'presets' && request.method === 'GET') {
        const r = await fetch(`${API}?action=presets`, { cf: { cacheTtl: 3600, cacheEverything: true } });
        return json(await r.text(), r.status);
      }
      if (action === 'permlink' && request.method === 'GET') {
        const hash = url.searchParams.get('hash') || '';
        if (!/^[A-Za-z0-9]{1,40}$/.test(hash)) return json('{"status":400,"response":{"message":"bad hash"}}', 400);
        const cache = caches.default;
        const key = new Request(`https://avianart-relay.cache/perm/${hash}`);
        const hit = await cache.match(key);
        if (hit) return json(await hit.text());
        const r = await fetch(`${API}?action=permlink&hash=${hash}`);
        const text = await r.text();
        // keep finished seeds (no "status" left in the response) for a day
        let done = false;
        try { const j = JSON.parse(text); done = r.ok && j && j.response && !j.response.status && (j.response.bps_t0_p1 || j.response.patch); } catch (e) {}
        if (done) ctx.waitUntil(cache.put(key, new Response(text, { headers: { 'Cache-Control': 'max-age=86400' } })));
        return json(text, r.status);
      }
      return json('{"status":400,"response":{"message":"not relayed"}}', 400);
    }

    if (url.pathname === '/file' && request.method === 'GET') {
      let target;
      try { target = new URL(url.searchParams.get('u') || ''); } catch (e) { return new Response('bad url', { status: 400, headers: h }); }
      if (target.protocol !== 'https:' || !FILE_HOSTS.test(target.hostname) || !/\.bps$/i.test(target.pathname)) {
        return new Response('not relayed', { status: 400, headers: h });
      }
      const r = await fetch(target.toString(), { cf: { cacheTtl: 604800, cacheEverything: true } });
      return new Response(r.body, { status: r.status, headers: { ...h, 'Content-Type': 'application/octet-stream' } });
    }

    return new Response('Not found', { status: 404, headers: h });
  },
};
