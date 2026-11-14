import { NextResponse } from 'next/server'
import { spGet, fetchAllItems } from '../../../lib/spotify'

const API = 'https://api.spotify.com/v1'

// Followed artists use cursor pagination (data.artists.next), not the usual data.next.
// Tolerant: an older token without the follow scope just yields an empty list.
async function fetchFollowedArtists(token) {
  try {
    const out = []
    let url = API + '/me/following?type=artist&limit=50'
    while (url) {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) break
      const d = await r.json()
      const a = d.artists || {}
      for (const ar of a.items || []) out.push({ id: ar.id, name: ar.name })
      url = a.next
    }
    return out
  } catch {
    return []
  }
}

export async function GET(req) {
  const token = req.cookies.get('sp_token')?.value
  if (!token) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  try {
    const me = await spGet(token, '/me')
    const rawPlaylists = await fetchAllItems(token, '/me/playlists?limit=50')

    const playlists = []
    for (const pl of rawPlaylists) {
      const items = await fetchAllItems(
        token,
        `/playlists/${pl.id}/tracks?limit=100&fields=next,items(track(uri,name,artists(name),album(name)))`
      )
      const tracks = items
        .map((it) => it.track)
        .filter((t) => t && t.uri && t.uri.startsWith('spotify:track:')) // skip local files and removed tracks
        .map((t) => ({
          uri: t.uri,
          name: t.name,
          artists: (t.artists || []).map((a) => a.name).join(', '),
          album: t.album?.name || '',
        }))
      playlists.push({
        name: pl.name,
        description: pl.description || '',
        public: pl.public,
        owned: pl.owner?.id === me.id,
        trackCount: tracks.length,
        tracks,
      })
    }

    const likedRaw = await fetchAllItems(token, '/me/tracks?limit=50')
    const likedSongs = likedRaw
      .map((it) => it.track)
      .filter((t) => t && t.uri && t.uri.startsWith('spotify:track:'))
      .map((t) => ({
        uri: t.uri,
        name: t.name,
        artists: (t.artists || []).map((a) => a.name).join(', '),
      }))

    const followedArtists = await fetchFollowedArtists(token)

    return NextResponse.json({
      app: 'streamlifyBackup',
      exportedAt: new Date().toISOString(),
      account: { id: me.id, name: me.display_name || me.id },
      playlists,
      likedSongs,
      followedArtists,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}
