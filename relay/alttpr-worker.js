// alttpr.com relay: a free Cloudflare Worker that lets Rando Hub load seeds from
// alttpr.com. alttpr.com doesn't let web pages on other sites read its seeds
// (CORS), so the app asks this relay and the relay asks alttpr.com.
//
// It only passes on what the app needs, only reads, and only for the pages
// listed in ALLOWED:
//   GET /hash/<id>        a seed's patch                      (alttpr.com/hash/<id>)
//   GET /api/h/<id>       which base ROM build the seed needs (alttpr.com/api/h/<id>)
//   GET /bps/<md5>.bps    that build's base patch             (alttpr.com/bps/<md5>.bps)
// Seeds are kept for a day, so a race where everyone loads the same seed asks
// alttpr.com once. Base patches never change, so they're kept for a week.
//
// Deploy: dash.cloudflare.com → Workers & Pages → Create → Create Worker,
// name it "alttpr-relay", Deploy, Edit code, paste this file, Deploy.
// Then in Rando Hub: Randomizer → ROM options → alttpr.com relay, paste the
// worker's address (https://alttpr-relay.<your-name>.workers.dev).

const ALLOWED = [
  'https://hugecrankhank.github.io',
];
const SITE = 'https://alttpr.com';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    if (request.method !== 'GET') return new Response('Only GET', { status: 405, headers: h });

    const path = new URL(request.url).pathname;
    let ttl, type;
    if (/^\/(hash|api\/h)\/[A-Za-z0-9]{10}$/.test(path)) { ttl = 86400; type = 'application/json'; }
    else if (/^\/bps\/[0-9a-f]{32}\.bps$/.test(path)) { ttl = 604800; type = 'application/octet-stream'; }
    else return new Response('Not found', { status: 404, headers: h });

    const cache = caches.default;
    const key = new Request(SITE + path);
    let res = await cache.match(key);
    if (!res) {
      const r = await fetch(SITE + path, { headers: { 'Accept': type === 'application/json' ? 'application/json' : '*/*' } });
      if (!r.ok) return new Response(r.status === 404 ? 'No such seed' : 'alttpr.com error', { status: r.status, headers: h });
      const body = await r.arrayBuffer();
      res = new Response(body, { headers: { 'Content-Type': type, 'Cache-Control': `max-age=${ttl}` } });
      ctx.waitUntil(cache.put(key, res.clone()));
    }
    return new Response(res.body, { status: 200, headers: { ...h, 'Content-Type': type } });
  },
};
