import { NextResponse } from 'next/server'

export async function GET() {
  const res = NextResponse.redirect(new URL('/', process.env.SPOTIFY_REDIRECT_URI))
  res.cookies.delete('sp_token')
  return res
}
