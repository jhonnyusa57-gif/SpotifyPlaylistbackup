import { NextResponse } from 'next/server'
import { chunk, trackId } from '../../../lib/spotify'

const API = 'https://api.spotify.com/v1'

async function spGetJson(token, url) {
  const r = await fetch(API + url, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`)
  return r.json()
}

async function spSend(token, method, url, body) {
  const r = await fetch(API + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status}`)
  return r.status === 204 ? null : r.json()
}

// Names of playlists the target account already has, so a re-run does not duplicate them.
// shortcut: matches by name only; upgrade to an id map if exact-duplicate names must be kept apart.
async function existingPlaylistNames(token) {
  const names = new Set()
  let next = API + '/me/playlists?limit=50'
  while (next) {
    const r = await fetch(next, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) break
    const d = await r.json()
    for (const p of d.items || []) names.add(p.name)
    next = d.next
  }
  return names
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

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      try {
        const me = await spGetJson(token, '/me')
        const playlists = backup.playlists || []
        const total = playlists.length
        const existing = await existingPlaylistNames(token)

        let playlistsMade = 0
        let tracksAdded = 0
        let skipped = 0
        for (let i = 0; i < playlists.length; i++) {
          const pl = playlists[i]
          send({ type: 'progress', done: i, total, name: pl.name })
          if (existing.has(pl.name)) {
            skipped++
            continue
          }
          const created = await spSend(token, 'POST', `/users/${me.id}/playlists`, {
            name: pl.name,
            description: pl.description || '',
            public: !!pl.public,
          })
          existing.add(pl.name)
          const uris = (pl.tracks || []).map((t) => t.uri)
          for (const part of chunk(uris, 100)) {
            if (!part.length) continue
            await spSend(token, 'POST', `/playlists/${created.id}/tracks`, { uris: part })
            tracksAdded += part.length
          }
          playlistsMade++
        }
        send({ type: 'progress', done: total, total, name: '' })

        // Liked songs — saving an already-liked song is a no-op, so re-runs are safe
        let likedAdded = 0
        const likedIds = (backup.likedSongs || []).map((t) => trackId(t.uri))
        for (const part of chunk(likedIds, 50)) {
          if (!part.length) continue
          await spSend(token, 'PUT', '/me/tracks', { ids: part })
          likedAdded += part.length
        }

        // Followed artists — also idempotent; kept optional so a scope hiccup never loses the rest
        let artistsFollowed = 0
        try {
          const artistIds = (backup.followedArtists || []).map((a) => a.id)
          for (const part of chunk(artistIds, 50)) {
            if (!part.length) continue
            await spSend(token, 'PUT', `/me/following?type=artist&ids=${part.join(',')}`)
            artistsFollowed += part.length
          }
        } catch {}

        send({ type: 'done', importedTo: me.display_name || me.id, playlistsMade, tracksAdded, likedAdded, artistsFollowed, skipped })
      } catch (e) {
        send({ type: 'error', error: String(e.message || e) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache' },
  })
}
