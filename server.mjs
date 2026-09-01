import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(root, 'dist')
const canonicalPath = path.join(root, 'server/data/ancp/generated/animal_records_one_row_per_animal.csv')
const manifestPath = path.join(root, 'server/data/ancp/table_manifest.csv')
const canonical = fs.existsSync(canonicalPath) ? fs.readFileSync(canonicalPath, 'utf8') : ''
const rows = canonical ? canonical.trim().split(/\r?\n/).length - 1 : 0
const manifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : ''
const breeds = [...new Set((manifest.match(/(?:Nelore|Guzerá|Brahman|Tabapuã|Sindi)/g) || []))]
function json(res, body, status = 200) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)) }
function serveStatic(req, res) { const requested = req.url === '/' ? '/index.html' : req.url.split('?')[0]; const file = path.normalize(path.join(publicDir, requested)); if (!file.startsWith(publicDir) || !fs.existsSync(file)) return json(res, { error: 'not_found' }, 404); const ext = path.extname(file); const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }; res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res) }
const server = http.createServer((req, res) => { const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`); if (url.pathname === '/api/health') return json(res, { ok: true, service: 'melhor-genetica', dataRows: rows }); if (url.pathname === '/api/catalog') return json(res, { edition: 'ANCP 2026', rows, breeds, source: 'Sumário de Touros ANCP 2026', tables: 59 }); if (url.pathname === '/api/recommend') return json(res, { profile: url.searchParams.get('profile') || 'cria', weights: { reproduction: 45, weaning: 30, growth: 10, carcass: 15 }, note: 'MVP demonstrativo: integração do motor analítico em progresso', recommendations: [] }); return serveStatic(req, res) })
const port = Number(process.env.PORT || 3000)
server.listen(port, () => console.log(`Melhor Genética listening on port ${port}`))
