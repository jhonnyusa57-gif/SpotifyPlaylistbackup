'use client'
import { useEffect, useState } from 'react'

function SpotifyIcon({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14C9.6 9.9 15 10.56 18.72 12.84c.36.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z" />
    </svg>
  )
}

const LOGIN_ERRORS = {
  denied: 'Login was cancelled on Spotify.',
  config: 'Server is missing the Spotify Client Secret. Add it to .env.local and restart the server.',
  token: 'Spotify rejected the login. Check that the Client ID and Client Secret are correct.',
}

export default function Home() {
  const [me, setMe] = useState(null)
  const [busy, setBusy] = useState('')
  const [result, setResult] = useState(null) // { ok, text }

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error')
    if (err) {
      setResult({ ok: false, text: LOGIN_ERRORS[err] || 'Login failed. Please try again.' })
      window.history.replaceState(null, '', '/') // clean the URL so a refresh doesn't repeat the error
    }
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setMe(d.connected ? d : null))
      .catch(() => setMe(null))
  }, [])

  async function doExport() {
    setBusy('export')
    setResult(null)
    try {
      const r = await fetch('/api/export')
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'streamlify-backup.json'
      a.click()
      URL.revokeObjectURL(a.href)
      setResult({ ok: true, text: `Export complete: ${data.playlists.length} playlists and ${data.likedSongs.length} liked songs. Your backup file has been downloaded.` })
    } catch (e) {
      setResult({ ok: false, text: e.message })
    }
    setBusy('')
  }

  async function doImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy('import')
    setResult(null)
    try {
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: await file.text(),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setResult({ ok: true, text: `Import complete for ${d.importedTo}: ${d.playlistsMade} playlists, ${d.tracksAdded} tracks and ${d.likedAdded} liked songs.` })
    } catch (err) {
      setResult({ ok: false, text: err.message })
    }
    setBusy('')
    e.target.value = ''
  }

  return (
    <>
      <div className="bg" aria-hidden="true" />
      <main className="wrap">
        <div className="card">
          <div className="brand">
            <span className="mark">
              <SpotifyIcon size={24} color="#03200e" />
            </span>
            <h1 className="logo">
              stream<span>lify</span>Backup
            </h1>
          </div>
          <p className="sub">Back up your Spotify playlists and liked songs, then move them to a new account in a few taps.</p>

          {!me ? (
            <a className="btn primary full" href="/api/login">
              <SpotifyIcon size={20} /> Log in with Spotify
            </a>
          ) : (
            <>
              <div className="who">
                <span className="avatar">{(me.name || '?')[0].toUpperCase()}</span>
                <b>{me.name}</b>
                <span className="dot" title="Connected" />
              </div>

              <div className="steps">
                <div className="step">
                  <span className="n">1</span>
                  <div className="body">
                    <h3>Export</h3>
                    <p>Save the playlists and liked songs from your old account as a JSON file.</p>
                    <button className="btn primary" disabled={!!busy} onClick={doExport}>
                      {busy === 'export' ? <><span className="spinner" /> Exporting…</> : 'Export backup'}
                    </button>
                  </div>
                </div>

                <div className="step">
                  <span className="n">2</span>
                  <div className="body">
                    <h3>Switch account</h3>
                    <p>Log in with your new Spotify account.</p>
                    <a className="btn ghost" href="/api/login">
                      <SpotifyIcon size={18} /> Use another account
                    </a>
                  </div>
                </div>

                <div className="step">
                  <span className="n">3</span>
                  <div className="body">
                    <h3>Import</h3>
                    <p>Choose your backup file and everything is recreated on the new account.</p>
                    <label className={`btn primary${busy ? ' disabled' : ''}`} aria-disabled={!!busy}>
                      {busy === 'import' ? <><span className="spinner" /> Importing…</> : 'Choose backup file'}
                      <input type="file" accept="application/json,.json" onChange={doImport} hidden disabled={!!busy} />
                    </label>
                  </div>
                </div>
              </div>

              <a className="logout" href="/api/logout">
                Log out
              </a>
            </>
          )}

          {result && (
            <div className={`result${result.ok ? '' : ' err'}`} role="status">
              {result.ok ? '✅ ' : '❌ '}
              {result.text}
            </div>
          )}
        </div>
        <footer>Uses the official Spotify API. We only read and write what you allow. Songs are never downloaded.</footer>
      </main>
    </>
  )
}
