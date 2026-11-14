import { NextResponse } from 'next/server'

const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-modify',
  'user-follow-read',
  'user-follow-modify',
].join(' ')

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    scope: SCOPES,
    show_dialog: 'true', // always show the account picker so users can switch from account A to B
  })
  const res = NextResponse.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`)
  res.cookies.delete('sp_token') // drop the previous account before a new login (clean switch)
  return res
}
