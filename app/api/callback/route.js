import { NextResponse } from 'next/server'

// Redirect back to the registered origin (127.0.0.1 vs localhost would split the cookie)
const home = (path) => new URL(path, process.env.SPOTIFY_REDIRECT_URI)

export async function GET(req) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(home('/?error=denied'))
  if (!process.env.SPOTIFY_CLIENT_SECRET) return NextResponse.redirect(home('/?error=config'))

  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64')

  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    }),
  })
  const data = await r.json()
  if (!data.access_token) return NextResponse.redirect(home('/?error=token'))

  const res = NextResponse.redirect(home('/'))
  res.cookies.set('sp_token', data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600, // Spotify access tokens are valid for one hour
  })
  return res
}
