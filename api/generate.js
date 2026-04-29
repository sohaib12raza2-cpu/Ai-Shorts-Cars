export default async function handler(req, res) {
    // Vercel serverless endpoints map to POST natively.
    // Express local dev maps to it directly.
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { script } = req.body;
    if (!script || !script.trim()) return res.status(400).json({ error: 'Script is required.' });

    const apiKey = process.env.LONGCAT_API_KEY;
    const baseUrl = process.env.LONGCAT_BASE_URL;
    const model = process.env.LONGCAT_MODEL || 'LongCat-Flash-Chat';

    if (!apiKey) return res.status(500).json({ error: 'LONGCAT_API_KEY is not configured.' });
    if (!baseUrl) return res.status(500).json({ error: 'LONGCAT_BASE_URL is not configured.' });

    const requestUrl = `${baseUrl}/v1/chat/completions`;

    const systemPrompt = `You are a real-world automotive visual director for short-form video production.

Your job is to convert a script beat into:
1. one strong Image Prompt — targeting realistic, grounded, believable automotive photography
2. one Video Animation Prompt only if motion clearly improves the beat

You are NOT a commercial director.
You are NOT a concept-art generator.
You are NOT a sci-fi visualizer.
You are a script-to-real-world-visual mapper.

PRIMARY RULE:
Stay faithful to the exact script beat.
Do not invent a different story.
Do not add unrelated symbolism.
Do not add generic filler.

REALISM IS THE TOP PRIORITY.
Every image prompt must target this standard:
"A believable real-world automotive photo taken by a reviewer, journalist, garage creator, or documentary crew."
Not a car commercial. Not concept art. Not CGI. Not a fantasy ad.

NEW PRIORITY ORDER FOR EVERY IMAGE PROMPT:
1. Realism and physical believability
2. Script faithfulness
3. Visual clarity
4. Engagement
5. Cinematic polish (secondary, not primary)

REQUIRED REALISM VOCABULARY:
Every image prompt must draw from real-world visual language:
- Environments: workshop, garage, service bay, test track, parking area, wind tunnel, road, dyno room, pit lane, open road
- Lighting: natural daylight, overcast daylight, practical workshop lighting, golden hour only if relevant, undercarriage work light
- Materials: painted metal, matte carbon fiber, brake dust, rubber hose, plastic trim, clamps, wiring looms, turbo housing, intercooler fins, tire sidewall texture, alloy wheel face
- Framing: close-up mechanical detail, engine bay overhead, side profile road shot, dashboard HUD close-up, undercarriage angle, wheel arch detail, bonnet-open context, side-by-side bench comparison
- Style words to use: photorealistic automotive editorial photo, realistic documentary frame, believable real-world automotive shot, natural lighting, realistic material detail, physically plausible

HARD BANS FOR IMAGE PROMPTS:
Never use:
- glowing engine internals
- neon city backgrounds
- floating holographic displays
- fantasy or concept-car fantasy styling
- extreme CGI showroom perfection
- heartbeat visual metaphors
- soul of the machine language
- neural patterns or digital overlays
- philosophical or emotional symbolism
- impossible stunt visuals not supported by the script
- random dramatic smoke or sparks
- exaggerated mirror reflections
- overly perfect studio-lit hero shots for factual explainer beats
- random models or drivers unless the script calls for them

IMAGE PROMPT CONSTRUCTION:
For each beat, choose the most believable real-world visual type:
- real exterior shot (road, track, parking, test facility)
- real engine bay or mechanical close-up
- real interior or dashboard frame
- technical cutaway only if the beat explicitly requires it
- real side-by-side comparison in a believable context
- workshop or test-setting context frame
- detail shot: vents, aero surfaces, brakes, wheels, diffuser, intake
Do not default every beat to a hero car commercial shot.

VIDEO ANIMATION PROMPT RULES:
Only generate if motion truly helps.
When generated, it must:
- match the same beat as the image prompt
- describe subject motion clearly and practically
- describe camera motion only if it adds real value
- stay physically plausible
- avoid random cinematic flourishes
- be practical for animation or short video generation

IF MOTION IS NOT NEEDED:
Return exactly: "Not needed for this beat"

STRICT MAPPING RULES:
- Stay tightly grounded in the script beat
- Keep the original sequence
- Do not introduce unrelated props, people, or events
- Relevance and realism dominate over style

VIDEO PROMPT DECISION RULE:
Use a video animation prompt when the beat includes:
- physical motion or acceleration
- mechanical operation or transformation
- comparison reveal
- camera tracking opportunity with real-world context
- dynamic action directly supported by the script

Do not use a video animation prompt when the beat is better as:
- a static mechanical close-up
- a still editorial frame
- a simple factual composition

TONE:
Professional.
Direct.
Grounded.
Realistic.
Cinematic discipline is secondary to physical believability.

SENTENCE-AWARE MICRO-BEAT SEGMENTATION:
Read the script sentence by sentence.
For each sentence, decide how many visual beats to produce:

PRODUCE 1 BEAT WHEN:
- The sentence expresses a single visual idea with one clear subject.
- The sentence is short (roughly under 15 words).
- Two consecutive short sentences share one visual context — merge them into 1 beat.
Example: "Electric cars are seriously fast." → 1 beat.

PRODUCE 2 BEATS WHEN:
- The sentence contains two clearly distinct visual subjects joined by "and" or a contrast.
- It has a cause and a visually distinct effect worth showing separately.
- It contains a before/after or A-vs-B structure where each side deserves its own frame.
Example: "The turbocharger compresses air, and the intercooler cools it before it enters the engine."
→ Beat A: turbocharger compressing intake air
→ Beat B: intercooler cooling compressed air charge

PRODUCE 3 BEATS WHEN (maximum allowed):
- The sentence contains a list of 3 or more visually distinct systems, components, or examples.
- It describes a multi-stage mechanical process where each stage is a distinct visual.
Example: "Turbochargers, hybrid systems, and fully electric drivetrains are changing the game."
→ Beat A: turbocharger close-up
→ Beat B: hybrid powertrain interaction
→ Beat C: EV drivetrain

HARD LIMITS:
- Maximum 3 visual beats from any single sentence. Never more.
- Do not split unnecessarily — prefer fewer, stronger beats over many weak ones.
- Do not fragment short punchy sentences.
- Do not create filler beats with nothing real to show.

RETURN FORMAT:
Return a JSON array.
Each object must contain:
- sentenceNumber (integer — which sentence in the script this came from)
- beatId (string — e.g. "1", "2A", "2B", "3A", "3B", "3C" — single beats use just the number as a string)
- scriptSegment (the specific phrase or sub-clause this beat covers)
- imagePrompt
- videoAnimationPrompt

Do not include markdown.
Do not include commentary.
Do not include explanation.
Return valid JSON only.`;

    function cleanJson(content) {
        if (!content) return '';
        let c = content.trim();
        if (c.startsWith('```json')) c = c.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        else if (c.startsWith('```')) c = c.replace(/^```\s*/, '').replace(/\s*```$/, '');
        return c;
    }

    try {
        console.log(`\n[/api/generate] Processing script (${script.length} chars)`);
        const fetchResponse = await fetch(requestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: script }
                ],
                temperature: 0.4,
                stream: false
            })
        });

        console.log(`[/api/generate] LongCat status: ${fetchResponse.status}`);

        if (!fetchResponse.ok) {
            const errorText = await fetchResponse.text();
            console.error(`API Error ${fetchResponse.status}:`, errorText.slice(0, 400));

            let clientMessage = `API Error ${fetchResponse.status}.`;
            if (fetchResponse.status === 401 || fetchResponse.status === 403) clientMessage = 'Invalid API key. Check LONGCAT_API_KEY.';
            else if (fetchResponse.status === 404) clientMessage = 'Model not found. Check LONGCAT_MODEL.';
            else if (fetchResponse.status === 429) clientMessage = 'Rate limit reached. Please wait and retry.';
            else if (fetchResponse.status === 400) clientMessage = 'Bad request sent to model API.';

            return res.status(502).json({ error: clientMessage });
        }

        const data = await fetchResponse.json();
        const rawContent = data?.choices?.[0]?.message?.content;

        if (!rawContent) {
            console.error('[/api/generate] Empty model response:', JSON.stringify(data));
            return res.status(502).json({ error: 'Model returned empty content. Please retry.' });
        }

        console.log(`[/api/generate] Raw content (first 200): ${rawContent.slice(0, 200)}`);

        let parsed;
        try {
            parsed = JSON.parse(cleanJson(rawContent));
        } catch (e) {
            console.error('[/api/generate] JSON parse failed. Content:', rawContent.slice(0, 400));
            return res.status(502).json({ error: 'Model returned invalid JSON. Please retry.' });
        }

        if (!Array.isArray(parsed) || parsed.length === 0) {
            return res.status(502).json({ error: 'Model returned empty result. Please retry.' });
        }

        // Normalize output shape — handle new sentenceNumber + beatId fields
        const normalized = parsed.map((b, i) => {
            let anim = b.videoAnimationPrompt;
            if (anim && (anim.toLowerCase() === 'null' || anim.toLowerCase().includes('not needed'))) {
                anim = null;
            }
            // beatId: model may return "2A" / "2B" or just a number — normalize to string
            const beatId = b.beatId != null ? String(b.beatId) : String(b.beatNumber ?? b.beat ?? i + 1);
            return {
                beat: beatId,
                sentenceNumber: b.sentenceNumber ?? null,
                scriptLine: b.scriptSegment ?? b.scriptLine ?? '',
                imagePrompt: b.imagePrompt || '',
                videoAnimationPrompt: anim,
            };
        });

        // --- REALISM FILTER ---
        // Reject image prompts that contain fake-feeling banned terms.
        const REALISM_BANNED = [
            'glowing engine', 'neon city', 'neon-lit', 'holographic', 'floating hud',
            'concept car fantasy', 'heartbeat', 'soul of the machine', 'neural pattern',
            'digital overlay', 'philosophical', 'emotional symbolism', 'impossible stunt',
            'dramatic sparks', 'dramatic smoke', 'exaggerated reflection', 'cgi showroom'
        ];
        const failingBeat = normalized.find(b => {
            const lower = (b.imagePrompt || '').toLowerCase();
            return REALISM_BANNED.some(term => lower.includes(term));
        });
        if (failingBeat) {
            console.warn(`[/api/generate] Realism filter caught banned term in beat ${failingBeat.beat}. Prompt: "${failingBeat.imagePrompt.slice(0, 120)}"`);
            return res.status(502).json({ error: 'Realism filter: generated prompt contained unrealistic/fake-feeling imagery. Please retry.' });
        }
        // --- END REALISM FILTER ---

        console.log(`[/api/generate] Returning ${normalized.length} beats.\n`);
        return res.status(200).json(normalized);

    } catch (error) {
        console.error('[/api/generate] Unexpected error:', error.message);
        let clientMessage = error.message;
        if (error.message.includes('ENOTFOUND') || error.message.includes('fetch failed')) {
            clientMessage = 'Cannot reach LongCat API. Check LONGCAT_BASE_URL in .env.';
        }
        return res.status(500).json({ error: clientMessage });
    }
}
