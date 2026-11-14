import { NextResponse } from 'next/server'
import { spGet, fetchAllItems } from '../../../lib/spotify'

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

    return NextResponse.json({
      app: 'streamlifyBackup',
      exportedAt: new Date().toISOString(),
      account: { id: me.id, name: me.display_name || me.id },
      playlists,
      likedSongs,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}
