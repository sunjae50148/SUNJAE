import { createClient, VercelKV } from '@vercel/kv'

// Lazy KV client — defers connection until first use.
// This avoids build-time errors when env vars aren't yet available
// (e.g. during Next.js's page data collection phase).
let _kv: VercelKV | null = null

function getClient(): VercelKV {
  if (_kv) return _kv
  const url = process.env.sombre_KV_REST_API_URL || process.env.KV_REST_API_URL
  const token = process.env.sombre_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    throw new Error('KV env not configured: set KV_REST_API_URL / KV_REST_API_TOKEN')
  }
  _kv = createClient({ url, token })
  return _kv
}

export const kv = new Proxy({} as VercelKV, {
  get(_t, prop) {
    const client = getClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
