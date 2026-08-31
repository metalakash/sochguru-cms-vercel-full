'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const STEP_NAMES = ['Persona', 'Voice', 'Video + Gesture', 'Avatar', 'Content & Publish']

const GESTURE_LINES = {
  'Smile': 'Hey, I\'m building in public from Kathmandu.',
  'Pointing': 'Here\'s the one thing that changed my week.',
  'Thinking': 'I don\'t have this fully figured out yet.',
  'Thumbs Up': 'That one\'s worth trying yourself.',
  'Explaining': 'Let me walk you through how this works.',
  'Walking': 'Let\'s learn and grow together.'
}

const VOICE_TAKES = [
  { type: 'neutral', label: 'Neutral', hint: 'Speak naturally, explain something', example: 'My decade in banking taught me...' },
  { type: 'excited', label: 'Excited', hint: 'Show enthusiasm and energy', example: 'Let\'s learn and grow together!' },
  { type: 'nepali', label: 'Nepali', hint: 'Natural Nepali, Romanized is fine', example: 'Soch yesto cha...' }
]

// HeyGen jobs that never resolve used to poll forever. Ten minutes is well past
// a normal render.
const AVATAR_POLL_MS = 5000
const AVATAR_MAX_POLLS = 120

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function Toasts({ items, dismiss }) {
  if (items.length === 0) return null
  return (
    <div className="toast-wrap" role="region" aria-label="Notifications">
      {items.map(t => (
        <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'err' ? 'alert' : 'status'}>
          <span className="toast-bar" aria-hidden="true" />
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 hover:opacity-70 transition"
            style={{ color: 'var(--ink-3)', minWidth: '24px' }}
            aria-label="Dismiss notification"
          >✕</button>
        </div>
      ))}
    </div>
  )
}

function Labeled({ id, label, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="t-label mono block mb-2">{label}</label>
      {children}
      {hint && <p className="t-sm mt-1.5">{hint}</p>}
    </div>
  )
}

function Pending({ label }) {
  return (<><span className="spinner" aria-hidden="true" />{label}</>)
}

function ContentCard({ label, value, onCopy }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-4 mb-3">
        <p className="t-label mono">{label}</p>
        <button
          onClick={onCopy}
          className="t-sm tap-link hover:opacity-70 transition shrink-0"
          style={{ color: 'var(--ink-3)' }}
        >Copy</button>
      </div>
      <p className="t-body whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>{value}</p>
    </div>
  )
}

function GeneratingSkeleton() {
  return (
    <div className="mt-10 space-y-4" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <div key={i} className="card p-5">
          <div className="skeleton mb-3" style={{ height: '11px', width: '30%' }} />
          <div className="skeleton mb-2" style={{ height: '13px', width: '100%' }} />
          <div className="skeleton" style={{ height: '13px', width: '72%' }} />
        </div>
      ))}
    </div>
  )
}

/** Shown instead of the app when CMS_ACCESS_CODE is set and the visitor has no cookie. */
function AccessGate({ onUnlock }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async e => {
    e.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not verify that code.')
      onUnlock()
    } catch (err) {
      setError(err.message)
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="t-label mono mb-5">Hadigaun, Kathmandu</p>
        <h1 className="t-h1 mb-3">SochGuru</h1>
        <p className="t-body mb-8">
          This instance is private. Enter the access code to continue.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <Labeled id="access-code" label="Access code">
            <input
              id="access-code"
              type="password"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="field"
              autoComplete="current-password"
              autoFocus
            />
          </Labeled>
          {error && <div className="note note-err" role="alert">{error}</div>}
          <button type="submit" disabled={busy || !code.trim()} className="btn btn-primary w-full">
            {busy ? <Pending label="Checking…" /> : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export default function Page() {
  const [mode, setMode] = useState(null) // null = selector, 'basic' or 'pro'
  const [step, setStep] = useState(1)
  const [persona, setPersona] = useState({name:'', story:'My decade in banking. Shifting to Agentic AI and culture in Nepal. I don\'t have all the answers. Just sharing as I navigate it all. Let\'s learn and grow together.', niche:'Agentic AI', audience:'Both Bilingual'})
  const [voices, setVoices] = useState([])
  const [videos, setVideos] = useState([])
  const [pageId, setPageId] = useState('')
  const [content, setContent] = useState(null)
  const previewRef = useRef(null)
  const streamRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [pubError, setPubError] = useState('')
  const [pubResult, setPubResult] = useState(null)
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState('')
  const [cloneResult, setCloneResult] = useState(null)
  const [generatingAvatar, setGeneratingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [avatarResult, setAvatarResult] = useState(null)
  const [avatarJobId, setAvatarJobId] = useState('')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [activeGesture, setActiveGesture] = useState('Smile')
  const [camReady, setCamReady] = useState(false)

  // Basic mode state
  const [basicPrompt, setBasicPrompt] = useState('')
  const [basicGenerating, setBasicGenerating] = useState(false)
  const [basicResult, setBasicResult] = useState(null)
  const [basicError, setBasicError] = useState('')

  // Optimistically open so the hero paints immediately — a "Loading…" flash in
  // front of the CTA costs more than it buys. The landing page carries nothing
  // sensitive, and every API route enforces the gate server-side regardless.
  const [gate, setGate] = useState('open')

  /* ---------------- toasts ---------------- */
  const [toasts, setToasts] = useState([])
  const dismissToast = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), [])
  const toast = useCallback((message, kind = 'err') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000)
  }, [])

  /* ---------------- boot ---------------- */
  useEffect(() => {
    let cancelled = false
    fetch('/api/access')
      .then(r => r.json())
      .then(d => { if (!cancelled) setGate(!d.gateEnabled || d.authorized ? 'open' : 'locked') })
      .catch(() => { if (!cancelled) setGate('open') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    // Corrupt storage used to throw here and blank the whole page.
    try {
      const saved = localStorage.getItem('soch_cms_persona')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') setPersona(p => ({ ...p, ...parsed }))
      }
    } catch {
      localStorage.removeItem('soch_cms_persona')
    }
  }, [])

  /* ---------------- camera lifecycle ---------------- */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (previewRef.current) previewRef.current.srcObject = null
    setCamReady(false)
  }, [])

  // Release the camera the moment it stops being needed — leaving step 3 used to
  // leave the recording indicator lit for the rest of the session.
  useEffect(() => {
    if (!(mode === 'pro' && step === 3)) stopCamera()
  }, [mode, step, stopCamera])

  useEffect(() => stopCamera, [stopCamera])

  /* ---------------- avatar polling ---------------- */
  useEffect(() => {
    if (!avatarJobId) return
    let attempts = 0

    const poll = setInterval(async () => {
      attempts++
      if (attempts > AVATAR_MAX_POLLS) {
        clearInterval(poll)
        setAvatarJobId('')
        setAvatarError('Gave up waiting for HeyGen after 10 minutes. The job may still finish — check your HeyGen dashboard.')
        return
      }
      try {
        const res = await fetch('/api/generate-avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status', jobId: avatarJobId })
        })
        const data = await res.json()
        if (data.status === 'completed' && data.videoUrl) {
          clearInterval(poll)
          setAvatarResult(data)
          setAvatarJobId('')
          toast('Avatar video is ready.', 'ok')
          trackAnalytics('avatar_generated', { status: 'success' })
        } else if (data.status === 'failed') {
          clearInterval(poll)
          setAvatarError('HeyGen generation failed: ' + (data.failureMessage || 'unknown error'))
          setAvatarJobId('')
          trackAnalytics('avatar_generated', { status: 'error', error: data.failureMessage })
        }
      } catch (err) {
        console.error('Avatar status check failed:', err)
      }
    }, AVATAR_POLL_MS)

    return () => clearInterval(poll)
  }, [avatarJobId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- data helpers ---------------- */
  const trackAnalytics = async (type, data = {}) => {
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'track', event: { type, ...data } })
      })
    } catch (err) {
      console.error('Analytics tracking failed:', err)
    }
  }

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics')
      setAnalytics(await res.json())
    } catch (err) {
      toast('Could not load activity.')
    }
  }

  const clearAnalytics = async () => {
    try {
      // POST, not GET — a destructive action must never be reachable by navigation.
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' })
      })
      setAnalytics(null)
      fetchAnalytics()
      toast('Activity cleared.', 'ok')
    } catch {
      toast('Could not clear activity.')
    }
  }

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value)
      toast('Copied to clipboard.', 'ok')
    } catch {
      toast('Clipboard is blocked in this browser.')
    }
  }

  const savePersona = () => {
    try {
      localStorage.setItem('soch_cms_persona', JSON.stringify(persona))
    } catch {
      // Private-mode Safari and full quotas both throw. Not worth blocking on.
    }
    trackAnalytics('creator_created', { name: persona.name, niche: persona.niche })
    setStep(2)
  }

  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = s
      if (previewRef.current) previewRef.current.srcObject = s
      setCamReady(true)
    } catch (err) {
      toast('Could not access camera and mic: ' + err.message)
    }
  }

  const recordVoice = async (type) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      let chunks = []
      rec.ondataavailable = e => chunks.push(e.data)
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setVoices(v => [...v.filter(x => x.type !== type), { type, url, blob }])
        stream.getTracks().forEach(t => t.stop())
      }
      rec.start()
      setRecording(true)
      setTimeout(() => { rec.stop(); setRecording(false) }, 5000)
    } catch (err) {
      toast('Could not access the microphone: ' + err.message)
    }
  }

  const recordVideo = async () => {
    try {
      let stream = streamRef.current
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        streamRef.current = stream
        if (previewRef.current) previewRef.current.srcObject = stream
        setCamReady(true)
      }
      if (stream.getAudioTracks().length === 0) {
        toast('No microphone track found. Allow both camera and mic so your voice is captured with the gesture.')
        return
      }
      const gesture = activeGesture
      const rec = new MediaRecorder(stream)
      let chunks = []
      rec.ondataavailable = e => chunks.push(e.data)
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        setVideos(v => [...v, { url: URL.createObjectURL(blob), blob, gesture }])
      }
      rec.start()
      setRecording(true)
      setTimeout(() => { rec.stop(); setRecording(false) }, 5000)
    } catch (err) {
      toast('Could not record: ' + err.message)
    }
  }

  const generateBasicPack = async () => {
    if (!basicPrompt.trim()) {
      setBasicError('Please enter a content idea or topic')
      return
    }
    setBasicGenerating(true)
    setBasicError('')
    setBasicResult(null)
    try {
      const res = await fetch('/api/generate-basic-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: basicPrompt })
      })
      const data = await res.json()
      if (res.status === 401) { setGate('locked'); return }
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`)
      setBasicResult(data)
      trackAnalytics('basic_pack_generated', { source: data.source })
    } catch (err) {
      setBasicError(err.message)
      trackAnalytics('basic_pack_generated', { status: 'error', error: err.message })
    } finally {
      setBasicGenerating(false)
    }
  }

  const generateContent = async () => {
    setGenerating(true)
    setGenError('')
    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona })
      })
      const data = await res.json()
      if (res.status === 401) { setGate('locked'); return }
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`)
      setContent(data)
      try { localStorage.setItem('soch_last_content', JSON.stringify(data)) } catch {}
      trackAnalytics('content_generated', { source: data.source })
    } catch (err) {
      setGenError('Could not generate content: ' + err.message)
      trackAnalytics('content_generated', { status: 'error', error: err.message })
    } finally {
      setGenerating(false)
    }
  }

  const generateAvatar = async () => {
    if (!content) {
      setAvatarError('Generate content in Step 5 first — the avatar reads from the English script.')
      return
    }
    setGeneratingAvatar(true)
    setAvatarError('')
    setAvatarResult(null)
    setAvatarJobId('')
    try {
      const res = await fetch('/api/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          script: content.englishVideo,
          voiceId: cloneResult?.voiceId || undefined
        })
      })
      const data = await res.json()
      if (res.status === 401) { setGate('locked'); return }
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`)
      setAvatarJobId(data.jobId)
    } catch (err) {
      setAvatarError('Avatar generation failed: ' + err.message)
    } finally {
      setGeneratingAvatar(false)
    }
  }

  const cloneVoices = async () => {
    if (voices.length === 0) {
      setCloneError('Record at least one voice sample first')
      return
    }
    setCloning(true)
    setCloneError('')
    setCloneResult(null)
    try {
      const voiceSamples = await Promise.all(voices.map(async v => {
        const buf = await v.blob.arrayBuffer()
        let binary = ''
        const bytes = new Uint8Array(buf)
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        return { type: v.type, data: btoa(binary) }
      }))
      const res = await fetch('/api/clone-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceSamples, creatorName: persona.name || 'SochGuru' })
      })
      const data = await res.json()
      if (res.status === 401) { setGate('locked'); return }
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`)
      setCloneResult(data)
      toast('Voice cloned.', 'ok')
      trackAnalytics('voice_cloned', { sampleCount: voices.length, status: 'success' })
    } catch (err) {
      setCloneError('Voice cloning failed: ' + err.message)
      trackAnalytics('voice_cloned', { status: 'error', error: err.message })
    } finally {
      setCloning(false)
    }
  }

  const publishToMeta = async () => {
    if (!content) return
    setPublishing(true)
    setPubError('')
    setPubResult(null)
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, content })
      })
      const data = await res.json()
      if (res.status === 401) { setGate('locked'); return }
      if (!res.ok && !data.results) throw new Error(data.error || `Server returned ${res.status}`)
      setPubResult(data)
      toast(data.status === 'success' ? 'Published to your Page.' : 'Published with some failures.', data.status === 'success' ? 'ok' : 'err')
      trackAnalytics('published', { status: data.status, postsCount: data.results?.length })
    } catch (err) {
      setPubError('Publish failed: ' + err.message)
      trackAnalytics('published', { status: 'error', error: err.message })
    } finally {
      setPublishing(false)
    }
  }

  const download = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPackage = () => {
    download({
      creator: persona,
      voices: voices.length,
      videos: videos.map(v => v.gesture),
      content,
      timestamp: new Date().toISOString()
    }, 'SochGuru_CreatorPackage.json')
    toast('Package downloaded.', 'ok')
  }

  /* ---------------- gate ---------------- */

  if (gate === 'locked') {
    return (
      <>
        <AccessGate onUnlock={() => setGate('open')} />
        <Toasts items={toasts} dismiss={dismissToast} />
      </>
    )
  }

  /* ---------------- landing ---------------- */

  if (!mode) return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6">

        {/* Hero — the CTA sits here, above the fold, not four sections down */}
        <section className="pt-20 pb-16 md:pt-28">
          <p className="t-label mono mb-5">Hadigaun, Kathmandu</p>
          <h1 className="t-display mb-6">
            Write it once.<br/>
            Publish it in both<br/>
            <span style={{color:'var(--accent)'}}>Nepali and English.</span>
          </h1>
          <h2 className="t-h2 mb-7" style={{color:'var(--ink-3)'}} lang="ne-Latn">
            Ek choti likhe. Duwai bhashama publish garne.
          </h2>

          <p className="t-lead max-w-xl mb-9">
            Describe your idea in one paragraph. Get back the Nepali post, the English
            post, and a video script for each — written together, in one pass.
          </p>

          <button onClick={()=>setMode('basic')} className="btn btn-primary w-full sm:w-auto" style={{paddingInline:'2rem'}}>
            Write my first post →
          </button>

          <p className="t-sm mono mt-4">
            No signup · Runs on your own Gemini key · Nothing posts without you
          </p>
        </section>

        {/* Concrete payoff, immediately after the CTA */}
        <section className="hairline py-14">
          <div className="flex items-baseline justify-between gap-6 mb-7">
            <p className="t-label mono">Six pieces, one prompt</p>
            <p className="t-label mono" style={{color:'var(--ink-3)'}} lang="ne-Latn">Ek prompt, chhavta cheez</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
            {[
              ['Nepali status', 'Romanized, reads like a real feed post'],
              ['English status', 'Same idea, written for a global audience'],
              ['Nepali video script', 'Hook, main, call-to-action'],
              ['English video script', 'Hook, main, call-to-action'],
              ['Image prompt', 'For a consistent avatar look'],
              ['Video prompt', '8 seconds, 9:16 vertical']
            ].map(([name, desc]) => (
              <div key={name} className="py-3" style={{borderBottom:'1px solid var(--line)'}}>
                <p className="text-sm font-medium mb-0.5">{name}</p>
                <p className="t-sm">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works — three beats, removes the "what happens if I click" hesitation */}
        <section className="hairline py-14">
          <p className="t-label mono mb-7">How it works</p>
          <ol className="space-y-6">
            {[
              ['Describe your idea', 'A paragraph about who you are and what you are covering. The more specific, the less generic it comes back.'],
              ['Read what comes back', 'Six drafts, side by side. Edit anything that does not sound like you.'],
              ['Post it yourself', 'Copy what you want, or download the whole pack. Nothing publishes on its own.']
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="t-label mono shrink-0 pt-1" style={{color:'var(--accent)', width:'1.5rem'}}>0{i+1}</span>
                <div>
                  <p className="text-sm font-medium mb-1">{title}</p>
                  <p className="t-body">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Who's building this — the credibility that makes the rest believable */}
        <section className="hairline py-14">
          <div className="flex items-baseline justify-between gap-6 mb-7">
            <p className="t-label mono">Who's building this</p>
            <p className="t-label mono" style={{color:'var(--ink-3)'}} lang="ne-Latn">Ko banayo yo?</p>
          </div>
          <div className="space-y-5 t-body">
            <p style={{color:'var(--ink)', fontSize:'1.0625rem', lineHeight:1.6}}>
              I spent a decade in banking. Now I'm building with agentic AI from
              Hadigaun, and posting about it as I go.
            </p>
            <p>
              My audience is split — friends and peers here who read Nepali, and a wider
              tech audience that reads English. Writing for one meant the other got a
              rushed translation, or nothing. Doing both properly meant doing every step
              twice: the script, the tone, the recording, the edit.
            </p>
            <p>
              So I built the thing I needed. It's not a startup pitch. It's a tool I use
              on my own posts, opened up in case your audience is split the same way.
            </p>
            <p style={{color:'var(--ink-3)'}}>
              I don't have this all figured out. If something's broken or a translation
              reads wrong, tell me — that's the fastest way this gets better.
            </p>
          </div>
        </section>

        {/* Worth knowing — objections answered before they're asked */}
        <section className="hairline py-14">
          <p className="t-label mono mb-6">Worth knowing before you start</p>
          <div className="space-y-4 t-body">
            <p>
              <span style={{color:'var(--ink)'}}>Your API keys stay on the server.</span>{' '}
              They're read from environment variables and never sent to the browser.
              Every call is billed to your own account at their rates.
            </p>
            <p>
              <span style={{color:'var(--ink)'}}>The Nepali is Romanized, not Devanagari.</span>{' '}
              It reads naturally in a Facebook feed, but check it before posting — AI
              translation of Nepali idiom still gets things wrong.
            </p>
            <p>
              <span style={{color:'var(--ink)'}}>Nothing publishes on its own.</span>{' '}
              You review and edit every piece, and you press the button.
            </p>
          </div>
        </section>

        {/* Closing CTA — the second and last ask */}
        <section className="hairline py-16">
          <h2 className="t-h1 mb-4">Your next post, in both languages.</h2>
          <p className="t-body mb-8 max-w-lg">
            Takes one paragraph and about thirty seconds. If what comes back isn't
            usable, you've lost a minute.
          </p>
          <button onClick={()=>setMode('basic')} className="btn btn-primary w-full sm:w-auto" style={{paddingInline:'2rem'}}>
            Write my first post →
          </button>
          <p className="t-sm mt-6">
            Pro — your recorded voice, gestures, and an avatar video —{' '}
            <span className="mono" style={{color:'var(--ink-3)'}}>coming soon</span>.
          </p>
        </section>

        <footer className="hairline py-10">
          <p className="t-sm mono">Built in Hadigaun, Kathmandu</p>
        </footer>
      </div>
      <Toasts items={toasts} dismiss={dismissToast} />
    </div>
  )

  /* ---------------- app shell ---------------- */

  return (
    <div className="min-h-screen p-4 max-w-6xl mx-auto">
      <header className="flex justify-between items-center gap-4 py-5 mb-8" style={{borderBottom:'1px solid var(--line)'}}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={()=>setMode(null)} className="t-sm tap-link hover:opacity-70 transition shrink-0" style={{color:'var(--ink-3)'}}>← Back</button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">
              SochGuru <span style={{color:'var(--ink-3)'}}>/</span> <span style={{color:'var(--accent)'}}>{mode==='basic' ? 'Basic' : 'Pro'}</span>
            </h1>
          </div>
        </div>
        <button
          onClick={()=>{setShowAnalytics(!showAnalytics); if(!showAnalytics) fetchAnalytics()}}
          className="btn btn-ghost btn-sm shrink-0"
          aria-expanded={showAnalytics}
        >
          Activity
        </button>
      </header>

      {mode==='pro' && (
        <>
          {/* Desktop: full step-pill row, tap any step to jump */}
          <nav className="hidden md:grid grid-cols-5 gap-2 mb-6" aria-label="Workflow steps">
            {[1,2,3,4,5].map(n=>(
              <button
                key={n}
                onClick={()=>setStep(n)}
                aria-current={step===n ? 'step' : undefined}
                className={`${step===n?'orange':'glass'} py-2 rounded-full text-xs font-bold`}
              >
                {n}&nbsp;{STEP_NAMES[n-1]}
              </button>
            ))}
          </nav>

          {/* Mobile: compact progress header — per-step Back/Next lives in each step body */}
          <div className="md:hidden mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="t-sm mono">Step {step} of 5</span>
              <span className="t-sm mono" style={{color:'var(--accent)'}}>{STEP_NAMES[step-1]}</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={step}
              aria-valuemin={1}
              aria-valuemax={5}
              aria-label={`Step ${step} of 5: ${STEP_NAMES[step-1]}`}
              style={{height:'3px', background:'var(--line)', borderRadius:'999px', overflow:'hidden'}}
            >
              <div style={{height:'100%', width:`${(step/5)*100}%`, background:'var(--accent)', transition:'width .2s ease'}}/>
            </div>
          </div>
        </>
      )}

      {/* ---------------- Basic ---------------- */}

      {mode==='basic' && (
        <div className="max-w-2xl mx-auto pb-16">
          <h2 className="t-h1 mb-3">What are you posting about?</h2>
          <p className="t-body mb-6">
            A paragraph is enough — who you are, what you're covering, who reads you.
            The more specific, the less generic it comes back.
          </p>

          <label htmlFor="basic-prompt" className="sr-only">Describe your content idea</label>
          <textarea
            id="basic-prompt"
            value={basicPrompt}
            onChange={e=>setBasicPrompt(e.target.value)}
            placeholder="I left banking after ten years and now I build with AI agents from Kathmandu. This week I automated my invoice follow-ups and it saved a whole afternoon. My readers are split — dev friends here who read Nepali, and a tech audience abroad reading English."
            className="field mb-1"
            style={{height:'9rem', lineHeight:1.6, resize:'vertical'}}
          />
          <div className="flex justify-end mb-5">
            <span className="t-sm mono">{basicPrompt.trim().split(/\s+/).filter(Boolean).length} words</span>
          </div>

          <button onClick={generateBasicPack} disabled={basicGenerating || !basicPrompt.trim()} className="btn btn-primary w-full">
            {basicGenerating ? <Pending label="Writing your six pieces…" /> : 'Generate'}
          </button>

          {basicError && <div className="note note-err mt-4" role="alert">{basicError}</div>}

          {basicGenerating && <GeneratingSkeleton />}

          {basicResult && !basicGenerating && (
            <div className="mt-10 space-y-4">
              <div className="flex items-center justify-between">
                <p className="t-label mono">Draft — review before posting</p>
                {basicResult.source==='gemini' && <span className="pill pill-accent mono">GEMINI</span>}
              </div>

              {basicResult.persona && (
                <div className="card p-5">
                  <p className="t-label mono mb-3">Persona</p>
                  <p className="font-medium mb-1.5">
                    {basicResult.persona.name || 'Creator'}
                    <span style={{color:'var(--ink-3)'}}> · {basicResult.persona.niche}</span>
                  </p>
                  <p className="t-body">{basicResult.persona.story}</p>
                </div>
              )}

              {[
                ['Nepali status', basicResult.nepaliStatus],
                ['English status', basicResult.englishStatus],
                ['Nepali video script', basicResult.nepaliVideo],
                ['English video script', basicResult.englishVideo],
                ['Image prompt', basicResult.imagePrompt],
                ['Video prompt', basicResult.veoPrompt]
              ].filter(([,v]) => v).map(([label, value]) => (
                <ContentCard key={label} label={label} value={value} onCopy={()=>copy(value)} />
              ))}

              <div className="space-y-2">
                <p className="t-label mono">Export as</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { download(basicResult, 'sochguru-content.json'); trackAnalytics('basic_pack_exported', {format:'json'}) }}
                    className="btn btn-ghost btn-sm w-full"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => {
                      const csv = [['Field','Content'],...Object.entries(basicResult).map(([k,v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
                      const blob = new Blob([csv], {type:'text/csv'})
                      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sochguru-content.csv'; a.click(); URL.revokeObjectURL(a.href)
                      trackAnalytics('basic_pack_exported', {format:'csv'})
                    }}
                    className="btn btn-ghost btn-sm w-full"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => {
                      const md = `# ${basicResult.persona?.name || 'Content Pack'}\n\n**Niche:** ${basicResult.persona?.niche}\n**Audience:** ${basicResult.persona?.audience}\n\n## Story\n${basicResult.persona?.story}\n\n## Nepali Status\n${basicResult.nepaliStatus}\n\n## English Status\n${basicResult.englishStatus}\n\n## Nepali Video Script\n${basicResult.nepaliVideo}\n\n## English Video Script\n${basicResult.englishVideo}\n\n## Image Prompt\n${basicResult.imagePrompt}\n\n## Video Prompt\n${basicResult.veoPrompt}`
                      const blob = new Blob([md], {type:'text/markdown'})
                      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sochguru-content.md'; a.click(); URL.revokeObjectURL(a.href)
                      trackAnalytics('basic_pack_exported', {format:'markdown'})
                    }}
                    className="btn btn-ghost btn-sm w-full"
                  >
                    Markdown
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Pro step 1: persona ---------------- */}

      {mode==='pro' && step===1 && (
        <div className="space-y-5 max-w-2xl mx-auto pb-16">
          <div>
            <h2 className="t-h1 mb-2">Define your persona</h2>
            <p className="t-body">
              This is the voice every later step writes from — the scripts, the tone,
              the avatar. Specific beats polished.
            </p>
          </div>

          <div className="card p-6 space-y-5">
            <Labeled id="persona-name" label="Your name">
              <input
                id="persona-name"
                value={persona.name}
                onChange={e=>setPersona({...persona, name:e.target.value})}
                placeholder="e.g. Akash Rai"
                className="field"
              />
            </Labeled>

            <Labeled id="persona-story" label="Your story" hint="About 30 seconds to read. Background, journey, what drives you.">
              <textarea
                id="persona-story"
                value={persona.story}
                onChange={e=>setPersona({...persona, story:e.target.value})}
                className="field"
                style={{height:'8rem', lineHeight:1.6, resize:'vertical'}}
              />
            </Labeled>

            <div className="grid sm:grid-cols-2 gap-4">
              <Labeled id="persona-niche" label="Niche">
                <select
                  id="persona-niche"
                  value={persona.niche}
                  onChange={e=>setPersona({...persona, niche:e.target.value})}
                  className="field"
                >
                  {['Agentic AI','Mindset','Culture Nepal','Business','Tech','Design','Marketing'].map(o=>(
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Labeled>

              <Labeled id="persona-audience" label="Audience">
                <select
                  id="persona-audience"
                  value={persona.audience}
                  onChange={e=>setPersona({...persona, audience:e.target.value})}
                  className="field"
                >
                  <option>Both Bilingual (Native+Foreign)</option>
                  <option>Native Nepali</option>
                  <option>Foreign Global</option>
                </select>
              </Labeled>
            </div>
          </div>

          <div className="card p-5">
            <p className="t-label mono mb-3">How this gets used</p>
            <ul className="space-y-2 t-body">
              <li>The voice clone learns your tone and delivery</li>
              <li>Content is written from your perspective, not a generic one</li>
              <li>The avatar video is built to match how you present</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={()=>setMode(null)} className="btn btn-ghost flex-1">← Back</button>
            <button onClick={savePersona} className="btn btn-primary flex-1">Continue to voice →</button>
          </div>
        </div>
      )}

      {/* ---------------- Pro step 2: voice ---------------- */}

      {mode==='pro' && step===2 && (
        <div className="space-y-5 max-w-3xl mx-auto pb-16">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="t-h1 mb-2">Record your voice</h2>
              <p className="t-body">
                Three short takes in different tones. All three are combined into one
                voice clone — more material makes a better result than three separate ones.
              </p>
            </div>
            <span className="pill pill-muted mono shrink-0">{voices.length}/3</span>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {VOICE_TAKES.map(({type, label, hint, example}) => {
              const recorded = voices.find(v => v.type === type)
              return (
                <div key={type} className={recorded ? 'card-hi p-4' : 'card p-4'}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{label}</p>
                    {recorded && <span className="pill pill-ok mono">DONE</span>}
                  </div>
                  <p className="t-sm mb-3">{hint}</p>
                  <p className="t-sm mb-4" style={{color:'var(--accent)'}}>"{example}"</p>

                  <button
                    onClick={()=>recordVoice(type)}
                    disabled={recording}
                    className="btn btn-ghost btn-sm w-full mb-2"
                  >
                    {recording ? 'Recording…' : recorded ? 'Re-record' : 'Record 5s'}
                  </button>

                  {recorded && <audio src={recorded.url} controls className="w-full mt-1" style={{height:'32px'}}/>}
                </div>
              )
            })}
          </div>

          {voices.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={cloneVoices}
                disabled={cloning || voices.length < 3}
                className="btn btn-primary w-full"
              >
                {cloning ? <Pending label="Cloning your voice…" /> : 'Clone voice with ElevenLabs'}
              </button>
              {voices.length < 3 && (
                <p className="t-sm text-center">Record all three takes to enable cloning.</p>
              )}

              {cloneError && <div className="note note-err" role="alert">{cloneError}</div>}

              {cloneResult && (
                <div className="note note-ok" role="status">
                  <p className="font-medium mb-1">Voice cloned</p>
                  <p className="mono" style={{fontSize:'0.75rem'}}>
                    {cloneResult.sampleCount} samples · ID {cloneResult.voiceId}
                  </p>
                  {cloneResult.requiresVerification && (
                    <p className="mt-2">ElevenLabs may require verification before this voice can generate audio.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={()=>setStep(1)} className="btn btn-ghost flex-1">← Back</button>
            <button onClick={()=>setStep(3)} className="btn btn-primary flex-1" disabled={voices.length < 3}>Next: video →</button>
          </div>
        </div>
      )}

      {/* ---------------- Pro step 3: gesture capture ---------------- */}

      {mode==='pro' && step===3 && (
        <div className="space-y-5 max-w-2xl mx-auto pb-16">
          <div>
            <h2 className="t-h1 mb-2">Video and gesture</h2>
            <p className="t-body">
              Pick a gesture, then record five seconds of yourself doing it{' '}
              <span style={{color:'var(--ink)'}}>while speaking the line below</span> —
              voice, movement, and expression are captured together in one clip.
            </p>
          </div>

          <div className="card p-5">
            <video
              ref={previewRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-lg bg-black object-cover mb-4"
              style={{aspectRatio:'16/10'}}
            />

            <div className="grid grid-cols-3 gap-2 mb-4" role="group" aria-label="Gesture">
              {Object.keys(GESTURE_LINES).map(g=>(
                <button
                  key={g}
                  onClick={()=>setActiveGesture(g)}
                  aria-pressed={activeGesture===g}
                  className={`rounded-lg text-center text-xs transition ${activeGesture===g ? 'orange font-semibold' : 'card-hi'}`}
                  style={{minHeight:'44px', padding:'0.5rem'}}
                >{g}</button>
              ))}
            </div>

            <div className="card-hi p-4 mb-4">
              <p className="t-label mono mb-1.5">Say this while you {activeGesture.toLowerCase()}</p>
              <p className="text-sm" style={{color:'var(--accent)'}}>"{GESTURE_LINES[activeGesture]}"</p>
            </div>

            {!camReady ? (
              <button onClick={startCam} className="btn btn-ghost w-full">Start camera and mic</button>
            ) : (
              <div className="flex flex-col items-center gap-2.5">
                <button
                  onClick={recordVideo}
                  disabled={recording}
                  className={`record-btn ${recording ? 'rec-dot' : ''}`}
                  aria-label={`Record ${activeGesture}, 5 seconds`}
                >
                  <span className="record-btn-dot" aria-hidden="true"/>
                </button>
                <p className="t-sm" role="status">
                  {recording ? 'Recording…' : `Tap to record "${activeGesture}" · 5s`}
                </p>
              </div>
            )}
          </div>

          {videos.length > 0 && (
            <div className="card p-5">
              <p className="t-label mono mb-3">{videos.length} clip{videos.length===1?'':'s'} captured</p>
              <div className="flex gap-3 flex-wrap">
                {videos.map((v,i)=>(
                  <div key={i}>
                    <video src={v.url} controls className="w-28 rounded-lg bg-black" style={{aspectRatio:'16/10'}}/>
                    <p className="t-sm mt-1 text-center">{v.gesture}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={()=>setStep(2)} className="btn btn-ghost flex-1">← Back</button>
            <button onClick={()=>setStep(4)} disabled={videos.length===0} className="btn btn-primary flex-1">Next: avatar →</button>
          </div>
        </div>
      )}

      {/* ---------------- Pro step 4: avatar ---------------- */}

      {mode==='pro' && step===4 && (
        <div className="space-y-5 max-w-3xl mx-auto pb-16">
          <div>
            <h2 className="t-h1 mb-2">Build your avatar</h2>
            <p className="t-body">
              HeyGen renders a vertical video from the English script in step 5. Generate
              content first if you haven't yet.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-5">
              <p className="t-label mono mb-3">Collected so far</p>
              <dl className="space-y-2 t-body">
                <div className="flex justify-between gap-4">
                  <dt>Persona</dt>
                  <dd style={{color:'var(--ink)'}}>{persona.name || 'SochGuru'} · {persona.niche}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Voice</dt>
                  <dd style={{color:'var(--ink)'}}>{voices.length} samples{cloneResult?.voiceId && ' · cloned'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Gestures</dt>
                  <dd style={{color:'var(--ink)'}}>{videos.length} clips</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Script</dt>
                  <dd style={{color:'var(--ink)'}}>{content ? 'Ready' : 'Not generated'}</dd>
                </div>
              </dl>
            </div>

            <div className="card p-5 space-y-3">
              <p className="t-label mono">Generate</p>
              <button
                onClick={generateAvatar}
                disabled={generatingAvatar || !!avatarJobId}
                className="btn btn-primary w-full"
              >
                {avatarJobId
                  ? <Pending label="Rendering…" />
                  : generatingAvatar ? <Pending label="Starting…" /> : 'Generate with HeyGen'}
              </button>
              {avatarJobId && <p className="t-sm" role="status">Checking every 5 seconds. This usually takes a few minutes.</p>}
              {avatarError && <div className="note note-err" role="alert">{avatarError}</div>}
              {avatarResult?.videoUrl && (
                <div className="space-y-2">
                  <div className="note note-ok" role="status">Avatar ready</div>
                  <video src={avatarResult.videoUrl} controls className="w-full rounded-lg"/>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={()=>setStep(3)} className="btn btn-ghost flex-1">← Back</button>
            <button onClick={()=>setStep(5)} className="btn btn-primary flex-1">Next: content →</button>
          </div>
        </div>
      )}

      {/* ---------------- Pro step 5: content and publish ---------------- */}

      {mode==='pro' && step===5 && (
        <div className="space-y-5 max-w-2xl mx-auto pb-16">
          <div>
            <h2 className="t-h1 mb-2">Content and publishing</h2>
            <p className="t-body">
              Generate the bilingual pack, read it through, then publish. Nothing goes
              out until you press publish.
            </p>
          </div>

          <div className="card p-5 space-y-4">
            <Labeled
              id="page-id"
              label="Facebook Page ID"
              hint="Leave blank if the server pins a page with META_PAGE_ID."
            >
              <input
                id="page-id"
                value={pageId}
                onChange={e=>setPageId(e.target.value)}
                placeholder="61590521291901"
                inputMode="numeric"
                className="field"
              />
            </Labeled>

            <button onClick={generateContent} disabled={generating} className="btn btn-primary w-full">
              {generating ? <Pending label="Generating…" /> : 'Generate bilingual pack'}
            </button>
            {genError && <div className="note note-err" role="alert">{genError}</div>}
          </div>

          {generating && <GeneratingSkeleton />}

          {content && !generating && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="t-label mono">Draft — review before posting</p>
                <span className={`pill mono ${content.source==='gemini' ? 'pill-accent' : 'pill-muted'}`}>
                  {content.source==='gemini' ? 'GEMINI' : 'TEMPLATE'}
                </span>
              </div>

              {content.source!=='gemini' && (
                <div className="note note-warn" role="status">
                  Using the built-in template. Set GEMINI_API_KEY on the server for generated content.
                </div>
              )}

              {[
                ['Nepali status', content.nepaliStatus],
                ['English status', content.englishStatus],
                ['Nepali video script', content.nepaliVideo],
                ['English video script', content.englishVideo],
                ['Image prompt', content.imagePrompt],
                ['Video prompt', content.veoPrompt]
              ].filter(([,v]) => v).map(([label, value]) => (
                <ContentCard key={label} label={label} value={value} onCopy={()=>copy(value)} />
              ))}

              <div className="card p-5 space-y-3">
                <p className="t-label mono">Publish</p>
                <p className="t-sm">
                  Posts the English and Nepali statuses to your Facebook Page as two separate posts.
                </p>
                <button onClick={publishToMeta} disabled={publishing} className="btn btn-primary w-full">
                  {publishing ? <Pending label="Publishing…" /> : 'Publish to Facebook'}
                </button>
                {pubError && <div className="note note-err" role="alert">{pubError}</div>}
                {pubResult && (
                  <div className={`note ${pubResult.status==='success' ? 'note-ok' : 'note-warn'}`} role="status">
                    <p className="font-medium mb-1.5">
                      {pubResult.status==='success' ? 'Published' : 'Partially published'}
                    </p>
                    {pubResult.results?.map((r, i)=>(
                      <p key={i} className="mono" style={{fontSize:'0.75rem'}}>
                        {r.type}: {r.status}{r.id && ` · ${r.id}`}{r.error && ` — ${r.error}`}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={exportPackage} className="btn btn-ghost w-full">
                Export creator package as JSON
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={()=>setStep(4)} className="btn btn-ghost flex-1">← Back</button>
          </div>
        </div>
      )}

      {/* ---------------- Activity ---------------- */}

      {showAnalytics && mode && (
        <div className="card p-5 mt-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="t-h2">Activity</h2>
            <button onClick={()=>setShowAnalytics(false)} className="t-sm tap-link hover:opacity-70 transition" style={{color:'var(--ink-3)'}}>Close</button>
          </div>

          {!analytics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-hidden="true">
              {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{height:'68px'}}/>)}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ['Total events', analytics.summary.totalEvents, 'var(--accent)'],
                  ['Success rate', `${analytics.summary.successRate}%`, 'var(--ok)'],
                  ['Creators', analytics.summary.creators, 'var(--ink)'],
                  ['Published', analytics.summary.published, 'var(--ink)']
                ].map(([label, value, color]) => (
                  <div key={label} className="card-hi p-4">
                    <p className="t-label mono mb-1.5">{label}</p>
                    <p className="text-xl font-semibold" style={{color}}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ['Voice clones', analytics.summary.voiceClones],
                  ['Avatars', analytics.summary.avatarsGenerated],
                  ['Content', analytics.summary.contentGenerated],
                  ['Errors', analytics.summary.errors],
                  ['Avg time', `${analytics.avgGenerationTime}ms`]
                ].map(([label, value]) => (
                  <div key={label} className="card-hi p-3">
                    <p className="t-label mono mb-1">{label}</p>
                    <p className="text-base font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              {analytics.recentEvents.length > 0 ? (
                <div>
                  <p className="t-label mono mb-2.5">Recent</p>
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {analytics.recentEvents.map((e, i)=>(
                      <div key={i} className="flex justify-between gap-4 px-3 py-2 rounded-lg card-hi">
                        <span className="text-xs mono truncate">{e.type}</span>
                        <span className="text-xs mono shrink-0" style={{color: e.status==='error' ? 'var(--err)' : 'var(--ink-3)'}}>
                          {e.status==='error' ? 'error' : new Date(e.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="t-sm">No activity recorded yet.</p>
              )}

              <button onClick={clearAnalytics} className="btn btn-danger btn-sm w-full">Clear activity</button>
            </div>
          )}
        </div>
      )}

      <Toasts items={toasts} dismiss={dismissToast} />
    </div>
  )
}
