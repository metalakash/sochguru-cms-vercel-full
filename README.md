# SochGuru Creator CMS - Content Management Tool for Content Creators
## Whole Package - Vercel Ready

This is the FULL package - Content Management Tool for Creators that collects Voice, Video, Gesture, Persona to build and run content pages. Bilingual Native+Foreign, Avatar-ready, Agent-ready.

### Features Included
1. **Persona Builder** - Circuit-Brain style: Decade in banking to Agentic AI
2. **Voice Collection** - For cloning (3 samples: neutral, excited, Nepali)
3. **Video + Gesture Capture** - 6 gestures: Smile, Pointing, Thinking, Thumbs Up, Explaining, Walking
4. **Avatar Builder** - Consistent avatar prompt for Gemini Imagen / Meta AI / HeyGen
5. **Content Management** - Bilingual: Nepali Status + English Video, English Status + Nepali Video
6. **Meta Integration** - Page ID 61590521291901, ready for Graph API
7. **Agent-Ready Architecture** - Events: CreatorCreated, VoiceCloned, AvatarReady, ContentGenerated, Published

### How to Start - Local

```bash
# 1. Clone / unzip
cd sochguru-cms-vercel
npm install

# 2. Run dev
npm run dev
# Open http://localhost:3000

# 3. Use
- Step 1: Fill persona
- Step 2: Record voice (allow mic)
- Step 3: Start camera, record gesture videos
- Step 4: Review avatar
- Step 5: Generate bilingual content pack, export JSON
```

### Deploy Whole Package to Vercel - Fastest Way

**Option A: One-Click Deploy**
1. Push this folder to GitHub:
```bash
git init
git add .
git commit -m "SochGuru Creator CMS - Full Package"
git remote add origin https://github.com/YOUR_USERNAME/sochguru-cms.git
git push -u origin main
```
2. Go to https://vercel.com/new
3. Import GitHub repo `sochguru-cms`
4. Framework Preset: Next.js
5. Environment Variables (Project Settings → Environment Variables, not `.env` in the repo):
   
   - **`GEMINI_API_KEY`** = API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
     - Powers `/api/generate-content` for bilingual content writing
     - Without it: falls back to template
   
   - **`ELEVENLABS_API_KEY`** = API key from [elevenlabs.io](https://elevenlabs.io)
     - Sign up → Account → API Keys → copy your key
     - Free tier includes 10,000 characters/month
     - Powers `/api/clone-voice` for voice cloning (Step 2)
   
   - **`META_ACCESS_TOKEN`** = long-lived Facebook Page token
     - Easiest: Page → Settings → Roles → "Generate Token" under Page Access Tokens
     - These expire in 60 days; for permanent: use Graph API to extend user token to page token
     - Powers `/api/publish` to post to Facebook
   
   - **`HEYGEN_API_KEY`** = API key from [heygen.com/api](https://www.heygen.com/api)
     - Requires paid API plan (paid tiers available)
     - Powers `/api/generate-avatar` to create 9:16 vertical videos (Step 4)
     - Videos generated asynchronously; polls every 5s until complete
   
   - **`GEMINI_MODEL`** = optional, defaults to `gemini-2.5-flash`
6. Deploy → You get URL: https://sochguru-cms.vercel.app
7. Open on phone → Add to Home Screen → You have native app

**Option B: Vercel CLI**
```bash
npm i -g vercel
vercel
# Follow prompts, deploy
```

### Real API Integration

**Content Generation (`/api/generate-content`)**
- Calls Gemini API with structured JSON schema (if `GEMINI_API_KEY` is set)
- Falls back to local template if key is missing or call fails
- Persona-aware: uses name, story, niche, audience to write bilingual content

**Voice Cloning (`/api/clone-voice`)**
- Uploads voice samples to ElevenLabs for voice cloning
- Creates a reusable voice profile (voice ID) from 3+ seconds of audio
- Records Neutral, Excited, and Nepali tone variants
- Requires `ELEVENLABS_API_KEY` (free tier available at elevenlabs.io)

**Avatar Generation (`/api/generate-avatar`)**
- Generates 9:16 vertical video with HeyGen avatar speaking the content script
- Uses cloned voice if available, otherwise uses HeyGen default
- Async job with polling (checks status every 5 seconds)
- Returns video URL when generation completes
- Requires `HEYGEN_API_KEY` (paid API plan)

**Publishing (`/api/publish`)**
- Posts bilingual statuses (Nepali + English) to Meta/Facebook page
- Requires `META_ACCESS_TOKEN` (long-lived page/Instagram token)
- Shows publish status inline (success, partial, or error details)

**Analytics (`/api/analytics`)**
- Tracks all creator actions: persona creation, voice cloning, avatar generation, content generation, publishing
- Calculates success rates, event counts, and performance metrics
- Dashboard accessible via "📊 Analytics" button in header
- In-memory store (reset on server restart; for production, integrate with database)

### Event Flow & Analytics

Full creator pipeline with automatic event tracking:
```
CreatorCreated → VoiceCloned → AvatarReady → ContentGenerated → Published
                                                                      ↓
                                                            Analytics Dashboard
```

All events are tracked in real-time and accessible via the "📊 Analytics" button in the header. Success rates, error counts, and performance metrics are displayed with recent event logs.

### What You Get After Deploy
- Live CMS at your Vercel URL
- Creators can onboard: Voice, Video, Gesture, Persona
- You get CreatorPackage.json with all data
- Generate 30 days bilingual content in 10 mins
- Publish to Facebook Pages via Meta Graph API
- Bilingual strategy: Native + Foreign both

### Tech Stack
- Next.js 14 (App Router) - Vercel native
- Tailwind CSS
- MediaRecorder API for voice/video
- localStorage for agent-ready data
- No backend needed for MVP, add FastAPI later

### Next Steps
1. Deploy to Vercel (10 mins)
2. Test with your own SochGuru avatar video data
3. Add real API keys for Gemini, ElevenLabs, HeyGen in .env
4. Plug agents one by one

Built in Hadigaun, Kathmandu - For Creators in Nepal and Global
