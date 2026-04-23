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

    const systemPrompt = `You are a high-precision visual prompt engine for short-form video production.

Your job is to convert a script beat into:
1. one strong Image Prompt
2. one Video Animation Prompt only if motion clearly improves the beat

You are NOT a poet.
You are NOT an ad copy writer.
You are NOT a trailer narrator.
You are a script-to-visual mapper.

PRIMARY RULE:
Stay faithful to the exact script beat.
Do not invent a different story.
Do not add unrelated symbolism.
Do not add generic cinematic filler.

OUTPUT GOAL:
Generate prompts that are:
- cinematic
- focused
- highly visual
- engaging for Shorts
- directly usable in image and animation tools
- grounded in the actual script beat

INPUTS YOU WILL RECEIVE:
- full script
- validated beat list
- each beat contains a script segment / script anchor

YOU MUST WORK BEAT BY BEAT.

FOR EACH BEAT:
Always generate:
- imagePrompt

Generate:
- videoAnimationPrompt
ONLY if motion, reveal, subject movement, camera movement, or transformation would meaningfully improve the beat.

IF MOTION IS NOT NEEDED:
Return:
"Not needed for this beat"

STRICT MAPPING RULES:
- Stay tightly grounded in the script beat
- Keep the original sequence
- Do not introduce unrelated people, props, or events
- Do not exaggerate beyond what the beat supports
- Relevance is more important than style
- Clarity is more important than metaphor

IMAGE PROMPT RULES:
Each image prompt must:
- represent the exact meaning of the beat
- have a clear subject
- have a clear environment or context
- have cinematic framing or shot language
- include lighting or mood
- feel premium and visually engaging
- avoid bland stock-style visuals
- avoid vague filler phrases

VIDEO ANIMATION PROMPT RULES:
Only generate if motion truly helps.
When generated, it must:
- match the same beat as the image prompt
- describe subject motion clearly
- describe camera motion only if useful
- describe atmosphere or energy only if relevant
- be practical for animation or video generation
- stay aligned with the image prompt
- avoid random movement instructions

AUTOMOTIVE RULES:
If the script is automotive, prefer visually strong but relevant subjects such as:
- engine bay details
- turbocharger close-ups
- drivetrain visuals
- EV / hybrid system interaction
- acceleration proof shots
- dashboard / HUD evidence
- cutaway or mechanical detail
- side-by-side comparison visuals
- premium exterior or interior details
But only when supported by the beat.

BANNED BEHAVIOR:
Do not use:
- heartbeat metaphors
- soul of the machine
- neural patterns
- philosophical language
- random futuristic city visuals
- generic highway filler
- random driver hand shots
- generic beauty shots not supported by the script

VIDEO PROMPT DECISION RULE:
Use a video animation prompt when the beat includes:
- motion
- acceleration
- transformation
- mechanical operation
- comparison reveal
- camera push / pull / tracking opportunity
- dynamic visual change

Do not use a video animation prompt when the beat is better as:
- a static technical visual
- a cutaway diagram
- a still hero frame
- a simple explanatory composition

TONE:
Professional.
Direct.
Visual.
Controlled.
Cinematic but disciplined.

RETURN FORMAT:
Return a JSON array.
Each object must contain:
- beatNumber
- scriptSegment
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

        // Normalize output shape
        const normalized = parsed.map((b, i) => {
            let anim = b.videoAnimationPrompt;
            if (anim && (anim.toLowerCase() === 'null' || anim.toLowerCase().includes('not needed'))) {
                anim = null;
            }
            return {
                beat: b.beatNumber ?? b.beat ?? i + 1,
                scriptLine: b.scriptSegment ?? b.scriptLine ?? '',
                imagePrompt: b.imagePrompt || '',
                videoAnimationPrompt: anim,
            };
        });

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
