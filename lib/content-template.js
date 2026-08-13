// Deterministic fallback used when GEMINI_API_KEY isn't configured, or the Gemini call fails.
export function templateContent(persona) {
  const niche = persona.niche || 'Agentic AI'
  const story = persona.story || ''
  const audience = persona.audience || 'Both Bilingual'
  return {
    nepaliStatus: `Soch yesto cha: ${story.substring(0,80)}... Hadigaun ma SochGuru banauda bujheko - Discipline > Motivation. Tapai ko 1 win ke thiyo? #SochGuru #NepaliSoch`,
    englishVideo: `[HOOK 0-3s] My decade in banking taught me this...\n[MAIN 3-20s] ${story} I'm building from Hadigaun, Kathmandu. Focus is a muscle, not talent.\n[CTA] What's your non-negotiable?`,
    englishStatus: `Building in Public Day from Hadigaun, Kathmandu. Today I learned ${niche} can save 3 hours. AI amplifies your story. What's one task you want to automate? #SochGuru #BuildingInPublic`,
    nepaliVideo: `[HOOK] Soch yesto cha: ${niche} le 3 ghanta bachayo...\n[MAIN] Hadigaun bata SochGuru banairako chu...\n[CTA] Tapai kun kaam automate garna chahanuhunchha?`,
    imagePrompt: `Same 3D character, curly hair, navy hoodie with glowing circuit-brain logo CIRCUIT-BRAIN, Pixar style, futuristic office holographic charts, Hadigaun Kathmandu vibe, ${niche}`,
    veoPrompt: `8s cinematic video, same SochGuru avatar speaking ${audience.includes('Both') ? 'English and Nepali' : 'English'}, Hadigaun cafe, Newari architecture, holographic charts, 9:16 vertical, high detail`
  }
}
