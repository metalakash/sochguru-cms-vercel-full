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

/* Basic wizard ----------------------------------------------------- */

const BASIC_STEPS = ['Your idea', 'Quick questions', 'Your drafts']

// Below this the model has nothing specific to work from and every draft comes
// back as the same generic founder post.
const MIN_IDEA_WORDS = 15

const EXAMPLE_IDEA =
  'I left banking after ten years and now I build with AI agents from Kathmandu. ' +
  'This week I automated my invoice follow-ups and it saved a whole afternoon. ' +
  'My readers are split — dev friends here who read Nepali, and a tech audience ' +
  'abroad reading English.'

const NICHE_SUGGESTIONS = ['Agentic AI', 'Building in public', 'Career switch', 'Culture Nepal', 'Startups']
const INTENT_OPTIONS = ['Share a learning', 'Ask for help', 'Announce something', 'Teach a thing', 'Inspire']
const AUDIENCE_OPTIONS = ['Dev peers', 'Tech, broadly', 'Business owners', 'My niche community', 'A bit of everyone']

const wordCount = s => s.trim().split(/\s+/).filter(Boolean).length

/** Compact timestamp for the record list — recent things stay relative, older
 *  ones get a real date, because "14 days ago" stops being useful. */
function whenLabel(iso) {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const mins = Math.floor((Date.now() - then.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / 1440)}d ago`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const nfmt = n => (Number.isFinite(n) ? n.toLocaleString() : '—')

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

/** One question, answered by tapping. Buttons rather than radios — a radio dot
 *  is a 16px target and these have to work with a thumb. */
function ChipGroup({ legend, hint, options, value, onChange }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium mb-1">
        {legend} {hint && <span style={{color:'var(--ink-3)', fontWeight:400}}>— {hint}</span>}
      </legend>
      <div className="flex flex-wrap gap-2 mt-3">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(value === opt ? '' : opt)}
            className="chip"
          >{opt}</button>
        ))}
      </div>
    </fieldset>
  )
}

/** Key entry for Basic. The key is held in this browser and travels only with
 *  the user's own generate requests — the server keeps none and has no fallback
 *  of its own, so nobody can spend anyone else's quota. */
function KeyForm({ saved, onSave, onCancel, canCancel, recordsKept }) {
  const [draft, setDraft] = useState('')
  const [reveal, setReveal] = useState(false)

  const submit = e => {
    e.preventDefault()
    if (draft.trim()) onSave(draft)
  }

  return (
    <form onSubmit={submit} className="card p-5 mt-6">
      <p className="t-label mono mb-2">{saved ? 'Replace your Gemini key' : 'Your Gemini API key'}</p>
      <p className="t-sm mb-4">
        Basic runs on your own key, so your generations are billed to you and nobody
        else. Get one free at{' '}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent)' }}
        >aistudio.google.com/apikey</a>.
      </p>
      <div className="flex gap-2">
        <input
          type={reveal ? 'text' : 'password'}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Paste your key"
          autoComplete="off"
          spellCheck="false"
          className="field flex-1"
          aria-label="Gemini API key"
        />
        <button
          type="button"
          onClick={() => setReveal(r => !r)}
          className="btn btn-ghost btn-sm shrink-0"
        >{reveal ? 'Hide' : 'Show'}</button>
      </div>
      <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4">
        {canCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost sm:flex-1">Cancel</button>
        )}
        <button type="submit" disabled={!draft.trim()} className="btn btn-primary sm:flex-[2]">
          Save key
        </button>
      </div>
      <p className="t-sm mt-4">
        Stored in this browser only. It is sent with your own requests so they can reach
        Gemini, and is never written to the server or shared with anyone.
        {recordsKept && <> What you write in the box above <em>is</em> saved — the key is not.</>}
      </p>
    </form>
  )
}

/** One-line key status, so the cost model is visible before you press generate. */
function KeyStatus({ value, onChange, onRemove }) {
  const masked = value.length > 12
    ? `${value.slice(0, 6)}…${value.slice(-4)}`
    : '••••••'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-6">
      <p className="t-sm">
        <span style={{ color: 'var(--ink)' }}>Your key</span>{' '}
        <span className="mono" style={{ color: 'var(--ink-3)' }}>{masked}</span>
      </p>
      <button onClick={onChange} className="t-sm tap-link" style={{ color: 'var(--accent)' }}>Change</button>
      <button onClick={onRemove} className="t-sm tap-link" style={{ color: 'var(--ink-3)' }}>Remove</button>
    </div>
  )
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

  // Basic mode state — a three-step wizard: 1 idea, 2 quick questions, 3 result
  const [basicStep, setBasicStep] = useState(1)
  const [basicPrompt, setBasicPrompt] = useState('')
  const [basicGenerating, setBasicGenerating] = useState(false)
  const [basicResult, setBasicResult] = useState(null)
  const [basicError, setBasicError] = useState('')
  const [variantIdx, setVariantIdx] = useState(0)
  const [personalization, setPersonalization] = useState({niche:'', intent:'', audience:'', contextStory:''})

  // The visitor's own Gemini key. Browser-only: read from localStorage and sent
  // as a header with each generate request. The server never stores it, and
  // never falls back to a key of its own, so nobody spends anyone else's quota.
  const [geminiKey, setGeminiKey] = useState('')
  const [showKeyForm, setShowKeyForm] = useState(false)
  // True only for visitors who entered the access code on an instance that has
  // an operator key. They generate without bringing one; everyone else does not.
  const [serverKeyCovers, setServerKeyCovers] = useState(false)
  // Whether this instance actually keeps records. The page must not promise
  // people their prompts are stored on an instance that stores nothing.
  const [recordsKept, setRecordsKept] = useState(false)
  // A gate member is someone who entered the access code on an instance that
  // has one — the operator, in practice. Only they are offered the record view.
  const [isMember, setIsMember] = useState(false)

  // Operator record view
  const [showRecords, setShowRecords] = useState(false)
  const [records, setRecords] = useState(null)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsError, setRecordsError] = useState('')

  // Memory management
  const [memory, setMemory] = useState([])
  const [showMemory, setShowMemory] = useState(false)
  const [basicRating, setBasicRating] = useState(0)
  const [basicMemoryId, setBasicMemoryId] = useState(null)

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
  const readAccess = useCallback(() => fetch('/api/access')
    .then(r => r.json())
    .then(d => {
      setGate(!d.gateEnabled || d.authorized ? 'open' : 'locked')
      setServerKeyCovers(!!d.serverKeyAvailable)
      setRecordsKept(!!d.recordsKept)
      setIsMember(!!d.gateEnabled && !!d.authorized)
      return d
    }), [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/access')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        setGate(!d.gateEnabled || d.authorized ? 'open' : 'locked')
        setServerKeyCovers(!!d.serverKeyAvailable)
        setRecordsKept(!!d.recordsKept)
        setIsMember(!!d.gateEnabled && !!d.authorized)
      })
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
    try {
      const savedKey = localStorage.getItem('soch_gemini_key')
      if (savedKey) setGeminiKey(savedKey)
    } catch {}
    // Load memory on mount
    loadMemory()
  }, [])

  /** Persist the key to this browser only. Empty clears it. */
  const saveGeminiKey = key => {
    const trimmed = key.trim()
    setGeminiKey(trimmed)
    try {
      if (trimmed) localStorage.setItem('soch_gemini_key', trimmed)
      else localStorage.removeItem('soch_gemini_key')
    } catch {}
  }

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

  /* memory management for RAG learning */
  const saveToMemory = (interaction) => {
    try {
      const entry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        mode: interaction.mode,
        prompt: interaction.prompt,
        personalization: interaction.personalization,
        result: interaction.result,
        rating: 0,
        notes: ''
      }
      // Functional update — two generations in quick succession used to read the
      // same stale `memory` and drop one of them.
      setMemory(prev => {
        const updated = [entry, ...prev.slice(0, 49)]
        try { localStorage.setItem('soch_memory', JSON.stringify(updated)) } catch {}
        return updated
      })
      return entry
    } catch (err) {
      console.error('Memory save failed:', err)
    }
  }

  const loadMemory = () => {
    try {
      const stored = localStorage.getItem('soch_memory')
      if (stored) setMemory(JSON.parse(stored))
    } catch (err) {
      console.error('Memory load failed:', err)
    }
  }

  const rateInteraction = (id, rating) => {
    const updated = memory.map(m => m.id === id ? {...m, rating} : m)
    setMemory(updated)
    localStorage.setItem('soch_memory', JSON.stringify(updated))
  }

  const exportMemory = () => {
    const data = JSON.stringify(memory, null, 2)
    const blob = new Blob([data], {type:'application/json'})
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sochguru-memory-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Memory exported', 'ok')
  }

  const importMemory = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result)
        if (Array.isArray(imported)) {
          const merged = [...imported, ...memory].slice(0, 50)
          setMemory(merged)
          localStorage.setItem('soch_memory', JSON.stringify(merged))
          toast('Memory imported', 'ok')
        } else {
          toast('Invalid memory file format')
        }
      } catch (err) {
        toast('Could not parse memory file')
      }
    }
    reader.readAsText(file)
  }

  const clearMemory = () => {
    if (confirm('Clear all stored interactions? This cannot be undone.')) {
      setMemory([])
      localStorage.removeItem('soch_memory')
      toast('Memory cleared', 'ok')
    }
  }

  const deleteMemoryItem = (id) => {
    const updated = memory.filter(m => m.id !== id)
    setMemory(updated)
    localStorage.setItem('soch_memory', JSON.stringify(updated))
  }

  const getMemoryStats = () => {
    if (memory.length === 0) return null
    const niches = {}
    const intents = {}
    const audiences = {}
    memory.forEach(m => {
      if (m.personalization?.niche) niches[m.personalization.niche] = (niches[m.personalization.niche] || 0) + 1
      if (m.personalization?.intent) intents[m.personalization.intent] = (intents[m.personalization.intent] || 0) + 1
      if (m.personalization?.audience) audiences[m.personalization.audience] = (audiences[m.personalization.audience] || 0) + 1
    })
    const topNiche = Object.entries(niches).sort((a,b) => b[1] - a[1])[0]
    const topIntent = Object.entries(intents).sort((a,b) => b[1] - a[1])[0]
    const topAudience = Object.entries(audiences).sort((a,b) => b[1] - a[1])[0]
    const avgRating = memory.reduce((sum, m) => sum + m.rating, 0) / memory.length || 0
    return { topNiche: topNiche?.[0], topIntent: topIntent?.[0], topAudience: topAudience?.[0], avgRating }
  }

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics')
      setAnalytics(await res.json())
    } catch (err) {
      toast('Could not load activity.')
    }
  }

  /** Operator record view. Distinguishes "you cannot read this" from "there is
   *  nothing to read" from "nothing is being recorded" — three very different
   *  problems that all look like an empty screen otherwise. */
  const fetchRecords = async () => {
    setRecordsLoading(true)
    setRecordsError('')
    try {
      const res = await fetch('/api/generations?limit=100')
      const data = await res.json()
      if (!res.ok) {
        setRecords(null)
        setRecordsError(data.code === 'no_db'
          ? 'no_db'
          : data.code === 'locked' ? 'locked' : (data.error || 'Could not load records.'))
        return
      }
      setRecords(data)
    } catch {
      setRecordsError('Could not reach the record store.')
    } finally {
      setRecordsLoading(false)
    }
  }

  const openRecords = () => {
    setShowMemory(false)
    setShowRecords(true)
    fetchRecords()
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

  const resetBasic = () => {
    setBasicStep(1)
    setBasicPrompt('')
    setPersonalization({niche:'', intent:'', audience:'', contextStory:''})
    setBasicResult(null)
    setBasicError('')
    setBasicRating(0)
    setBasicMemoryId(null)
    setVariantIdx(0)
  }

  /** Functional update, because tapping two chips fast enough lands both handlers
   *  in one batch — spreading the render's `personalization` there loses the first. */
  const setAnswer = (key, value) => setPersonalization(p => ({ ...p, [key]: value }))

  /** Landing CTA. A finished pack means "write my first post" is asking for a
   *  new one — but a half-typed idea should survive the round trip. */
  const startBasic = () => {
    if (basicStep === 3) resetBasic()
    setShowMemory(false)
    setMode('basic')
  }

  const generateBasicPack = async () => {
    if (!basicPrompt.trim()) {
      setBasicError('Please enter a content idea or topic')
      return
    }
    // Ask here rather than round-tripping to a 400 — it keeps the answers on
    // screen instead of bouncing the user to the error step. Gate members the
    // operator's key covers are never asked.
    if (!geminiKey && !serverKeyCovers) {
      setShowKeyForm(true)
      return
    }
    setBasicGenerating(true)
    setBasicError('')
    setBasicResult(null)
    setBasicStep(3)
    try {
      const payload = {
        prompt: basicPrompt,
        ...(personalization.niche && { niche: personalization.niche }),
        ...(personalization.intent && { intent: personalization.intent }),
        ...(personalization.audience && { audience: personalization.audience }),
        ...(personalization.contextStory && { context: personalization.contextStory })
      }
      const res = await fetch('/api/generate-basic-pack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Header, not body: keeps the key out of request logs and analytics.
          // Omitted when the operator's key covers this visitor.
          ...(geminiKey && { 'x-gemini-key': geminiKey })
        },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (res.status === 401) { setGate('locked'); return }
      // A rejected or missing key is fixable in place — reopen the form rather
      // than stranding the user on the generic error step.
      if (data.code === 'no_key' || data.code === 'bad_key' || data.code === 'server_key_bad') {
        setBasicStep(2)
        setShowKeyForm(true)
        setBasicError(data.error)
        return
      }
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`)
      setBasicResult(data)
      setBasicRating(0)
      setVariantIdx(0)
      const entry = saveToMemory({ mode: 'basic', prompt: basicPrompt, personalization, result: data })
      setBasicMemoryId(entry?.id ?? null)
      trackAnalytics('basic_pack_generated', {
        source: data.source,
        variations: data.variations?.length || 0,
        personalized: !!(personalization.niche || personalization.intent || personalization.audience)
      })
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

  /* ---------------- derived: the variation currently on screen ----------------
     Older packs in memory predate variations, so fall back to the flat fields. */

  const variants = basicResult?.variations?.length
    ? basicResult.variations
    : basicResult
      ? [{ label: '', englishStatus: basicResult.englishStatus, nepaliStatus: basicResult.nepaliStatus }]
      : []
  const activeVariant = variants[Math.min(variantIdx, variants.length - 1)] || {}

  /** What the user is actually looking at — exports follow the visible version,
   *  not whichever one the model happened to return first. */
  const activePack = basicResult && {
    ...basicResult,
    englishStatus: activeVariant.englishStatus || basicResult.englishStatus,
    nepaliStatus: activeVariant.nepaliStatus || basicResult.nepaliStatus,
    selectedVersion: activeVariant.label || `Version ${variantIdx + 1}`
  }

  /* ---------------- gate ---------------- */

  if (gate === 'locked') {
    return (
      <>
        {/* Re-read after unlocking: the cookie is what decides whether the
            operator's key covers this visitor. */}
        <AccessGate onUnlock={() => { setGate('open'); readAccess().catch(() => {}) }} />
        <Toasts items={toasts} dismiss={dismissToast} />
      </>
    )
  }

  /* ---------------- landing ----------------
     `showMemory` falls through to the shell below, which is where the dashboard
     lives — otherwise the footer's Memory button set state nobody rendered. */

  if (!mode && !showMemory && !showRecords) return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6">

        {/* Hero — the CTA sits here, above the fold, not four sections down */}
        <section className="pt-20 pb-16 md:pt-28">
          <p className="t-label mono mb-5">Hadigaun, Kathmandu</p>
          <h1 className="t-display mb-6">
            Stop writing<br/>
            for one language.<br/>
            <span style={{color:'var(--accent)'}}>Reach both.</span>
          </h1>
          <h2 className="t-h2 mb-7" style={{color:'var(--ink-3)'}} lang="ne-Latn">
            Ek paragraph. Duwai post. Ek click.
          </h2>

          <p className="t-lead max-w-xl mb-9">
            Your audience is split between Nepali and English readers. Stop writing twice.
            One paragraph. Get Nepali + English posts and video scripts—all ready to go.
          </p>

          <button onClick={startBasic} className="btn btn-primary w-full sm:w-auto" style={{paddingInline:'2rem'}}>
            Create bilingual content →
          </button>

          <p className="t-sm mono mt-4">
            No signup · Your own Gemini key ·{' '}
            {recordsKept ? 'Your prompts are saved' : 'Nothing posts without you'}
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
              <span style={{color:'var(--ink)'}}>Basic runs on your own Gemini key.</span>{' '}
              It is saved to this browser, and sent with your own requests so they can
              reach Gemini — it is never written to the server and never shared. Every
              call is billed to your Google account at their rates, so what you generate
              is yours and costs nobody else anything.
            </p>
            {recordsKept && (
              <p>
                <span style={{color:'var(--ink)'}}>What you write here is saved.</span>{' '}
                Your idea, the answers you tap, and the drafts that come back are stored so
                I can see what people are actually using this for and make it better. Your
                API key is the one thing that is not — it is used for your request and
                thrown away. If that trade is not for you, this is the moment to close the
                tab rather than the moment to find out later.
              </p>
            )}
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
          <h2 className="t-h1 mb-4">Save 50% of your content workflow.</h2>
          <p className="t-body mb-8 max-w-lg">
            Thirty seconds to describe your idea. Six pieces come back. Both languages,
            ready to post. No rewrites, no translations, no double-work.
          </p>
          <button onClick={startBasic} className="btn btn-primary w-full sm:w-auto" style={{paddingInline:'2rem'}}>
            Build your first pack →
          </button>
          <p className="t-sm mt-6">
            <span style={{color:'var(--ink)'}}>Pro coming soon</span> — your recorded voice,
            gestures and avatar video, with the AI included so you bring no key of your own.
          </p>
        </section>

        <footer className="hairline py-10 flex items-center justify-between">
          <p className="t-sm mono">Built in Hadigaun, Kathmandu</p>
          <div className="flex items-center gap-4">
            {/* Offered only to gate members — the operator, in practice. A
                visitor would just be handed a 401. */}
            {isMember && (
              <button onClick={openRecords} className="tap-link text-xs">
                Records
              </button>
            )}
            {memory.length > 0 && (
              <button onClick={() => setShowMemory(true)} className="tap-link text-xs">
                📚 Memory ({memory.length})
              </button>
            )}
          </div>
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
          <button onClick={()=>{setShowMemory(false); setShowRecords(false); setMode(null)}} className="t-sm tap-link hover:opacity-70 transition shrink-0" style={{color:'var(--ink-3)'}}>← Back</button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">
              SochGuru <span style={{color:'var(--ink-3)'}}>/</span> <span style={{color:'var(--accent)'}}>{showRecords ? 'Records' : showMemory ? 'Memory' : mode==='basic' ? 'Basic' : 'Pro'}</span>
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

      {mode==='basic' && !showMemory && (
        <div className="max-w-2xl mx-auto pb-16">
          <div className="mb-9">
            <div className="flex items-center justify-between mb-2">
              <span className="t-sm mono">Step {basicStep} of 3</span>
              <span className="t-sm mono" style={{color:'var(--accent)'}}>{BASIC_STEPS[basicStep-1]}</span>
            </div>
            <div
              className="rail"
              role="progressbar"
              aria-valuenow={basicStep}
              aria-valuemin={1}
              aria-valuemax={3}
              aria-label={`Step ${basicStep} of 3: ${BASIC_STEPS[basicStep-1]}`}
            >
              <i style={{width:`${(basicStep/3)*100}%`}} />
            </div>
          </div>

          {/* ---- Step 1: the idea, in their own words ---- */}

          {basicStep===1 && (
            <div className="step-in">
              <h1 className="t-display mb-3">What are you posting about?</h1>
              <p className="t-lead mb-8">
                One paragraph, the way you would tell a friend. Everything else is
                built from this, so specific beats polished.
              </p>

              <label htmlFor="basic-prompt" className="t-label mono mb-3 block">Your idea</label>
              <textarea
                id="basic-prompt"
                value={basicPrompt}
                onChange={e=>setBasicPrompt(e.target.value)}
                placeholder={`e.g. ${EXAMPLE_IDEA}`}
                aria-describedby="basic-prompt-help"
                className="field field-example"
                style={{
                  height: '13rem',
                  lineHeight: 1.7,
                  resize: 'vertical',
                  fontSize: '1.0625rem',
                  padding: '1.25rem',
                  borderRadius: '12px'
                }}
              />

              <div className="flex justify-between items-center gap-4 mt-3">
                <p id="basic-prompt-help" className="t-sm" aria-live="polite">
                  {wordCount(basicPrompt) === 0
                    ? 'A few sentences is plenty.'
                    : wordCount(basicPrompt) < MIN_IDEA_WORDS
                      ? `${wordCount(basicPrompt)} words — ${MIN_IDEA_WORDS - wordCount(basicPrompt)} more to continue`
                      : `${wordCount(basicPrompt)} words — good to go`}
                </p>
                <div className="rail shrink-0" style={{width:'88px'}} aria-hidden="true">
                  <i style={{width:`${Math.min(100, (wordCount(basicPrompt) / 40) * 100)}%`}} />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-7">
                <button
                  onClick={()=>setBasicPrompt(EXAMPLE_IDEA)}
                  className="btn btn-ghost sm:flex-1"
                >Fill in an example</button>
                <button
                  onClick={()=>{ setBasicError(''); setBasicStep(2) }}
                  disabled={wordCount(basicPrompt) < MIN_IDEA_WORDS}
                  className="btn btn-primary sm:flex-1"
                >Continue →</button>
              </div>
            </div>
          )}

          {/* ---- Step 2: the quick questions, all visible and editable ---- */}

          {basicStep===2 && (
            <div className="step-in">
              <h1 className="t-h1 mb-2">A few quick things</h1>
              <p className="t-body mb-8">
                Half a minute here is the difference between drafts that sound like
                you and drafts that sound like everyone. Skip anything that does not fit.
              </p>

              <div className="card p-4 mb-8">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <p className="t-label mono">Your idea</p>
                  <button onClick={()=>setBasicStep(1)} className="t-sm tap-link shrink-0" style={{color:'var(--accent)'}}>
                    Edit
                  </button>
                </div>
                <p className="t-body">
                  {basicPrompt.length > 180 ? `${basicPrompt.slice(0, 180).trim()}…` : basicPrompt}
                </p>
              </div>

              <div className="space-y-8">
                <div>
                  <label htmlFor="basic-niche" className="text-sm font-medium block mb-1">
                    What is this about? <span style={{color:'var(--ink-3)', fontWeight:400}}>— your topic, in a few words</span>
                  </label>
                  <input
                    id="basic-niche"
                    value={personalization.niche}
                    onChange={e=>setAnswer('niche', e.target.value)}
                    placeholder="Agentic AI, career switch, Kathmandu tech…"
                    className="field mt-3"
                  />
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[...new Set([getMemoryStats()?.topNiche, ...NICHE_SUGGESTIONS].filter(Boolean))].slice(0, 5).map(s => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={personalization.niche === s}
                        onClick={()=>setAnswer('niche', personalization.niche === s ? '' : s)}
                        className="chip"
                      >{s}</button>
                    ))}
                  </div>
                </div>

                <ChipGroup
                  legend="What should this post do?"
                  hint="pick the closest"
                  options={INTENT_OPTIONS}
                  value={personalization.intent}
                  onChange={v=>setAnswer('intent', v)}
                />

                <ChipGroup
                  legend="Who is reading it?"
                  hint="your main audience"
                  options={AUDIENCE_OPTIONS}
                  value={personalization.audience}
                  onChange={v=>setAnswer('audience', v)}
                />

                <div>
                  <label htmlFor="basic-context" className="text-sm font-medium block mb-1">
                    Anything else? <span style={{color:'var(--ink-3)', fontWeight:400}}>— optional</span>
                  </label>
                  <input
                    id="basic-context"
                    value={personalization.contextStory}
                    onChange={e=>setAnswer('contextStory', e.target.value)}
                    placeholder="A number to include, a phrase to avoid, a launch date…"
                    className="field mt-3"
                  />
                </div>
              </div>

              {basicError && <div className="note note-err mt-6" role="alert">{basicError}</div>}

              {showKeyForm || (!geminiKey && !serverKeyCovers) ? (
                <KeyForm
                  saved={!!geminiKey}
                  canCancel={!!geminiKey || serverKeyCovers}
                  recordsKept={recordsKept}
                  onSave={k => { saveGeminiKey(k); setShowKeyForm(false); setBasicError('') }}
                  onCancel={() => setShowKeyForm(false)}
                />
              ) : geminiKey ? (
                <KeyStatus
                  value={geminiKey}
                  onChange={() => setShowKeyForm(true)}
                  onRemove={() => { saveGeminiKey(''); setShowKeyForm(true) }}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-6">
                  <p className="t-sm">
                    <span style={{ color: 'var(--ink)' }}>Running on the SochGuru key</span>{' '}
                    — your access code covers this one.
                  </p>
                  <button
                    onClick={() => setShowKeyForm(true)}
                    className="t-sm tap-link"
                    style={{ color: 'var(--accent)' }}
                  >Use my own key</button>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-9">
                <button onClick={()=>setBasicStep(1)} className="btn btn-ghost sm:flex-1">← Back</button>
                <button
                  onClick={generateBasicPack}
                  disabled={basicGenerating}
                  className="btn btn-primary sm:flex-[2]"
                >
                  {basicGenerating ? <Pending label="Writing…" /> : 'Generate 3 versions →'}
                </button>
              </div>
              <p className="t-sm text-center mt-3">
                {[personalization.niche, personalization.intent, personalization.audience].filter(Boolean).length} of 3
                answered · all optional
              </p>
            </div>
          )}

          {/* ---- Step 3: the drafts ---- */}

          {basicStep===3 && basicGenerating && (
            <div className="step-in">
              <h1 className="t-h1 mb-2">Writing three versions…</h1>
              <p className="t-body">Same idea, three different openings. About twenty seconds.</p>
              <GeneratingSkeleton />
            </div>
          )}

          {basicStep===3 && !basicGenerating && basicError && (
            <div className="step-in">
              <h1 className="t-h1 mb-4">That did not go through</h1>
              <div className="note note-err mb-6" role="alert">{basicError}</div>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button onClick={()=>setBasicStep(2)} className="btn btn-ghost sm:flex-1">← Back to questions</button>
                <button onClick={generateBasicPack} className="btn btn-primary sm:flex-1">Try again</button>
              </div>
            </div>
          )}

          {basicStep===3 && basicResult && !basicGenerating && (
            <div className="step-in space-y-4">
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

              {variants.length > 1 && (
                <div className="card p-5">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <p className="t-label mono mb-1">Three takes on it</p>
                      <p className="t-sm">{activeVariant.label || `Version ${variantIdx + 1}`}</p>
                    </div>
                    <div className="seg shrink-0" role="group" aria-label="Choose a version">
                      {variants.map((v, i) => (
                        <button
                          key={i}
                          className="seg-btn"
                          aria-pressed={variantIdx === i}
                          onClick={()=>{ setVariantIdx(i); trackAnalytics('variation_switched', { index: i, angle: v.angle }) }}
                        >{String.fromCharCode(65 + i)}</button>
                      ))}
                    </div>
                  </div>
                  <p className="t-sm">
                    Switching versions changes both status posts below. The scripts and
                    prompts stay the same.
                  </p>
                </div>
              )}

              {[
                ['Nepali status', activeVariant.nepaliStatus || basicResult.nepaliStatus],
                ['English status', activeVariant.englishStatus || basicResult.englishStatus],
                ['Nepali video script', basicResult.nepaliVideo],
                ['English video script', basicResult.englishVideo],
                ['Image prompt', basicResult.imagePrompt],
                ['Video prompt', basicResult.veoPrompt]
              ].filter(([,v]) => v).map(([label, value]) => (
                <ContentCard key={label} label={label} value={value} onCopy={()=>copy(value)} />
              ))}

              {basicResult.hashtags?.length > 0 && (
                <div className="card p-5">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <p className="t-label mono">Hashtags</p>
                    <button
                      onClick={()=>copy(basicResult.hashtags.map(h=>`#${h}`).join(' '))}
                      className="t-sm tap-link hover:opacity-70 transition shrink-0"
                      style={{color:'var(--ink-3)'}}
                    >Copy</button>
                  </div>
                  <p className="t-body mono">{basicResult.hashtags.map(h=>`#${h}`).join('  ')}</p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button onClick={resetBasic} className="btn btn-ghost sm:flex-1">Write another</button>
                <button
                  onClick={generateBasicPack}
                  disabled={basicGenerating}
                  className="btn btn-ghost sm:flex-1"
                >Regenerate these three</button>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="t-label mono">How was this?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (basicMemoryId) rateInteraction(basicMemoryId, 1)
                      setBasicRating(1)
                      toast('Saved — helps us learn', 'ok')
                    }}
                    aria-pressed={basicRating === 1}
                    className={`text-xl p-2 hover:scale-110 transition ${basicRating === 1 ? 'opacity-100' : 'opacity-50'}`}
                    title="Good result"
                  >
                    👍
                  </button>
                  <button
                    onClick={() => {
                      if (basicMemoryId) rateInteraction(basicMemoryId, -1)
                      setBasicRating(-1)
                      toast('Noted — we\'ll improve', 'ok')
                    }}
                    aria-pressed={basicRating === -1}
                    className={`text-xl p-2 hover:scale-110 transition ${basicRating === -1 ? 'opacity-100' : 'opacity-50'}`}
                    title="Needs work"
                  >
                    👎
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="t-label mono">Export as</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { download(activePack, 'sochguru-content.json'); trackAnalytics('basic_pack_exported', {format:'json'}) }}
                    className="btn btn-ghost btn-sm w-full"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => {
                      const csv = [['Field','Content'],...Object.entries(activePack).map(([k,v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
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
                      const tags = activePack.hashtags?.length ? `\n\n## Hashtags\n${activePack.hashtags.map(h=>`#${h}`).join(' ')}` : ''
                      const md = `# ${activePack.persona?.name || 'Content Pack'}\n\n**Niche:** ${activePack.persona?.niche}\n**Audience:** ${activePack.persona?.audience}\n**Version:** ${activePack.selectedVersion}\n\n## Story\n${activePack.persona?.story}\n\n## Nepali Status\n${activePack.nepaliStatus}\n\n## English Status\n${activePack.englishStatus}\n\n## Nepali Video Script\n${activePack.nepaliVideo}\n\n## English Video Script\n${activePack.englishVideo}\n\n## Image Prompt\n${activePack.imagePrompt}\n\n## Video Prompt\n${activePack.veoPrompt}${tags}`
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

      {/* ---------------- Memory dashboard ---------------- */}

      {showRecords && (
        <div className="max-w-4xl mx-auto pb-16">
          <div className="mb-8">
            <button onClick={() => setShowRecords(false)} className="tap-link mb-4">← Back</button>
            <div className="flex items-baseline justify-between gap-4 flex-wrap mb-2">
              <h2 className="t-h1">Records</h2>
              <button onClick={fetchRecords} disabled={recordsLoading} className="btn btn-ghost btn-sm">
                {recordsLoading ? <Pending label="Loading…" /> : 'Refresh'}
              </button>
            </div>
            <p className="t-body">
              What people have generated here. Prompts and the answers they tapped — never their keys.
            </p>
          </div>

          {recordsLoading && !records && <GeneratingSkeleton />}

          {/* Three different empty screens, because they are three different
              problems and a blank page tells you nothing about which. */}
          {recordsError === 'no_db' && (
            <div className="card p-6 space-y-3">
              <p className="t-label mono">Nothing is being recorded</p>
              <p className="t-body">
                This instance has no database. Set <span className="mono" style={{color:'var(--ink)'}}>DATABASE_URL</span>{' '}
                to a Postgres connection string and redeploy — generations start landing
                here from that moment, and the landing page begins telling visitors so.
              </p>
            </div>
          )}

          {recordsError === 'locked' && (
            <div className="card p-6 space-y-3">
              <p className="t-label mono">Locked</p>
              <p className="t-body">
                This view needs the access code. It holds other people's prompts, so it
                stays shut whenever <span className="mono" style={{color:'var(--ink)'}}>CMS_ACCESS_CODE</span>{' '}
                is unset rather than falling open.
              </p>
            </div>
          )}

          {recordsError && recordsError !== 'no_db' && recordsError !== 'locked' && (
            <div className="note note-err" role="alert">{recordsError}</div>
          )}

          {records && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {[
                  ['Generations', nfmt(records.totals?.total), null],
                  ['Succeeded', nfmt(records.totals?.succeeded),
                    records.totals?.failed > 0 ? `${nfmt(records.totals.failed)} failed` : null],
                  ['Tokens', nfmt(records.totals?.tokens), 'all callers'],
                  ['On your key', nfmt(records.totals?.on_server_key),
                    `${nfmt(records.totals?.on_user_key)} on their own`]
                ].map(([label, value, sub]) => (
                  <div key={label} className="card p-4">
                    <p className="t-label mono mb-1">{label}</p>
                    <p className="text-xl font-semibold" style={{color:'var(--ink)', fontVariantNumeric:'tabular-nums'}}>{value}</p>
                    {sub && <p className="t-sm mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>

              {records.rows.length === 0 ? (
                <div className="card p-6 text-center">
                  <p className="t-body" style={{color:'var(--ink-3)'}}>
                    The store is connected and empty. The next generation anyone runs shows up here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {records.rows.map(r => (
                    <div key={r.id} className="card p-5">
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="t-label mono">{whenLabel(r.created_at)}</span>
                        <span className={`pill mono ${r.key_source === 'server' ? 'pill-accent' : 'pill-muted'}`}>
                          {r.key_source === 'server' ? 'YOUR KEY' : 'OWN KEY'}
                        </span>
                        {!r.ok && <span className="pill mono" style={{color:'var(--err)'}}>{r.error_code || 'FAILED'}</span>}
                      </div>

                      <p className="t-body whitespace-pre-wrap mb-3" style={{color:'var(--ink)'}}>{r.prompt}</p>

                      {(r.niche || r.intent || r.audience || r.context) && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {[r.niche, r.intent, r.audience].filter(Boolean).map((v, i) => (
                            <span key={i} className="pill pill-muted">{v}</span>
                          ))}
                          {r.context && <span className="pill pill-muted">“{r.context}”</span>}
                        </div>
                      )}

                      <p className="t-sm mono">
                        {[
                          r.total_tokens ? `${nfmt(r.total_tokens)} tokens` : null,
                          r.variations ? `${r.variations} variations` : null,
                          r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : null,
                          r.model
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showMemory && (
        <div className="max-w-3xl mx-auto pb-16">
          <div className="mb-8">
            <button onClick={() => setShowMemory(false)} className="tap-link mb-4">← Back</button>
            <h2 className="t-h1 mb-2">Your Memory</h2>
            <p className="t-body mb-6">Stored interactions help us learn your style and preferences.</p>
          </div>

          {memory.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="t-body" style={{color:'var(--ink-3)'}}>No interactions yet. Generate some content to build your memory.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-10">
                <div className="card p-5 space-y-3">
                  <p className="t-label mono">Patterns detected</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {(() => {
                      const stats = getMemoryStats()
                      const rows = [
                        stats.topNiche && ['Niche', stats.topNiche],
                        stats.topIntent && ['Intent', stats.topIntent],
                        stats.topAudience && ['Audience', stats.topAudience],
                        stats.avgRating > 0 && ['Rating', `${stats.avgRating.toFixed(1)}/1 avg`]
                      ].filter(Boolean)

                      // An empty card reads as broken. Say why it is empty instead.
                      if (rows.length === 0) return (
                        <p className="t-body sm:col-span-2">
                          Nothing yet. Answer the quick questions when you generate and
                          your usual topic, goal and audience show up here.
                        </p>
                      )
                      return rows.map(([label, value]) => (
                        <div key={label}><p className="text-sm font-medium">{label}: {value}</p></div>
                      ))
                    })()}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="t-label mono">Interactions ({memory.length})</p>
                {memory.map(item => (
                  <div key={item.id} className="card p-4 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium mb-1">{item.prompt.split('\n')[0].slice(0, 80)}...</p>
                        <p className="t-sm" style={{color:'var(--ink-3)'}}>
                          {item.personalization?.niche && `${item.personalization.niche} • `}
                          {item.personalization?.intent && `${item.personalization.intent} • `}
                          {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {item.rating === 1 && <span title="Rated good">👍</span>}
                        {item.rating === -1 && <span title="Rated needs work">👎</span>}
                        <button
                          onClick={() => deleteMemoryItem(item.id)}
                          className="tap-link text-xs"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-10 flex-wrap">
                <button onClick={exportMemory} className="btn btn-ghost btn-sm">📥 Export Memory</button>
                <label className="btn btn-ghost btn-sm cursor-pointer">
                  📤 Import Memory
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => e.target.files?.[0] && importMemory(e.target.files[0])}
                    style={{display:'none'}}
                  />
                </label>
                <button onClick={clearMemory} className="btn btn-ghost btn-sm" style={{color:'var(--accent)'}}>🗑️ Clear All</button>
              </div>
            </>
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
                  Using the built-in template. Add your Gemini key in Basic to get generated content.
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
