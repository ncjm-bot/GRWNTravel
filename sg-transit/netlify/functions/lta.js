// Keeps your LTA key private. Set LTA_KEY in Netlify > Site settings > Environment variables.
const B = 'https://datamall2.mytransport.sg/ltaodataservice/';
let cache;
const send = (c, b, age = 0) => ({
  statusCode: c,
  headers: { 'content-type': 'application/json', 'cache-control': age ? `public, max-age=${age}` : 'no-store' },
  body: JSON.stringify(b),
});
exports.handler = async (e) => {
  const key = process.env.LTA_KEY;
  if (!key) return send(500, { error: 'LTA_KEY is not set' });
  const h = { AccountKey: key, accept: 'application/json' };
  const q = e.queryStringParameters || {};
  try {
    if (q.type === 'stops') {
      if (!cache) {
        let out = [];
        for (let s = 0; s < 6000; s += 500) {
          const j = await (await fetch(`${B}BusStops?$skip=${s}`, { headers: h })).json();
          if (!j.value || !j.value.length) break;
          out = out.concat(j.value.map((x) => [x.BusStopCode, x.Description, x.RoadName]));
        }
        cache = out;
      }
      return send(200, cache, 86400);
    }
    const code = (q.stop || '').replace(/\D/g, '');
    if (code.length !== 5) return send(400, { error: 'Bus stop codes have 5 digits' });
    const j = await (await fetch(`${B}v3/BusArrival?BusStopCode=${code}`, { headers: h })).json();
    const nb = (n) => (n && n.EstimatedArrival ? { t: n.EstimatedArrival, load: n.Load, dd: n.Type === 'DD', wab: n.Feature === 'WAB' } : null);
    const services = (j.Services || []).map((s) => ({ no: s.ServiceNo, next: [nb(s.NextBus), nb(s.NextBus2), nb(s.NextBus3)] }));
    return send(200, { services });
  } catch (err) {
    return send(502, { error: 'Could not reach LTA' });
  }
};
