import { NextResponse } from 'next/server'

export async function GET(req) {
  const token = req.cookies.get('sp_token')?.value
  if (!token) return NextResponse.json({ connected: false })
  const r = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return NextResponse.json({ connected: false })
  const u = await r.json()
  return NextResponse.json({ connected: true, id: u.id, name: u.display_name || u.id })
}
