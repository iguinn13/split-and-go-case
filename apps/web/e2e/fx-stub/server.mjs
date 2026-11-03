// Tiny Frankfurter-compatible exchange rate stub used by the e2e stack (no real provider).
// GET /v1/<YYYY-MM-DD|latest>?base=USD&symbols=BRL -> {"amount":1.0,"base":"USD","date":"...","rates":{"BRL":5.4321}}
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 4010);
const RATES = { 'USD>BRL': '5.4321' };

const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://stub');
    if (url.pathname === '/health') {
        res.writeHead(200).end('ok');
        return;
    }
    const match = /^\/v1\/(latest|\d{4}-\d{2}-\d{2})$/.exec(url.pathname);
    const base = url.searchParams.get('base');
    const symbol = url.searchParams.get('symbols');
    const rate = RATES[`${base}>${symbol}`];
    if (!match || !rate) {
        res.writeHead(404, { 'content-type': 'application/json' }).end('{"message":"not found"}');
        return;
    }
    const date = match[1] === 'latest' ? new Date().toISOString().slice(0, 10) : match[1];
    res.writeHead(200, { 'content-type': 'application/json' }).end(
        `{"amount":1.0,"base":"${base}","date":"${date}","rates":{"${symbol}":${rate}}}`,
    );
});

server.listen(PORT, '0.0.0.0', () => console.log(`fx-stub listening on ${PORT}`));
