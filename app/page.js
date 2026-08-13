'use client'
import { useState, useEffect, useRef } from 'react'

export default function Page() {
  const [step, setStep] = useState(1)
  const [persona, setPersona] = useState({name:'', story:'My decade in banking. Shifting to Agentic AI and culture in Nepal. I don\'t have all the answers. Just sharing as I navigate it all. Let\'s learn and grow together.', niche:'Agentic AI', audience:'Both Bilingual'})
  const [voices, setVoices] = useState([])
  const [videos, setVideos] = useState([])
  const [pageId, setPageId] = useState('61590521291901')
  const [content, setContent] = useState(null)
  const previewRef = useRef(null)
  const [recording, setRecording] = useState(false)

  useEffect(()=>{
    const saved = localStorage.getItem('soch_cms_persona')
    if(saved) setPersona(JSON.parse(saved))
  },[])

  const savePersona = ()=>{
    localStorage.setItem('soch_cms_persona', JSON.stringify(persona))
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

  const generateContent = ()=>{
    const bilingual = {
      nepaliStatus: `Soch yesto cha: ${persona.story.substring(0,80)}... Hadigaun ma SochGuru banauda bujheko - Discipline > Motivation. Tapai ko 1 win ke thiyo? #SochGuru #NepaliSoch`,
      englishVideo: `[HOOK 0-3s] My decade in banking taught me this...\n[MAIN 3-20s] ${persona.story} I'm building from Hadigaun, Kathmandu. Focus is a muscle, not talent.\n[CTA] What's your non-negotiable?`,
      englishStatus: `Building in Public Day from Hadigaun, Kathmandu. Today I learned ${persona.niche} can save 3 hours. AI amplifies your story. What's one task you want to automate? #SochGuru #BuildingInPublic`,
      nepaliVideo: `[HOOK] Soch yesto cha: ${persona.niche} le 3 ghanta bachayo...\n[MAIN] Hadigaun bata SochGuru banairako chu...\n[CTA] Tapai kun kaam automate garna chahanuhunchha?`,
      imagePrompt: `Same 3D character, curly hair, navy hoodie with glowing circuit-brain logo CIRCUIT-BRAIN, Pixar style, futuristic office holographic charts, Hadigaun Kathmandu vibe, ${persona.niche}`,
      veoPrompt: `8s cinematic video, same SochGuru avatar speaking ${persona.audience.includes('Both')?'English and Nepali':'English'}, Hadigaun cafe, Newari architecture, holographic charts, 9:16 vertical, high detail`
    }
    setContent(bilingual)
    localStorage.setItem('soch_last_content', JSON.stringify(bilingual))
  }

  const exportPackage = ()=>{
    const pack = {creator: persona, voices: voices.length, videos: videos.length, pageId, content, timestamp: new Date().toISOString(), agentReady: true}
    const blob = new Blob([JSON.stringify(pack, null, 2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='SochGuru_CreatorPackage.json'; a.click()
  }

  return (
    <div className="min-h-screen p-4 max-w-6xl mx-auto">
      <header className="glass rounded-2xl p-4 flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">SochGuru Creator CMS <span className="text-orange-500">Vercel Ready</span></h1>
          <p className="text-xs text-gray-400">Content Management Tool for Creators • Voice • Video • Gesture • Persona • Avatar • Bilingual • Meta Data • Agent Ready</p>
        </div>
        <a href="https://vercel.com/new" target="_blank" className="orange px-4 py-2 rounded-full text-xs font-bold">Deploy to Vercel</a>
      </header>

      <div className="grid grid-cols-5 gap-2 mb-6">
        {[1,2,3,4,5].map(n=>(
          <button key={n} onClick={()=>setStep(n)} className={`${step===n?'orange':'glass'} py-2 rounded-full text-xs font-bold`}>
            {n===1?'1 Persona': n===2?'2 Voice': n===3?'3 Video+Gesture': n===4?'4 Avatar': '5 Content & Publish'}
          </button>
        ))}
      </div>

      {step===1 && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-5">
            <h2 className="font-bold mb-3">Step 1: Persona Builder</h2>
            <input value={persona.name} onChange={e=>setPersona({...persona, name:e.target.value})} placeholder="Creator Name" className="w-full bg-black border border-gray-700 rounded p-2 mb-2 text-sm"/>
            <textarea value={persona.story} onChange={e=>setPersona({...persona, story:e.target.value})} className="w-full bg-black border border-gray-700 rounded p-2 mb-2 text-sm h-28" placeholder="My decade in banking..."/>
            <div className="grid grid-cols-2 gap-2">
              <select value={persona.niche} onChange={e=>setPersona({...persona, niche:e.target.value})} className="bg-black border border-gray-700 rounded p-2 text-sm"><option>Agentic AI</option><option>Mindset</option><option>Culture Nepal</option><option>Business</option><option>Tech</option></select>
              <select value={persona.audience} onChange={e=>setPersona({...persona, audience:e.target.value})} className="bg-black border border-gray-700 rounded p-2 text-sm"><option>Both Bilingual (Native+Foreign)</option><option>Native Nepali</option><option>Foreign Global</option></select>
            </div>
            <button onClick={savePersona} className="orange w-full mt-4 py-2 rounded-xl font-bold">Save Persona →</button>
          </div>
          <div className="glass rounded-2xl p-5">
            <h3 className="text-xs text-gray-400 mb-2">Meta Data + Agent Ready</h3>
            <p className="text-xs mb-2">Persona becomes knowledge graph for future agents. This is Layer 2 of your agent architecture.</p>
            <div className="bg-black rounded p-3 text-xs">
              <p>• Voice Clone Agent will use this persona for tone</p>
              <p>• Bilingual Copywriter Agent uses niche + audience</p>
              <p>• Avatar Agent uses story for scenes</p>
            </div>
          </div>
        </div>
      )}

      {step===2 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="font-bold mb-3">Step 2: Voice Collection for Cloning {recording && <span className="text-red-400">● Recording 5s</span>}</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-black rounded p-3"><p className="text-xs text-cyan-400">Neutral: My decade in banking...</p><button onClick={()=>recordVoice('neutral')} className="orange w-full mt-2 py-1 rounded text-xs">● Record 5s</button></div>
            <div className="bg-black rounded p-3"><p className="text-xs text-cyan-400">Excited: Let's learn & grow together!</p><button onClick={()=>recordVoice('excited')} className="orange w-full mt-2 py-1 rounded text-xs">● Record 5s</button></div>
            <div className="bg-black rounded p-3"><p className="text-xs text-cyan-400">Nepali: Soch yesto cha...</p><button onClick={()=>recordVoice('nepali')} className="orange w-full mt-2 py-1 rounded text-xs">● Record 5s</button></div>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">{voices.map((v,i)=><audio key={i} src={v.url} controls className="w-48 h-8"/>)}<span className="text-xs text-gray-400">{voices.length} voice samples</span></div>
          <button onClick={()=>setStep(3)} className="orange w-full mt-4 py-2 rounded-xl font-bold">Save Voice → Video</button>
        </div>
      )}

      {step===3 && (
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

      {step===4 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="font-bold mb-3">Step 4: Avatar Builder - Circuit-Brain</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-black rounded p-3">
              <p className="text-xs text-gray-400">Collected:</p>
              <p className="text-xs">Persona: {persona.name || 'SochGuru'} - {persona.niche}</p>
              <p className="text-xs">Voice: {voices.length} samples</p>
              <p className="text-xs">Video: {videos.length} gestures</p>
              <p className="text-xs mt-2 text-cyan-400">Avatar Prompt for Meta AI / Gemini Imagen:</p>
              <textarea className="w-full bg-zinc-900 border border-gray-700 rounded p-2 text-xs h-20 mt-1" defaultValue={`Same 3D character, curly hair, navy hoodie with glowing circuit-brain logo CIRCUIT-BRAIN, Pixar style, futuristic office holographic charts, Hadigaun Kathmandu, ${persona.niche}`}/>
            </div>
            <div className="bg-black rounded p-3">
              <p className="text-xs text-gray-400">Meta Native Options:</p>
              <p className="text-xs">• Facebook Avatar: Create in FB App &gt; Avatars</p>
              <p className="text-xs">• AI Studio: Upload avatar frame to ai.meta.com</p>
              <p className="text-xs">• Avatar Stickers: Auto gesture stickers</p>
            </div>
          </div>
          <button onClick={()=>setStep(5)} className="orange w-full mt-4 py-2 rounded-xl font-bold">Build Content Page →</button>
        </div>
      )}

      {step===5 && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-5">
            <h2 className="font-bold mb-3">Step 5: Content Management Tool</h2>
            <input value={pageId} onChange={e=>setPageId(e.target.value)} placeholder="Page ID 61590521291901" className="w-full bg-black border border-gray-700 rounded p-2 mb-2 text-sm"/>
            <button onClick={generateContent} className="orange w-full py-2 rounded-xl font-bold">Generate Bilingual Pack</button>
            {content && (
              <div className="mt-3 space-y-2 text-xs">
                <div className="bg-black rounded p-2"><p className="text-orange-400">Nepali Status (Native):</p><p>{content.nepaliStatus}</p></div>
                <div className="bg-black rounded p-2"><p className="text-cyan-400">English Video Script (Global 30s):</p><p className="whitespace-pre-wrap">{content.englishVideo}</p></div>
                <div className="bg-black rounded p-2"><p className="text-orange-400">English Status (Global):</p><p>{content.englishStatus}</p></div>
                <div className="bg-black rounded p-2"><p className="text-cyan-400">Nepali Video Script:</p><p className="whitespace-pre-wrap">{content.nepaliVideo}</p></div>
                <div className="bg-black rounded p-2"><p>Image Prompt: {content.imagePrompt}</p><p className="mt-1">Veo Prompt: {content.veoPrompt}</p></div>
              </div>
            )}
          </div>
          <div className="glass rounded-2xl p-5">
            <h3 className="font-bold mb-2 text-xs">Deploy Whole Package to Vercel</h3>
            <div className="bg-black rounded p-3 text-xs space-y-1">
              <p>1. Push this folder to GitHub</p>
              <p>2. vercel.com → New Project → Import GitHub</p>
              <p>3. Env Vars: NEXT_PUBLIC_GEMINI_KEY, NEXT_PUBLIC_META_TOKEN</p>
              <p>4. Deploy → Live CMS</p>
              <p className="text-cyan-400 mt-2">Agent-Ready: Each step emits event</p>
              <p>CreatorCreated → VoiceCloned → AvatarReady → ContentGenerated → Published</p>
            </div>
            <button onClick={exportPackage} className="glass w-full mt-3 py-2 rounded-xl text-xs">Export Creator Package JSON</button>
            <a href="https://vercel.com/new" target="_blank" className="orange block text-center w-full mt-2 py-2 rounded-xl font-bold text-xs">Deploy to Vercel Now →</a>
          </div>
        </div>
      )}
    </div>
  )
}
