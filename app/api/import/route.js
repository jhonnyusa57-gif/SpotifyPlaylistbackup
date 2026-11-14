import { NextResponse } from 'next/server'
import { chunk, trackId } from '../../../lib/spotify'

const API = 'https://api.spotify.com/v1'

// Which playlists should be recreated on the new account? true = create, false = skip.
// pl has: name, owned (true if the old account created it), public, trackCount.
function shouldImportPlaylist(pl) {
  // TODO(human)
}

async function spPost(token, url, body) {
  const r = await fetch(API + url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`POST ${url} -> ${r.status}`)
  return r.json()
}

export async function POST(req) {
  const token = req.cookies.get('sp_token')?.value
  if (!token) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  let backup
  try {
    backup = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  try {
    const meRes = await fetch(API + '/me', { headers: { Authorization: `Bearer ${token}` } })
    if (!meRes.ok) throw new Error(`/me -> ${meRes.status}`)
    const me = await meRes.json()

    let playlistsMade = 0
    let tracksAdded = 0
    for (const pl of backup.playlists || []) {
      if (!shouldImportPlaylist(pl)) continue
      const created = await spPost(token, `/users/${me.id}/playlists`, {
        name: pl.name,
        description: pl.description || '',
        public: !!pl.public,
      })
      const uris = (pl.tracks || []).map((t) => t.uri)
      for (const part of chunk(uris, 100)) {
        // Spotify accepts at most 100 tracks per request
        if (part.length === 0) continue
        await spPost(token, `/playlists/${created.id}/tracks`, { uris: part })
        tracksAdded += part.length
      }
      playlistsMade++
    }

    let likedAdded = 0
    const likedIds = (backup.likedSongs || []).map((t) => trackId(t.uri))
    for (const part of chunk(likedIds, 50)) {
      // saving liked songs accepts at most 50 ids per request
      if (part.length === 0) continue
      const r = await fetch(API + '/me/tracks', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: part }),
      })
      if (!r.ok) throw new Error(`PUT /me/tracks -> ${r.status}`)
      likedAdded += part.length
    }

    return NextResponse.json({
      ok: true,
      importedTo: me.display_name || me.id,
      playlistsMade,
      tracksAdded,
      likedAdded,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}
