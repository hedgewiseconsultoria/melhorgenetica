import assert from 'node:assert/strict'

const port = process.env.TEST_PORT || '4173'
const breeds = ['Nelore', 'Guzerá', 'Brahman', 'Tabapuã', 'Sindi']
const weights = encodeURIComponent(JSON.stringify({ '3P': 40, MP120: 25, STAY: 20, MGTe: 15 }))
const results = []
for (const breed of breeds) {
  const url = `http://127.0.0.1:${port}/api/recommend?breed=${encodeURIComponent(breed)}&minAccuracy=0&maxTop=100&protect=false&required=&weights=${weights}`
  const response = await fetch(url)
  assert.equal(response.ok, true, `${breed}: resposta HTTP inválida`)
  const body = await response.json()
  assert.ok(body.total > 0, `${breed}: nenhum candidato retornado`)
  assert.ok(body.recommendations.every((item) => item.breed === breed), `${breed}: filtro retornou raça diferente`)
  results.push({ breed, total: body.total })
}
console.log(JSON.stringify({ ok: true, results }, null, 2))
