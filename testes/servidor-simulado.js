/* Sobe o Code.gs num servidor HTTP local (planilha em memória), para testar a ficha no modo servidor.
   node testes/servidor-simulado.js 8788 */
const http = require('http'), fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const abas = {}, cache = {};
function Aba(nome) {
  const linhas = [];
  return { linhas, appendRow(r) { linhas.push(r.slice()); }, setFrozenRows() {},
    getLastColumn() { return Math.max(0, ...linhas.map(l => l.length)); },
    getDataRange() { const w = this.getLastColumn(); return { getValues: () => linhas.map(l => { const c = l.slice(); while (c.length < w) c.push(''); return c.map(v => typeof v === 'string' ? v.replace(/^'/, '') : v); }) }; },
    getRange(r, c, nr = 1, nc = 1) { return { setValues(v) { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) linhas[r - 1 + i][c - 1 + j] = v[i][j]; }, setValue(v) { linhas[r - 1][c - 1] = v; } }; } };
}
const ctx = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => abas[n] || null, insertSheet: n => (abas[n] = Aba(n)) }) },
  CacheService: { getScriptCache: () => ({ get: k => (cache[k] && cache[k].ate > Date.now() ? cache[k].v : null), put: (k, v, s) => { cache[k] = { v, ate: Date.now() + s * 1000 }; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
    computeDigest: (_, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b) },
  ContentService: { MimeType: { JSON: 1 }, createTextOutput: s => ({ setMimeType() { return this; }, texto: s }) },
  JSON, Math, String, Number, Array, Object, parseInt, Date
};
vm.createContext(ctx); vm.runInContext(fs.readFileSync(__dirname + '/../backend/Code.gs', 'utf8'), ctx);
let fora = false;
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/__fora') { fora = true; return res.end('ok'); }
  if (req.url === '/__volta') { fora = false; return res.end('ok'); }
  if (req.url === '/__abas') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(Object.fromEntries(Object.entries(abas).map(([k, v]) => [k, v.linhas.length])))); }
  if (fora) { req.socket.destroy(); return; }
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    if (req.method === 'GET') { res.end(ctx.doGet().texto); return; }
    const out = ctx.doPost({ postData: { contents: body } }).texto;
    res.setHeader('Content-Type', 'application/json'); res.end(out);
  });
}).listen(+process.argv[2] || 8788, () => console.log('servidor simulado em', +process.argv[2] || 8788));
