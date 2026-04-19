// Vercel Serverless Function — endpoint de salud.
// Consumido como sonda de availability pública.

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify({
    ok: true,
    service: 'SGM · TRANSPOWER',
    version: 'v2.0.0',
    ts: new Date().toISOString(),
    referencia: 'MO.00418.DE-GAC-AX.01 Ed. 02'
  }));
}
