// LTA_KEY lives in Netlify > Site settings > Environment variables (never in the browser).
const B = 'https://datamall2.mytransport.sg/ltaodataservice/';
let cache;
const send = (c, b, age = 0) => ({
  statusCode: c,
  headers: { 'content-type': 'application/json', 'cache-control': age ? `public, max-age=${age}` : 'no-store' },
  body: JSON.stringify(b),
});
exports.handler = async (e) => {
  const key = (process.env.LTA_KEY || '').trim();
  if (!key) return send(500, { error: 'LTA_KEY is not set. Add it in Netlify environment variables, then redeploy.' });
  const h = { AccountKey: key, accept: 'application/json' };
  const q = e.queryStringParameters || {};
  const get = async (p) => {
    const r = await fetch(B + p, { headers: h });
    if (r.status === 401 || r.status === 403) throw new Error('LTA rejected the key. Check LTA_KEY is correct and approved.');
    if (!r.ok) throw new Error('LTA error ' + r.status);
    return r.json();
  };
  try {
    if (q.type === 'stops') {
      if (!cache) {
        const pages = await Promise.all(Array.from({ length: 12 }, (_, i) => get(`BusStops?$skip=${i * 500}`)));
        cache = pages.flatMap((j) => j.value || []).map((x) => [x.BusStopCode, x.Description, x.RoadName, +x.Latitude.toFixed(5), +x.Longitude.toFixed(5)]);
      }
      return send(200, cache, 86400);
    }
    const code = (q.stop || '').replace(/\D/g, '');
    if (code.length !== 5) return send(400, { error: 'Bus stop codes have 5 digits' });
    const j = await get(`v3/BusArrival?BusStopCode=${code}`);
    const nb = (n) => (n && n.EstimatedArrival ? { t: n.EstimatedArrival, ld: n.Load, dd: n.Type === 'DD', wab: n.Feature === 'WAB' } : null);
    const services = (j.Services || []).map((s) => ({ no: s.ServiceNo, to: s.NextBus && s.NextBus.DestinationCode, next: [nb(s.NextBus), nb(s.NextBus2), nb(s.NextBus3)] }));
    return send(200, { services });
  } catch (err) {
    return send(502, { error: err.message || 'Could not reach LTA' });
  }
};
