import React, { useState } from 'react';

function CopyIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
    );
}

function copy(text) {
    navigator.clipboard.writeText(text);
}

function BeatCard({ beat }) {
    const hasAnimation = beat.videoAnimationPrompt && beat.videoAnimationPrompt !== 'null';

    return (
        <div className="beat-card">
            <div className="beat-header">
                <span className="beat-number">Beat {beat.beat}</span>
            </div>

            <div className="beat-script">
                {beat.scriptLine}
            </div>

            <div>
                <div className="beat-goal">Image Prompt</div>
                <div className="prompt-box">{beat.imagePrompt}</div>
                <div className="card-actions">
                    <button className="btn-secondary" onClick={() => copy(beat.imagePrompt)}>
                        <CopyIcon /> Copy Image Prompt
                    </button>
                </div>
            </div>

            <div>
                <div className="beat-goal">Video Animation Prompt</div>
                {hasAnimation ? (
                    <>
                        <div className="prompt-box" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                            {beat.videoAnimationPrompt}
                        </div>
                        <div className="card-actions">
                            <button className="btn-secondary" onClick={() => copy(beat.videoAnimationPrompt)}>
                                <CopyIcon /> Copy Animation Prompt
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ color: '#555', fontSize: '13px', fontStyle: 'italic', marginTop: '4px' }}>
                        Not needed — still image is sufficient for this beat.
                    </div>
                )}
            </div>
        </div>
    );
}

export default function App() {
    const [script, setScript] = useState('');
    const [beats, setBeats] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleGenerate = async () => {
        if (!script.trim()) return;
        setIsLoading(true);
        setError(null);
        setBeats(null);
        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script })
            });

            if (!res.ok) {
                let msg = 'Generation failed.';
                const text = await res.text();
                try {
                    const json = JSON.parse(text);
                    if (json.error) msg = json.error;
                } catch (_) {
                    msg = `Server Error ${res.status}: Route unavailable or returned HTML (check Vercel logs).`;
                }
                throw new Error(msg);
            }

            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) throw new Error('No beats returned. Please retry.');
            setBeats(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const copyAll = () => {
        if (!beats) return;
        const text = beats.map(b => {
            let out = `Beat ${b.beat}\nScript: ${b.scriptLine}\nImage Prompt: ${b.imagePrompt}`;
            if (b.videoAnimationPrompt) out += `\nAnimation Prompt: ${b.videoAnimationPrompt}`;
            return out;
        }).join('\n\n---\n\n');
        copy(text);
    };

    const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;

    return (
        <>
            <header style={{
                padding: '24px 32px 20px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--panel-bg)',
            }}>
                <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '24px', fontWeight: '800', background: 'linear-gradient(to right, #fff, #999)', WebkitBackgroundClip: 'text', color: 'transparent', marginBottom: '4px' }}>
                    AI Cars — Visual Prompt Gen
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Paste a script → get cinematic image &amp; animation prompts for every beat
                </p>
            </header>

            <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                <div className="input-group">
                    <label>Script</label>
                    <textarea
                        placeholder="Paste your YouTube Shorts script here..."
                        value={script}
                        onChange={e => setScript(e.target.value)}
                        style={{ minHeight: '200px' }}
                    />
                    <div style={{ fontSize: '11px', color: '#666', textAlign: 'right', marginTop: '4px' }}>
                        {script.length} chars · {wordCount} words
                    </div>
                </div>

                <button
                    className="btn-primary"
                    onClick={handleGenerate}
                    disabled={isLoading || !script.trim()}
                    style={{ alignSelf: 'flex-start', padding: '14px 28px' }}
                >
                    {isLoading ? 'Analyzing Script...' : 'Analyze Script & Generate Visual Prompts'}
                </button>

                {error && (
                    <div style={{ color: 'var(--accent)', fontSize: '14px', background: 'rgba(255,42,42,0.08)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,42,42,0.2)' }}>
                        {error}
                    </div>
                )}

                {isLoading && (
                    <div className="empty-state" style={{ padding: '48px' }}>
                        <div className="loader"></div>
                        <div style={{ marginTop: '12px' }}>Generating visual prompts...</div>
                    </div>
                )}

                {beats && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '20px', fontWeight: '700' }}>
                                {beats.length} Visual Beat{beats.length !== 1 ? 's' : ''}
                            </h2>
                            <button className="btn-secondary" onClick={copyAll}>
                                <CopyIcon /> Copy All
                            </button>
                        </div>
                        {beats.map((beat, i) => <BeatCard key={i} beat={beat} />)}
                    </div>
                )}
            </div>
        </>
    );
}
