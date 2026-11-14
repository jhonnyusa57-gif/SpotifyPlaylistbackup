'use client'
import { useEffect, useState } from 'react'

const KEY = 'slb_backup' // localStorage: keeps the exported library across the account switch

const LOGIN_ERRORS = {
  denied: 'Login was cancelled on Spotify.',
  config: 'Server is missing the Spotify Client Secret. Add it to .env.local and restart the server.',
  token: 'Spotify rejected the login. Check that the Client ID and Client Secret are correct.',
}

function SpotifyIcon({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14C9.6 9.9 15 10.56 18.72 12.84c.36.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z" />
    </svg>
  )
}

export default function Home() {
  const [me, setMe] = useState(null)
  const [backup, setBackup] = useState(null)
  const [skip, setSkip] = useState({}) // { [playlistIndex]: true } means deselected
  const [skipLiked, setSkipLiked] = useState(false)
  const [skipArtists, setSkipArtists] = useState(false)
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState(null) // { done, total, name }
  const [result, setResult] = useState(null) // { ok, text }

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error')
    if (err) {
      setResult({ ok: false, text: LOGIN_ERRORS[err] || 'Login failed. Please try again.' })
      window.history.replaceState(null, '', '/')
    }
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setBackup(JSON.parse(raw))
    } catch {}
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setMe(d.connected ? d : null))
      .catch(() => setMe(null))
  }, [])

  async function loadLibrary() {
    setBusy('load')
    setResult(null)
    try {
      const r = await fetch('/api/export')
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      setBackup(data)
      setSkip({})
      setSkipLiked(false)
      setSkipArtists(false)
      // shortcut: localStorage caps around 5 MB, fine for normal libraries; huge ones may not persist the switch
      try { localStorage.setItem(KEY, JSON.stringify(data)) } catch {}
      setResult({ ok: true, text: `Loaded ${data.playlists.length} playlists, ${data.likedSongs.length} liked songs${(data.followedArtists?.length) ? ` and ${data.followedArtists.length} followed artists` : ''}.` })
    } catch (e) {
      setResult({ ok: false, text: e.message })
    }
    setBusy('')
  }

  async function transfer() {
    setBusy('transfer')
    setResult(null)
    setProgress({ done: 0, total: selectedPlaylists.length, name: '' })
    try {
      const payload = {
        playlists: backup.playlists.filter((_, i) => !skip[i]),
        likedSongs: skipLiked ? [] : backup.likedSongs,
        followedArtists: skipArtists ? [] : (backup.followedArtists || []),
      }
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok || !r.body) throw new Error('Import failed to start.')

      const reader = r.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let done = null
      while (true) {
        const { value, done: finished } = await reader.read()
        if (finished) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep the partial last line
        for (const line of lines) {
          if (!line.trim()) continue
          const msg = JSON.parse(line)
          if (msg.type === 'progress') setProgress({ done: msg.done, total: msg.total, name: msg.name })
          else if (msg.type === 'error') throw new Error(msg.error)
          else if (msg.type === 'done') done = msg
        }
      }
      if (!done) throw new Error('Import ended unexpectedly.')

      const parts = [`${done.playlistsMade} playlists`, `${done.tracksAdded} tracks`, `${done.likedAdded} liked songs`]
      if (done.artistsFollowed) parts.push(`${done.artistsFollowed} artists`)
      const skippedNote = done.skipped ? ` (skipped ${done.skipped} already there)` : ''
      setResult({ ok: true, text: `Transferred to ${done.importedTo}: ${parts.join(', ')}${skippedNote}.` })
    } catch (e) {
      setResult({ ok: false, text: e.message })
    }
    setBusy('')
    setProgress(null)
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'streamlify-backup.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function startOver() {
    try { localStorage.removeItem(KEY) } catch {}
    setBackup(null)
    setResult(null)
  }

  const onSourceAccount = backup && me && backup.account?.id === me.id
  const selectedPlaylists = backup ? backup.playlists.filter((_, i) => !skip[i]) : []
  const artistCount = backup?.followedArtists?.length || 0
  const nothingSelected = selectedPlaylists.length === 0 && skipLiked && (skipArtists || artistCount === 0)

  function setAll(deselect) {
    const next = {}
    if (deselect) backup.playlists.forEach((_, i) => (next[i] = true))
    setSkip(next)
    setSkipLiked(deselect)
    setSkipArtists(deselect)
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
          <p className="sub">Load your Spotify playlists, liked songs and followed artists, switch accounts, and copy them over — no files needed.</p>

          {!me ? (
            <>
              <a className="btn primary full" href="/api/login">
                <SpotifyIcon size={20} /> Log in with Spotify
              </a>
              {backup && <p className="hint" style={{ marginTop: 14 }}>Your loaded library is saved. Log in with the account you want to copy it into.</p>}
            </>
          ) : (
            <>
              <div className="who">
                <span className="avatar">{(me.name || '?')[0].toUpperCase()}</span>
                <b>{me.name}</b>
                <span className="dot" title="Connected" />
              </div>

              {!backup ? (
                <div className="step">
                  <span className="n">1</span>
                  <div className="body">
                    <h3>Load your library</h3>
                    <p>Show all playlists, liked songs and followed artists from this account here.</p>
                    <button className="btn primary" disabled={!!busy} onClick={loadLibrary}>
                      {busy === 'load' ? <><span className="spinner" /> Loading…</> : 'Load library'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="section-label">
                    Library from <b>{backup.account?.name}</b> — pick what to copy
                  </p>
                  <div className="toolbar">
                    <button onClick={() => setAll(false)}>Select all</button>
                    <span style={{ color: 'var(--border)' }}>|</span>
                    <button onClick={() => setAll(true)}>Clear</button>
                    <button style={{ marginLeft: 'auto' }} onClick={downloadBackup}>Download .json</button>
                  </div>

                  <div className="lib">
                    <label className="lib-item">
                      <input className="chk" type="checkbox" checked={!skipLiked} onChange={(e) => setSkipLiked(!e.target.checked)} />
                      <span className="grow">
                        <h4>❤ Liked Songs</h4>
                        <span className="meta">{backup.likedSongs.length} songs</span>
                      </span>
                    </label>
                    {artistCount > 0 && (
                      <label className="lib-item">
                        <input className="chk" type="checkbox" checked={!skipArtists} onChange={(e) => setSkipArtists(!e.target.checked)} />
                        <span className="grow">
                          <h4>★ Followed Artists</h4>
                          <span className="meta">{artistCount} artists</span>
                        </span>
                      </label>
                    )}
                    {backup.playlists.map((pl, i) => (
                      <label className="lib-item" key={i}>
                        <input className="chk" type="checkbox" checked={!skip[i]} onChange={(e) => setSkip((s) => ({ ...s, [i]: !e.target.checked }))} />
                        <span className="grow">
                          <h4>{pl.name}</h4>
                          <span className="meta">{pl.trackCount} tracks{pl.owned ? '' : ' · followed'}</span>
                        </span>
                      </label>
                    ))}
                  </div>

                  {busy === 'transfer' && progress && (
                    <div className="progress">
                      <div className="bar"><div className="fill" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }} /></div>
                      <div className="label">Transferring {progress.done}/{progress.total}{progress.name ? ` · ${progress.name}` : ''}</div>
                    </div>
                  )}

                  {onSourceAccount ? (
                    <>
                      <p className="hint">Now switch to the account you want to copy into. Your selection is saved.</p>
                      <a className="btn primary full" href="/api/login">
                        <SpotifyIcon size={18} /> Switch to another account
                      </a>
                    </>
                  ) : (
                    <button className="btn primary full" disabled={!!busy || nothingSelected} onClick={transfer}>
                      {busy === 'transfer' ? <><span className="spinner" /> Transferring…</> : `Transfer to ${me.name}`}
                    </button>
                  )}

                  <div className="row-links">
                    <button className="linkbtn" onClick={startOver}>Start over</button>
                    <a className="linkbtn" href="/api/logout">Log out</a>
                  </div>
                </>
              )}

              {!backup && (
                <a className="logout" href="/api/logout">
                  Log out
                </a>
              )}
            </>
          )}

          {result && (
            <div className={`result${result.ok ? '' : ' err'}`} role="status">
              {result.ok ? '✅ ' : '❌ '}
              {result.text}
            </div>
          )}
        </div>
        <footer>
          Uses the official Spotify API. We only read and write what you allow. Songs are never downloaded.
          <br />
          <a className="store" href="https://streamlify.shop/" target="_blank" rel="noopener noreferrer">Visit our store ↗</a>
        </footer>
      </main>
    </>
  )
}
