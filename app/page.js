'use client'
import { useState, useEffect, useRef } from 'react'

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
      const rec = new MediaRecorder(stream)
      let chunks=[]
      rec.ondataavailable = e=>chunks.push(e.data)
      rec.onstop = ()=>{
        const blob = new Blob(chunks, {type:'video/webm'})
        const url = URL.createObjectURL(blob)
        setVideos(v=>[...v, {url, blob, gesture:'custom'}])
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
      if(!res.ok) throw new Error('Server returned '+res.status)
      const data = await res.json()
      setBasicResult(data)
      trackAnalytics('basic_pack_generated', {source: data.source})
    }catch(err){
      setBasicError('Generation failed: '+err.message)
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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center py-12">
          <p className="text-orange-400 text-sm font-bold mb-2">🇳🇵 BUILT IN KATHMANDU • FOR CREATORS WORLDWIDE</p>
          <h1 className="text-5xl font-bold mb-4">SochGuru</h1>
          <p className="text-xl text-gray-300 mb-2">Turn Your Ideas Into Bilingual Content in Minutes</p>
          <p className="text-gray-400 max-w-2xl mx-auto">AI-powered content creation for creators who want to reach both their native culture AND the global audience. No more choosing between English or Nepali. Go bilingual. Go viral. Go big.</p>
        </div>

        {/* The Problem & Solution */}
        <div className="grid md:grid-cols-3 gap-6 my-16">
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-3xl mb-3">⏱️</p>
            <h3 className="font-bold mb-2">The Time Drain</h3>
            <p className="text-sm text-gray-400">Creating content for 2 languages takes 2x the time. Persona building, voice work, video editing... it's endless.</p>
          </div>
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-3xl mb-3">🎯</p>
            <h3 className="font-bold mb-2">Split Audience</h3>
            <p className="text-sm text-gray-400">Choose English for global reach OR Nepali for home. Why choose? Nepal's best creators go global AND stay rooted.</p>
          </div>
          <div className="glass rounded-2xl p-6 text-center border-2 border-orange-500">
            <p className="text-3xl mb-3">✨</p>
            <h3 className="font-bold mb-2 text-orange-400">The SochGuru Way</h3>
            <p className="text-sm text-gray-300"><strong>One prompt.</strong> Bilingual scripts. Avatar videos. Ready to post. 2 minutes.</p>
          </div>
        </div>

        {/* Who This Is For */}
        <div className="glass rounded-2xl p-8 mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">This is for creators who:</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div><p className="text-orange-400">✓</p> Have something important to say but not enough time to make content</div>
            <div><p className="text-orange-400">✓</p> Want to reach both Nepal AND the world</div>
            <div><p className="text-orange-400">✓</p> Are tired of fragmented workflows (recording voice, making avatars, writing scripts separately)</div>
            <div><p className="text-orange-400">✓</p> Want their authentic voice (literally & figuratively) in every video</div>
            <div><p className="text-orange-400">✓</p> Are building in public and need to move fast</div>
            <div><p className="text-orange-400">✓</p> Believe Nepal's stories deserve a global platform</div>
          </div>
        </div>

        {/* Real Use Case */}
        <div className="glass rounded-2xl p-8 mb-16 border border-cyan-500">
          <h3 className="font-bold mb-4">Real Example: Akash's Week</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-gray-400 text-sm mb-4"><strong className="text-red-400">❌ Without SochGuru:</strong></p>
              <ul className="text-sm space-y-2 text-gray-300">
                <li>Monday: Write English script (30 min)</li>
                <li>Tuesday: Translate to Nepali (45 min)</li>
                <li>Wednesday: Record voice samples (60 min)</li>
                <li>Thursday: Wait for voice cloning (2 hours)</li>
                <li>Friday: Generate avatars (3 hours)</li>
                <li>Saturday: Edit & post both versions (2 hours)</li>
                <li><strong>Total: 10+ hours</strong></li>
              </ul>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-4"><strong className="text-green-400">✅ With SochGuru:</strong></p>
              <ul className="text-sm space-y-2 text-gray-300">
                <li>Monday 9:00 AM: Write one prompt</li>
                <li>Monday 9:02 AM: Get bilingual scripts ready</li>
                <li>Monday 9:05 AM: Post both versions</li>
                <li>Monday 5:00 PM: Set up voice cloning (once)</li>
                <li>Tuesday: Generate avatars on demand</li>
                <li><strong className="text-green-400">Ongoing: 5 min per piece</strong></li>
                <li className="text-green-400"><strong>Save 50+ hours/month</strong></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Choose Your Path */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Choose Your Path to Growth</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Basic */}
            <div className="glass rounded-2xl p-8 hover:border-orange-500 transition border border-gray-700">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold mb-1">🚀 Basic</h3>
                  <p className="text-gray-400">For quick wins & testing</p>
                </div>
                <span className="text-xs bg-orange-900 text-orange-100 px-3 py-1 rounded-full">Start Free</span>
              </div>
              <p className="text-sm text-gray-300 mb-6">Describe your idea once. AI generates everything: persona, bilingual scripts, avatar prompts, ready-to-post content.</p>
              <ul className="space-y-2 text-sm mb-8">
                <li className="text-gray-300">✓ 1 prompt → full content pack</li>
                <li className="text-gray-300">✓ Bilingual (English + Nepali)</li>
                <li className="text-gray-300">✓ 2 minutes from idea to publish</li>
                <li className="text-gray-300">✓ Great for: testing niches, rapid experimentation</li>
                <li className="text-gray-400">✗ No voice cloning</li>
                <li className="text-gray-400">✗ No avatar generation</li>
              </ul>
              <button onClick={()=>setMode('basic')} className="orange w-full py-3 rounded-xl font-bold">Start Creating Now →</button>
              <p className="text-xs text-gray-500 text-center mt-3">Needs: Gemini API key (free tier available)</p>
            </div>

            {/* Pro */}
            <div className="glass rounded-2xl p-8 hover:border-cyan-500 transition border border-cyan-500">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold mb-1">⚡ Pro</h3>
                  <p className="text-cyan-400">For serious creators</p>
                </div>
                <span className="text-xs bg-cyan-900 text-cyan-100 px-3 py-1 rounded-full">Full Suite</span>
              </div>
              <p className="text-sm text-gray-300 mb-6">Complete control over every step. Clone your voice, generate avatars, publish directly. Build your personal brand authentically.</p>
              <ul className="space-y-2 text-sm mb-8">
                <li className="text-gray-300">✓ 5-step workflow (persona → voice → avatar → content → publish)</li>
                <li className="text-gray-300">✓ Clone your voice (ElevenLabs)</li>
                <li className="text-gray-300">✓ Generate avatars (HeyGen)</li>
                <li className="text-gray-300">✓ Publish to Facebook instantly</li>
                <li className="text-gray-300">✓ Full analytics & tracking</li>
                <li className="text-gray-300">✓ Great for: building personal brand, long-term growth</li>
              </ul>
              <button onClick={()=>setMode('pro')} className="cyan w-full py-3 rounded-xl font-bold">Build Your Brand →</button>
              <p className="text-xs text-gray-500 text-center mt-3">Needs: Gemini + ElevenLabs + HeyGen + Meta tokens</p>
            </div>
          </div>
        </div>

        {/* Trust Builders */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-400">100%</p>
            <p className="text-sm text-gray-400">Open source. No lock-in. Built with you, not for you.</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-cyan-400">Bilingual</p>
            <p className="text-sm text-gray-400">Every piece of content reaches both Nepal & the world.</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">50+ hrs</p>
            <p className="text-sm text-gray-400">Saved per month. More time creating, less time tooling.</p>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="text-center py-8 border-t border-gray-700">
          <p className="text-gray-400 text-sm mb-4">Built by creators, for creators. Built in Hadigaun, Kathmandu. For the world.</p>
          <p className="text-xs text-gray-500">Your data stays yours. No tracking. No BS.</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen p-4 max-w-6xl mx-auto">
      <header className="glass rounded-2xl p-4 flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setMode(null)} className="text-gray-400 hover:text-white text-xs">← Back</button>
            <h1 className="text-xl font-bold">SochGuru Creator CMS <span className={mode==='basic' ? 'text-orange-500' : 'text-cyan-500'}>{mode==='basic' ? 'Basic' : 'Pro'}</span></h1>
          </div>
          <p className="text-xs text-gray-400">{mode==='basic' ? 'AI-powered content creation' : 'Content Management Tool for Creators'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>{setShowAnalytics(!showAnalytics); if(!showAnalytics) fetchAnalytics()}} className="cyan px-4 py-2 rounded-full text-xs font-bold">📊 Analytics</button>
          <a href="https://vercel.com/new" target="_blank" className="orange px-4 py-2 rounded-full text-xs font-bold">Deploy</a>
        </div>
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
        <div className="glass rounded-2xl p-6 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-2">🎯 What's your idea?</h2>
          <p className="text-sm text-gray-400 mb-4">Describe your content idea, topic, or niche. We'll generate everything: persona, script, avatar prompt, and more.</p>
          <textarea
            value={basicPrompt}
            onChange={e=>setBasicPrompt(e.target.value)}
            placeholder="E.g., I'm a data analyst explaining machine learning to beginners. I've worked in tech for 8 years and now I'm building in public in Kathmandu. My audience is both technical and non-technical, English and Nepali speakers."
            className="w-full bg-black border border-gray-700 rounded-xl p-4 mb-4 text-sm h-32"
          />
          <button onClick={generateBasicPack} disabled={basicGenerating || !basicPrompt.trim()} className="orange w-full py-3 rounded-xl font-bold disabled:opacity-50">
            {basicGenerating ? '⏳ Generating your content pack...' : '✨ Generate Content Pack'}
          </button>
          {basicError && <p className="text-red-400 text-sm mt-3">{basicError}</p>}
          {basicResult && (
            <div className="mt-6 space-y-4">
              <p className={`text-sm font-bold ${basicResult.source==='gemini' ? 'text-green-400' : 'text-yellow-400'}`}>
                {basicResult.source==='gemini' ? '✨ Generated by Gemini' : '⚠ Template version'}
              </p>
              <div className="bg-black rounded-xl p-4 space-y-3 text-xs">
                <div>
                  <p className="text-orange-400 font-bold mb-1">Persona:</p>
                  <p className="text-gray-300">{basicResult.persona?.name || 'Creator'} • {basicResult.persona?.niche || 'Topic'}</p>
                  <p className="text-gray-400 text-xs mt-1">{basicResult.persona?.story}</p>
                </div>
                <div className="border-t border-gray-700 pt-3">
                  <p className="text-cyan-400 font-bold mb-1">Content Scripts:</p>
                  <p className="text-gray-300"><span className="text-orange-400">English:</span> {basicResult.englishStatus}</p>
                  <p className="text-gray-300 mt-2"><span className="text-orange-400">Nepali:</span> {basicResult.nepaliStatus}</p>
                </div>
                <div className="border-t border-gray-700 pt-3">
                  <p className="text-cyan-400 font-bold mb-1">Avatar Prompt:</p>
                  <p className="text-gray-300">{basicResult.imagePrompt}</p>
                </div>
              </div>
              <button onClick={()=>trackAnalytics('basic_pack_exported') || (
                (blob)=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='content-pack.json';a.click()}
              )(new Blob([JSON.stringify(basicResult, null, 2)], {type:'application/json'}))} className="glass w-full py-2 rounded-xl text-xs">
                📥 Export Package
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
          <video ref={previewRef} autoPlay muted playsInline className="w-full h-48 bg-black rounded object-cover mb-3"/>
          <div className="flex gap-2 mb-3"><button onClick={startCam} className="glass px-4 py-2 rounded text-xs">Start Camera</button><button onClick={recordVideo} className="orange px-4 py-2 rounded text-xs">● Record 5s Gesture</button></div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs mb-3">
            {['Smile','Pointing','Thinking','Thumbs Up','Explaining','Walking'].map(g=><div key={g} className="bg-black p-2 rounded text-center">{g}</div>)}
          </div>
          <div className="flex gap-2 flex-wrap">{videos.map((v,i)=><video key={i} src={v.url} controls className="w-32 h-20 rounded bg-black"/>)}<span className="text-xs text-gray-400">{videos.length} videos</span></div>
          <button onClick={()=>setStep(4)} className="orange w-full mt-4 py-2 rounded-xl font-bold">Save Video → Avatar</button>
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
