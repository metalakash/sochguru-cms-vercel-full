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
   - `GEMINI_API_KEY` = your Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (server-only — powers `/api/generate-content`; without it, content generation falls back to a local template)
   - `GEMINI_MODEL` = optional, defaults to `gemini-2.5-flash`
   - `META_ACCESS_TOKEN` = a long-lived Facebook Page access token (server-only — powers `/api/publish`). Get one via:
     - Go to [developers.facebook.com](https://developers.facebook.com) → Your App → Settings → Basic, grab your App ID & Secret
     - Use Graph API Explorer or Postman to POST to `/oauth/access_token` with your credentials to get a user token, then extend it to a page token
     - Or: go to your Page → Settings → Roles → click "Generate Token" under Page Access Tokens (simpler, but tokens expire in 60 days)
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

**Publishing (`/api/publish`)**
- Posts bilingual statuses (Nepali + English) to Meta/Facebook page
- Requires `META_ACCESS_TOKEN` (long-lived page/Instagram token)
- Shows publish status inline (success, partial, or error details)

### Remaining Agent-Ready Architecture (Future)
These routes are stubbed and ready for agent integration:
- `/api/clone-voice` -> Voice Clone Agent (ElevenLabs)
- `/api/generate-avatar` -> Avatar Video Agent (HeyGen, Veo)
- `/api/analytics` -> Analytics Agent

When you plug agents, they listen to events: CreatorCreated, etc.

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
