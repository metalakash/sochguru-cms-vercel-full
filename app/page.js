'use client'
import { useState, useEffect, useRef } from 'react'

const GESTURE_LINES = {
  'Smile': 'Hey, I\'m building in public from Kathmandu.',
  'Pointing': 'Here\'s the one thing that changed my week.',
  'Thinking': 'I don\'t have this fully figured out yet.',
  'Thumbs Up': 'That one\'s worth trying yourself.',
  'Explaining': 'Let me walk you through how this works.',
  'Walking': 'Let\'s learn and grow together.'
}

export default function Page() {
  const [mode, setMode] = useState(null) // null = selector, 'basic' or 'pro'
  const [step, setStep] = useState(1)
  const [persona, setPersona] = useState({name:'', story:'My decade in banking. Shifting to Agentic AI and culture in Nepal. I don\'t have all the answers. Just sharing as I navigate it all. Let\'s learn and grow together.', niche:'Agentic AI', audience:'Both Bilingual'})
  const [voices, setVoices] = useState([])
  const [videos, setVideos] = useState([])
  const [pageId, setPageId] = useState('61590521291901')
  const [content, setContent] = useState(null)
  const previewRef = useRef(null)
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
  const avatarPollRef = useRef(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [activeGesture, setActiveGesture] = useState('Smile')
  const [camReady, setCamReady] = useState(false)

  // Basic mode state
  const [basicPrompt, setBasicPrompt] = useState('')
  const [basicGenerating, setBasicGenerating] = useState(false)
  const [basicResult, setBasicResult] = useState(null)
  const [basicError, setBasicError] = useState('')

  useEffect(()=>{
    const saved = localStorage.getItem('soch_cms_persona')
    if(saved) setPersona(JSON.parse(saved))
  },[])

  useEffect(()=>{
    if(!avatarJobId) {
      if(avatarPollRef.current) clearInterval(avatarPollRef.current)
      return
    }
    const poll = setInterval(async ()=>{
      try{
        const res = await fetch('/api/generate-avatar', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({action: 'status', jobId: avatarJobId})
        })
        const data = await res.json()
        if(data.status === 'completed' && data.videoUrl){
          setAvatarResult(data)
          setAvatarJobId('')
          if(avatarPollRef.current) clearInterval(avatarPollRef.current)
          trackAnalytics('avatar_generated', {status: 'success'})
        }
      }catch(err){
        console.error('Avatar status check failed:', err)
      }
    }, 5000)
    avatarPollRef.current = poll
    return ()=>clearInterval(poll)
  }, [avatarJobId])

  const trackAnalytics = async (type, data = {})=>{
    try{
      await fetch('/api/analytics', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'track', event: {type, ...data}})
      })
    }catch(err){
      console.error('Analytics tracking failed:', err)
    }
  }

  const fetchAnalytics = async ()=>{
    try{
      const res = await fetch('/api/analytics?action=report')
      const data = await res.json()
      setAnalytics(data)
    }catch(err){
      console.error('Failed to fetch analytics:', err)
    }
  }

  const savePersona = ()=>{
    localStorage.setItem('soch_cms_persona', JSON.stringify(persona))
    trackAnalytics('creator_created', {name: persona.name, niche: persona.niche})
    setStep(2)
  }

  const startCam = async ()=>{
    try{
      const s = await navigator.mediaDevices.getUserMedia({video:true, audio:true})
      if(previewRef.current) previewRef.current.srcObject = s
      window._stream = s
      setCamReady(true)
    }catch(err){
      alert('Could not access camera/mic: '+err.message+'. Please allow permission and try again.')
    }
  }

  const recordVoice = async (type)=>{
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio:true})
      const rec = new MediaRecorder(stream)
      let chunks=[]
      rec.ondataavailable = e=>chunks.push(e.data)
      rec.onstop = ()=>{
        const blob = new Blob(chunks, {type:'audio/webm'})
        const url = URL.createObjectURL(blob)
        setVoices(v=>[...v, {type, url, blob}])
        stream.getTracks().forEach(t=>t.stop())
      }
      rec.start()
      setRecording(true)
      setTimeout(()=>{rec.stop(); setRecording(false)}, 5000)
    }catch(err){
      alert('Could not access microphone: '+err.message+'. Please allow permission and try again.')
    }
  }

  const recordVideo = async ()=>{
    try{
      const stream = window._stream || await navigator.mediaDevices.getUserMedia({video:true, audio:true})
      window._stream = stream
      if(stream.getAudioTracks().length === 0){
        alert('No microphone track found. Reload and allow both camera and microphone so your voice is captured with the gesture.')
        return
      }
      const gesture = activeGesture
      const rec = new MediaRecorder(stream)
      let chunks=[]
      rec.ondataavailable = e=>chunks.push(e.data)
      rec.onstop = ()=>{
        const blob = new Blob(chunks, {type:'video/webm'})
        const url = URL.createObjectURL(blob)
        setVideos(v=>[...v, {url, blob, gesture}])
      }
      rec.start()
      setRecording(true)
      setTimeout(()=>{rec.stop(); setRecording(false)}, 5000)
    }catch(err){
      alert('Could not access camera: '+err.message+'. Please allow permission and try again.')
    }
  }

  const generateBasicPack = async ()=>{
    if(!basicPrompt.trim()){
      setBasicError('Please enter a content idea or topic')
      return
    }
    setBasicGenerating(true)
    setBasicError('')
    setBasicResult(null)
    try{
      const res = await fetch('/api/generate-basic-pack', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt: basicPrompt})
      })
      const data = await res.json()
      if(!res.ok) throw new Error(data.error || `Server returned ${res.status}`)
      setBasicResult(data)
      trackAnalytics('basic_pack_generated', {source: data.source})
    }catch(err){
      setBasicError(err.message)
      trackAnalytics('basic_pack_generated', {status: 'error', error: err.message})
    }finally{
      setBasicGenerating(false)
    }
  }

  const generateContent = async ()=>{
    setGenerating(true)
    setGenError('')
    try{
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({persona})
      })
      if(!res.ok) throw new Error('Server returned '+res.status)
      const data = await res.json()
      setContent(data)
      localStorage.setItem('soch_last_content', JSON.stringify(data))
      trackAnalytics('content_generated', {source: data.source})
    }catch(err){
      setGenError('Could not generate content: '+err.message)
      trackAnalytics('content_generated', {status: 'error', error: err.message})
    }finally{
      setGenerating(false)
    }
  }

  const generateAvatar = async ()=>{
    if(!content) {
      setAvatarError('Generate content first (Step 5)')
      return
    }
    setGeneratingAvatar(true)
    setAvatarError('')
    setAvatarResult(null)
    setAvatarJobId('')
    try{
      const voiceId = cloneResult?.results?.[0]?.voiceId
      const res = await fetch('/api/generate-avatar', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'generate',
          script: content.englishVideo,
          voiceId: voiceId || undefined
        })
      })
      if(!res.ok) throw new Error('Server returned '+res.status)
      const data = await res.json()
      setAvatarJobId(data.jobId)
    }catch(err){
      setAvatarError('Avatar generation failed: '+err.message)
    }finally{
      setGeneratingAvatar(false)
    }
  }

  const cloneVoices = async ()=>{
    if(voices.length === 0) {
      setCloneError('Record at least one voice sample first')
      return
    }
    setCloning(true)
    setCloneError('')
    setCloneResult(null)
    try{
      const voiceSamples = await Promise.all(voices.map(async (v)=>{
        const buf = await v.blob.arrayBuffer()
        return {type: v.type, data: Buffer.from(buf).toString('base64')}
      }))
      const res = await fetch('/api/clone-voice', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({voiceSamples, creatorName: persona.name || 'SochGuru'})
      })
      if(!res.ok) throw new Error('Server returned '+res.status)
      const data = await res.json()
      setCloneResult(data)
      if(data.status === 'success'){
        trackAnalytics('voice_cloned', {voiceCount: voices.length, status: 'success'})
      }else{
        trackAnalytics('voice_cloned', {voiceCount: voices.length, status: 'partial', errors: data.results.filter(r=>r.status==='failed').length})
      }
    }catch(err){
      setCloneError('Voice cloning failed: '+err.message)
      trackAnalytics('voice_cloned', {status: 'error', error: err.message})
    }finally{
      setCloning(false)
    }
  }

  const publishToMeta = async ()=>{
    if(!content) return
    setPublishing(true)
    setPubError('')
    setPubResult(null)
    try{
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({pageId, content})
      })
      if(!res.ok) throw new Error('Server returned '+res.status)
      const data = await res.json()
      setPubResult(data)
      trackAnalytics('published', {status: data.status, postsCount: data.results?.length})
    }catch(err){
      setPubError('Publish failed: '+err.message)
      trackAnalytics('published', {status: 'error', error: err.message})
    }finally{
      setPublishing(false)
    }
  }

  const exportPackage = ()=>{
    const pack = {creator: persona, voices: voices.length, videos: videos.length, pageId, content, timestamp: new Date().toISOString(), agentReady: true}
    const blob = new Blob([JSON.stringify(pack, null, 2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='SochGuru_CreatorPackage.json'; a.click()
  }

  if(!mode) return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6">

        {/* Hero */}
        <section className="pt-24 pb-20">
          <p className="t-label mono mb-5">Hadigaun, Kathmandu</p>
          <h1 className="t-display mb-6">
            Write it once.<br/>
            Publish it in both<br/>
            <span style={{color:'var(--accent)'}}>Nepali and English.</span>
          </h1>
          <h2 className="t-h2 mb-6" style={{color:'var(--ink-3)'}}>
            Ek choti likhe. Duwai bhashama publish garne.
          </h2>
          <p className="t-lead max-w-xl">
            Most tools make you pick a language. This one takes a single description
            of your idea and returns the Nepali post, the English post, and the video
            script for each — in one pass.
          </p>
        </section>

        {/* Who's building this */}
        <section className="hairline py-16">
          <div className="flex items-baseline justify-between gap-6 mb-8">
            <p className="t-label mono">Who's building this</p>
            <p className="t-label mono" style={{color:'var(--ink-3)'}}>Ko banayo yo?</p>
          </div>
          <div className="space-y-5 t-body" style={{color:'var(--ink-2)'}}>
            <p style={{color:'var(--ink)', fontSize:'1.0625rem', lineHeight:1.6}}>
              I spent a decade in banking. Now I'm building with agentic AI from
              Hadigaun, and posting about it as I go.
            </p>
            <p>
              The problem I kept hitting was simple. My audience is split — friends and
              peers here who read Nepali, and a wider tech audience that reads English.
              Writing for one meant the other got a rushed translation, or nothing.
              Doing both properly meant doing every step twice: the script, the tone,
              the recording, the edit.
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

        {/* What it actually does */}
        <section className="hairline py-16">
          <div className="flex items-baseline justify-between gap-6 mb-8">
            <p className="t-label mono">What one prompt returns</p>
            <p className="t-label mono" style={{color:'var(--ink-3)'}}>Ek prompt ko utput</p>
          </div>
          <div className="card divide-y" style={{borderColor:'var(--line)'}}>
            {[
              ['Nepali status', 'Short-form post, Romanized Nepali'],
              ['English status', 'Same idea, written for a global feed'],
              ['Nepali video script', 'Hook, main, call-to-action'],
              ['English video script', 'Hook, main, call-to-action'],
              ['Image prompt', 'For a consistent avatar look'],
              ['Video prompt', '8s vertical, 9:16']
            ].map(([name, desc]) => (
              <div key={name} className="flex items-baseline justify-between gap-6 px-5 py-3.5" style={{borderColor:'var(--line)'}}>
                <span className="text-sm font-medium">{name}</span>
                <span className="t-sm text-right">{desc}</span>
              </div>
            ))}
          </div>
          <p className="t-sm mt-4">
            You review and edit everything before it goes anywhere. Nothing publishes on its own.
          </p>
        </section>

        {/* Two paths */}
        <section className="hairline py-16">
          <p className="t-label mono mb-8">Two ways in</p>
          <div className="grid md:grid-cols-2 gap-4">

            <div className="card p-6 flex flex-col">
              <div className="flex items-center gap-2.5 mb-3">
                <h2 className="t-h2">Basic</h2>
                <span className="pill pill-muted mono">1 KEY</span>
              </div>
              <p className="t-body mb-6 flex-1">
                Describe your idea in a paragraph. Get all six pieces back. Best when
                you want to test an angle before committing to it.
              </p>
              <button onClick={()=>setMode('basic')} className="btn btn-primary w-full">
                Start with a prompt
              </button>
              <p className="t-sm mono mt-3">Needs a Gemini key</p>
            </div>

            <div className="card p-6 flex flex-col opacity-60">
              <div className="flex items-center gap-2.5 mb-3">
                <h2 className="t-h2">Pro</h2>
                <span className="pill pill-muted mono">COMING SOON</span>
              </div>
              <p className="t-body mb-6 flex-1">
                Five steps: persona, your recorded voice, gestures, avatar video, then
                content and publishing. Slower to set up, but the output sounds and
                looks like you.
              </p>
              <button disabled className="btn btn-ghost w-full opacity-50 cursor-not-allowed">
                Set up the full workflow
              </button>
              <p className="t-sm mono mt-3">Gemini · ElevenLabs · HeyGen · Meta</p>
            </div>
          </div>
        </section>

        {/* Honest footer */}
        <section className="hairline py-16">
          <p className="t-label mono mb-6">Worth knowing before you start</p>
          <div className="space-y-4 t-body">
            <p>
              <span style={{color:'var(--ink)'}}>Your API keys stay on the server.</span>{' '}
              They're read from environment variables and never sent to the browser.
              Every call to Gemini, ElevenLabs, HeyGen, and Meta is billed to your own
              account at their rates.
            </p>
            <p>
              <span style={{color:'var(--ink)'}}>This app records what you do in it.</span>{' '}
              Each step logs an event — persona saved, voice cloned, content generated,
              post published — with a timestamp, so the analytics view can show you your
              own activity. It's held in server memory and clears on restart. Nothing is
              sold or sent anywhere else.
            </p>
            <p>
              <span style={{color:'var(--ink)'}}>The Nepali is Romanized, not Devanagari.</span>{' '}
              It reads naturally in a Facebook feed, but check it before posting — AI
              translation of Nepali idiom still gets things wrong.
            </p>
          </div>
        </section>

        <footer className="hairline py-10">
          <p className="t-sm mono">Built in Hadigaun, Kathmandu</p>
        </footer>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen p-4 max-w-6xl mx-auto">
      <header className="flex justify-between items-center gap-4 py-5 mb-8 hairline" style={{borderTop:'none', borderBottom:'1px solid var(--line)'}}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={()=>setMode(null)} className="t-sm hover:opacity-70 transition shrink-0" style={{color:'var(--ink-3)'}}>← Back</button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">
              SochGuru <span style={{color:'var(--ink-3)'}}>/</span> <span style={{color:'var(--accent)'}}>{mode==='basic' ? 'Basic' : 'Pro'}</span>
            </h1>
          </div>
        </div>
        <button
          onClick={()=>{setShowAnalytics(!showAnalytics); if(!showAnalytics) fetchAnalytics()}}
          className="btn btn-ghost shrink-0"
          style={{padding:'0.5rem 0.875rem', fontSize:'0.8125rem'}}
        >
          Activity
        </button>
      </header>

      {mode==='pro' && (
        <div className="grid grid-cols-5 gap-2 mb-6">
          {[1,2,3,4,5].map(n=>(
            <button key={n} onClick={()=>setStep(n)} className={`${step===n?'orange':'glass'} py-2 rounded-full text-xs font-bold`}>
              {n===1?'1 Persona': n===2?'2 Voice': n===3?'3 Video+Gesture': n===4?'4 Avatar': '5 Content & Publish'}
            </button>
          ))}
        </div>
      )}

      {mode==='basic' && (
        <div className="max-w-2xl mx-auto pb-16">
          <h2 className="t-h1 mb-3">What are you posting about?</h2>
          <p className="t-body mb-6">
            A paragraph is enough — who you are, what you're covering, who reads you.
            The more specific, the less generic it comes back.
          </p>

          <textarea
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
            {basicGenerating ? 'Writing your six pieces…' : 'Generate'}
          </button>

          {basicError && <div className="note note-err mt-4">{basicError}</div>}

          {basicResult && (
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
                <div key={label} className="card p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <p className="t-label mono">{label}</p>
                    <button
                      onClick={()=>navigator.clipboard?.writeText(value)}
                      className="t-sm hover:opacity-70 transition shrink-0"
                      style={{color:'var(--ink-3)'}}
                    >Copy</button>
                  </div>
                  <p className="t-body whitespace-pre-wrap" style={{color:'var(--ink)'}}>{value}</p>
                </div>
              ))}

              <button
                onClick={()=>{
                  const blob = new Blob([JSON.stringify(basicResult, null, 2)], {type:'application/json'})
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = 'sochguru-content-pack.json'; a.click()
                  URL.revokeObjectURL(url)
                  trackAnalytics('basic_pack_exported')
                }}
                className="btn btn-ghost w-full"
              >
                Download as JSON
              </button>
            </div>
          )}
        </div>
      )}

      {mode==='pro' && step===1 && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-2">✨ Define Your Creator Persona</h2>
            <p className="text-sm text-gray-400 mb-6">This becomes your unique voice across all content. We'll use this to tailor everything: scripts, tone, avatar, and messaging.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-2">Your Name</label>
                <input
                  value={persona.name}
                  onChange={e=>setPersona({...persona, name:e.target.value})}
                  placeholder="e.g., Akash Rai"
                  className="w-full bg-black border border-gray-700 rounded-lg p-3 text-sm focus:border-orange-500 outline-none transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-2">Your Story (30 seconds to read)</label>
                <textarea
                  value={persona.story}
                  onChange={e=>setPersona({...persona, story:e.target.value})}
                  placeholder="Share your background, journey, and what drives you. Be authentic..."
                  className="w-full bg-black border border-gray-700 rounded-lg p-3 text-sm h-24 focus:border-orange-500 outline-none transition"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-2">Niche / Topic</label>
                  <select
                    value={persona.niche}
                    onChange={e=>setPersona({...persona, niche:e.target.value})}
                    className="w-full bg-black border border-gray-700 rounded-lg p-3 text-sm focus:border-orange-500 outline-none transition"
                  >
                    <option>Agentic AI</option>
                    <option>Mindset</option>
                    <option>Culture Nepal</option>
                    <option>Business</option>
                    <option>Tech</option>
                    <option>Design</option>
                    <option>Marketing</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-2">Your Audience</label>
                  <select
                    value={persona.audience}
                    onChange={e=>setPersona({...persona, audience:e.target.value})}
                    className="w-full bg-black border border-gray-700 rounded-lg p-3 text-sm focus:border-orange-500 outline-none transition"
                  >
                    <option>Both Bilingual (Native+Foreign)</option>
                    <option>Native Nepali</option>
                    <option>Foreign Global</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black rounded-lg p-4 border border-gray-700">
              <p className="text-xs text-gray-400 mb-3">💡 How this is used:</p>
              <ul className="space-y-2 text-xs text-gray-300">
                <li>✓ Voice Clone Agent learns your unique tone & delivery</li>
                <li>✓ Content Agent writes from your perspective</li>
                <li>✓ Avatar Agent creates videos that look like you</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={()=>setMode(null)} className="glass flex-1 py-3 rounded-xl font-bold">← Back to Modes</button>
            <button onClick={savePersona} className="orange flex-1 py-3 rounded-xl font-bold">Continue to Voice →</button>
          </div>
        </div>
      )}

      {mode==='pro' && step===2 && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold flex-1">🎤 Record Your Voice</h2>
              <span className="text-xs bg-orange-900 text-orange-100 px-3 py-1 rounded-full">{voices.length}/3 recorded</span>
            </div>
            <p className="text-sm text-gray-400 mb-6">Record 3 voice samples in different tones. We'll clone your voice for all future videos.</p>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                {type: 'neutral', label: 'Neutral Tone', hint: 'Speak naturally, explain something', example: 'My decade in banking taught me...'},
                {type: 'excited', label: 'Excited Tone', hint: 'Show enthusiasm and energy', example: 'Let\'s learn & grow together!'},
                {type: 'nepali', label: 'Nepali Tone', hint: 'Natural Nepali (Romanized ok)', example: 'Soch yesto cha...'}
              ].map(({type, label, hint, example}) => {
                const recorded = voices.find(v => v.type === type)
                return (
                  <div key={type} className={`rounded-xl p-4 transition ${recording ? 'bg-gray-900' : 'bg-black border border-gray-700 hover:border-orange-500'}`}>
                    <p className="font-bold text-sm mb-1">{label}</p>
                    <p className="text-xs text-gray-500 mb-3">{hint}</p>
                    <p className="text-xs text-cyan-400 italic mb-3 line-clamp-2">"{example}"</p>

                    <button
                      onClick={()=>recordVoice(type)}
                      disabled={recording}
                      className="orange w-full py-2 rounded-lg font-bold text-sm mb-2 disabled:opacity-50 transition hover:opacity-90"
                    >
                      {recording ? '● Recording 5s...' : recorded ? '✓ Re-record' : '● Record 5s'}
                    </button>

                    {recorded && (
                      <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded-lg p-2">
                        <audio src={recorded.url} controls className="w-full h-7 text-xs"/>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {voices.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="bg-black rounded-lg p-4 border border-gray-700">
                  <p className="text-sm font-bold mb-2">📋 Summary</p>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    {['neutral', 'excited', 'nepali'].map(type => {
                      const has = voices.find(v => v.type === type)
                      return <div key={type} className={`p-2 rounded text-center ${has ? 'bg-green-900 text-green-100' : 'bg-gray-800 text-gray-400'}`}>{type.charAt(0).toUpperCase() + type.slice(1)} {has ? '✓' : '○'}</div>
                    })}
                  </div>
                </div>

                <button
                  onClick={cloneVoices}
                  disabled={cloning || voices.length < 3}
                  className="orange w-full py-3 rounded-xl font-bold disabled:opacity-50 transition"
                >
                  {cloning ? '⏳ Cloning your voice...' : '🎤 Clone Voices with ElevenLabs'}
                </button>

                {cloneError && <p className="text-red-400 text-sm p-3 bg-red-900 bg-opacity-20 rounded-lg">{cloneError}</p>}

                {cloneResult && (
                  <div className={`rounded-lg p-4 text-sm ${cloneResult.status==='success' ? 'bg-green-900 bg-opacity-20 border border-green-700 text-green-100' : 'bg-yellow-900 bg-opacity-20 border border-yellow-700 text-yellow-100'}`}>
                    <p className="font-bold mb-2">{cloneResult.status==='success' ? '✓ Voice Cloned Successfully!' : '⚠ Partial Clone'}</p>
                    {cloneResult.results?.map((r, i)=><p key={i} className="text-xs">{r.type}: {r.status} {r.voiceId && `→ Ready`}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={()=>setStep(1)} className="glass flex-1 py-3 rounded-xl font-bold">← Back</button>
            <button onClick={()=>setStep(3)} className="orange flex-1 py-3 rounded-xl font-bold" disabled={voices.length < 3}>Next: Video & Gesture →</button>
          </div>
        </div>
      )}

      {mode==='pro' && step===3 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="font-bold mb-3">Step 3: Video + Gesture Capture {recording && <span className="text-red-400">● Recording</span>}</h2>
          <p className="text-xs text-gray-400 mb-3">
            Pick a gesture, then record 5 seconds of yourself doing it <span className="text-white">while speaking the line below</span> —
            voice, movement, and expression all get captured together in one clip.
          </p>
          <video ref={previewRef} autoPlay muted playsInline className="w-full h-48 bg-black rounded object-cover mb-3"/>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs mb-3">
            {Object.keys(GESTURE_LINES).map(g=>(
              <button
                key={g}
                onClick={()=>setActiveGesture(g)}
                className={`p-2 rounded text-center transition ${activeGesture===g ? 'orange font-bold' : 'bg-black hover:bg-zinc-900'}`}
              >{g}</button>
            ))}
          </div>

          <div className="bg-black rounded p-3 mb-3">
            <p className="text-xs text-gray-400 mb-1">Say this while you {activeGesture.toLowerCase()}:</p>
            <p className="text-sm text-cyan-300">"{GESTURE_LINES[activeGesture]}"</p>
          </div>

          <div className="flex gap-2 mb-3">
            <button onClick={startCam} className="glass px-4 py-2 rounded text-xs">{camReady ? '✓ Camera & Mic On' : 'Start Camera & Mic'}</button>
            <button onClick={recordVideo} disabled={!camReady || recording} className="orange px-4 py-2 rounded text-xs disabled:opacity-50">
              {recording ? 'Recording…' : `● Record ${activeGesture} (5s)`}
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {videos.map((v,i)=>(
              <div key={i} className="text-center">
                <video src={v.url} controls className="w-32 h-20 rounded bg-black"/>
                <p className="text-xs text-gray-400 mt-1">{v.gesture}</p>
              </div>
            ))}
            <span className="text-xs text-gray-400 self-center">{videos.length} clips (video + voice)</span>
          </div>

          <button onClick={()=>setStep(4)} disabled={videos.length===0} className="orange w-full mt-4 py-2 rounded-xl font-bold disabled:opacity-50">Save Video → Avatar</button>
        </div>
      )}

      {mode==='pro' && step===4 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="font-bold mb-3">Step 4: Avatar Builder - Circuit-Brain</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="bg-black rounded p-3">
              <p className="text-xs text-gray-400">Collected:</p>
              <p className="text-xs">Persona: {persona.name || 'SochGuru'} - {persona.niche}</p>
              <p className="text-xs">Voice: {voices.length} samples{cloneResult?.status==='success' && ' ✓ Cloned'}</p>
              <p className="text-xs">Video: {videos.length} gestures</p>
              <p className="text-xs mt-2 text-cyan-400">Avatar Prompt:</p>
              <textarea className="w-full bg-zinc-900 border border-gray-700 rounded p-2 text-xs h-20 mt-1" defaultValue={`Same 3D character, curly hair, navy hoodie with glowing circuit-brain logo CIRCUIT-BRAIN, Pixar style, futuristic office holographic charts, Hadigaun Kathmandu, ${persona.niche}`}/>
            </div>
            <div className="bg-black rounded p-3 space-y-2">
              <p className="text-xs text-gray-400">Avatar Generation:</p>
              <button onClick={generateAvatar} disabled={generatingAvatar || avatarJobId} className="orange w-full py-1 rounded text-xs disabled:opacity-50 font-bold">{avatarJobId ? '🎬 Generating (5s polls)…' : generatingAvatar ? 'Starting…' : '🎬 Generate with HeyGen'}</button>
              {avatarError && <p className="text-red-400 text-xs">{avatarError}</p>}
              {avatarResult?.videoUrl && (
                <div className="bg-green-900 rounded p-2 text-xs text-green-100">
                  <p className="font-bold">✓ Avatar Ready!</p>
                  <video src={avatarResult.videoUrl} controls className="w-full mt-1 rounded"/>
                </div>
              )}
            </div>
          </div>
          <button onClick={()=>setStep(5)} className="orange w-full mt-4 py-2 rounded-xl font-bold">Build Content Page →</button>
        </div>
      )}

      {mode==='pro' && step===5 && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-5">
            <h2 className="font-bold mb-3">Step 5: Content Management Tool</h2>
            <input value={pageId} onChange={e=>setPageId(e.target.value)} placeholder="Page ID 61590521291901" className="w-full bg-black border border-gray-700 rounded p-2 mb-2 text-sm"/>
            <button onClick={generateContent} disabled={generating} className="orange w-full py-2 rounded-xl font-bold disabled:opacity-50">{generating ? 'Generating…' : 'Generate Bilingual Pack'}</button>
            {genError && <p className="text-red-400 text-xs mt-2">{genError}</p>}
            {content && (
              <div className="mt-3 space-y-2 text-xs">
                <p className={content.source==='gemini' ? 'text-green-400' : 'text-yellow-400'}>
                  {content.source==='gemini' ? '✨ Generated by Gemini' : '⚠ Template fallback (set GEMINI_API_KEY to use Gemini)'}
                </p>
                <div className="bg-black rounded p-2"><p className="text-orange-400">Nepali Status (Native):</p><p>{content.nepaliStatus}</p></div>
                <div className="bg-black rounded p-2"><p className="text-cyan-400">English Video Script (Global 30s):</p><p className="whitespace-pre-wrap">{content.englishVideo}</p></div>
                <div className="bg-black rounded p-2"><p className="text-orange-400">English Status (Global):</p><p>{content.englishStatus}</p></div>
                <div className="bg-black rounded p-2"><p className="text-cyan-400">Nepali Video Script:</p><p className="whitespace-pre-wrap">{content.nepaliVideo}</p></div>
                <div className="bg-black rounded p-2"><p>Image Prompt: {content.imagePrompt}</p><p className="mt-1">Veo Prompt: {content.veoPrompt}</p></div>
                <button onClick={publishToMeta} disabled={publishing} className="orange w-full py-2 rounded-xl font-bold text-xs disabled:opacity-50 mt-2">{publishing ? 'Publishing…' : 'Publish to Meta/Facebook →'}</button>
                {pubError && <p className="text-red-400 text-xs">{pubError}</p>}
                {pubResult && (
                  <div className={`rounded p-2 text-xs ${pubResult.status==='success' ? 'bg-green-900 text-green-100' : 'bg-yellow-900 text-yellow-100'}`}>
                    <p className="font-bold">{pubResult.status==='success' ? '✓ Published!' : '⚠ Partial publish'}</p>
                    {pubResult.results?.map((r, i)=><p key={i}>{r.type}: {r.status} {r.id && `(ID: ${r.id})`} {r.error && `— ${r.error}`}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="glass rounded-2xl p-5">
            <h3 className="font-bold mb-2 text-xs">Deploy Whole Package to Vercel</h3>
            <div className="bg-black rounded p-3 text-xs space-y-1">
              <p>1. Push this folder to GitHub</p>
              <p>2. vercel.com → New Project → Import GitHub</p>
              <p>3. Env Vars: GEMINI_API_KEY, NEXT_PUBLIC_META_TOKEN</p>
              <p>4. Deploy → Live CMS</p>
              <p className="text-cyan-400 mt-2">Agent-Ready: Each step emits event</p>
              <p>CreatorCreated → VoiceCloned → AvatarReady → ContentGenerated → Published</p>
            </div>
            <button onClick={exportPackage} className="glass w-full mt-3 py-2 rounded-xl text-xs">Export Creator Package JSON</button>
            <a href="https://vercel.com/new" target="_blank" className="orange block text-center w-full mt-2 py-2 rounded-xl font-bold text-xs">Deploy to Vercel Now →</a>
          </div>
        </div>
      )}

      {showAnalytics && mode && (
        <div className="glass rounded-2xl p-5 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold">📊 Analytics Dashboard</h2>
            <button onClick={()=>setShowAnalytics(false)} className="text-gray-400 text-xs">✕ Close</button>
          </div>
          {!analytics ? (
            <p className="text-xs text-gray-400">Loading analytics...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-black rounded p-3"><p className="text-xs text-gray-400">Total Events</p><p className="text-xl font-bold text-orange-400">{analytics.summary.totalEvents}</p></div>
                <div className="bg-black rounded p-3"><p className="text-xs text-gray-400">Success Rate</p><p className="text-xl font-bold text-green-400">{analytics.summary.successRate}%</p></div>
                <div className="bg-black rounded p-3"><p className="text-xs text-gray-400">Creators</p><p className="text-xl font-bold">{analytics.summary.creators}</p></div>
                <div className="bg-black rounded p-3"><p className="text-xs text-gray-400">Published</p><p className="text-xl font-bold text-cyan-400">{analytics.summary.published}</p></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <div className="bg-black rounded p-2"><p className="text-gray-400">Voice Clones</p><p className="text-lg font-bold">{analytics.summary.voiceClones}</p></div>
                <div className="bg-black rounded p-2"><p className="text-gray-400">Avatars</p><p className="text-lg font-bold">{analytics.summary.avatarsGenerated}</p></div>
                <div className="bg-black rounded p-2"><p className="text-gray-400">Content</p><p className="text-lg font-bold">{analytics.summary.contentGenerated}</p></div>
                <div className="bg-black rounded p-2"><p className="text-gray-400">Errors</p><p className="text-lg font-bold text-red-400">{analytics.summary.errors}</p></div>
                <div className="bg-black rounded p-2"><p className="text-gray-400">Avg Gen Time</p><p className="text-lg font-bold">{analytics.avgGenerationTime}ms</p></div>
              </div>
              {analytics.recentEvents.length > 0 && (
                <div className="bg-black rounded p-3">
                  <p className="text-xs font-bold mb-2">Recent Events</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
                    {analytics.recentEvents.map((e, i)=>(
                      <div key={i} className={`p-1 rounded flex justify-between ${e.status==='error' ? 'bg-red-900' : e.status==='success' ? 'bg-green-900' : 'bg-gray-800'}`}>
                        <span>{e.type}</span>
                        <span className="text-gray-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={async ()=>{await fetch('/api/analytics?action=clear'); setAnalytics(null)}} className="glass w-full py-1 rounded text-xs">Clear Analytics</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
