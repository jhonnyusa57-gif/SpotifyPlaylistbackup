const API = 'https://api.spotify.com/v1'

export async function spGet(token, url) {
  const r = await fetch(url.startsWith('http') ? url : API + url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error(`Spotify GET ${r.status}: ${url}`)
  return r.json()
}

// Spotify returns lists in pages (via the `next` URL). Collect every item.
export async function fetchAllItems(token, startUrl) {
  const items = []
  let next = startUrl.startsWith('http') ? startUrl : API + startUrl
  while (next) {
    const data = await spGet(token, next)
    items.push(...(data.items || []))
    next = data.next
  }
  return items
}

export function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export const trackId = (uri) => uri.split(':').pop()
