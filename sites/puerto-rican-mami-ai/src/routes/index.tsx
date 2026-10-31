import { pageHead } from '@shipwords/core/seo';
import { type GenerateInput, type PublicJob, uploadReference, useGeneration } from '@shipwords/jobs/react';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { authClient } from '~/lib/auth';
import { Plans, PricingLink } from '~/site/pricing';
import { openSignIn } from '~/site/sign-in';
import { parseScene, SCENE_DESCRIPTION_LIMIT, type SceneChoice, type SceneMode } from '~/site/scene';
import { SceneControls } from '~/site/scene-controls';
import site from '../../site.config';
import models from '../../site.models';

const FAQ = [
  ['What is Puerto Rican Mami AI?', 'It is a way to remake the dance with your own photos. Your portrait supplies the appearance, while a reference video guides the choreography, timing and camera. This site is an independent creation tool.'],
  ['Can I make it with a friend?', 'Yes. Choose Duo and upload one photo per dancer. Photo 1 replaces the dancer on the left at the start; Photo 2 replaces the dancer on the right. The instructions follow those identities when they cross.'],
  ['What does Solo change?', 'Solo replaces only the dancer initially on the left. Any other dancer in the fixed reference stays unchanged.'],
  ['Which reference video is used?', 'Every generation uses the fixed dance reference displayed on this page. It guides the routine, timing, camera and sound. Upload your dancer photos, then keep the original setting or choose a custom scene.'],
  ['Can I choose a different scene?', 'Yes. Keep the original scene, describe a new setting, or upload a background photo with optional scene details. Dancer photos supply identity and outfits; the background photo supplies scenery. The reference continues to guide the dance and audio. AI may vary the setting, motion and sound.'],
  ['Which photos work best?', 'Use one adult in each photo, a sharp visible face and a waist-up or full-body crop. Keep arms and shoulders visible, use even light and avoid sunglasses, face filters and heavy occlusion.'],
  ['Will the dance and sound match perfectly?', 'The reference guides the output, but AI may change identity, movement, timing or sound. Exact matching is not guaranteed. You can add a sound you are licensed to use in your video editor or the platform where you post.'],
  ['What does the local demo produce?', 'Local mock mode returns the reference clip unchanged to test uploads, job status and delivery. It does not animate or replace anyone. The page labels this mode and its results clearly.'],
  ['How are credits used?', 'A paid credit pack is required before generating a video. Registration does not include free generation credits. Each job costs 10 credits, and failed or canceled jobs return charged credits. Checkout remains unavailable until payment setup is complete.'],
] as const;

export const Route = createFileRoute('/')({
  head: () => pageHead(site, {
    title: 'Puerto Rican Mami AI �� Make Your Dance Video',
    description: 'Create a Puerto Rican Mami AI dance video from one or two photos and the featured dance reference. Pick your dancers, follow the moves, and download your result.', path: '/',
    jsonLd: [
      { '@type': 'WebApplication', name: site.name, applicationCategory: 'MultimediaApplication', operatingSystem: 'Web', url: site.url },
      { '@type': 'FAQPage', mainEntity: FAQ.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) },
    ],
  }), component: DancePage,
});

const root = getRouteApi('__root__');
const STATE_KEY = 'mami:draft:v3';
type Draft = { mode: 'solo' | 'duo'; left: string; right: string; sceneMode: SceneMode; sceneDescription: string; background: string };
const EMPTY: Draft = { mode: 'duo', left: '', right: '', sceneMode: 'original', sceneDescription: '', background: '' };
const active = (job: PublicJob) => job.status === 'queued' || job.status === 'submitted';

function Arrow({ down = false }: { down?: boolean }) { return <span aria-hidden="true">{down ? '��' : '�J'}</span>; }
function UploadIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 14v6h16v-6" /></svg>; }

function DanceArtwork() {
  return <svg className="dance-art" viewBox="0 0 420 490" role="img" aria-label="Original illustration of two dancers under a walkway at night">
    <defs><radialGradient id="spot"><stop stopColor="#414b36" /><stop offset="1" stopColor="#171e1b" /></radialGradient></defs>
    <rect width="420" height="490" fill="url(#spot)" />
    <g fill="none" stroke="#66715b" strokeWidth="2" opacity=".45"><path d="M0 108 210 35l210 73M33 97v393m354-393v393M0 131h420M33 97l354 0M75 490l67-359m203 359-67-359M0 437h420M0 390h420" /></g>
    <circle cx="210" cy="90" r="4" fill="#edffb9" /><path d="m210 94-70 235h140Z" fill="#e4f3ab" opacity=".035" />
    <ellipse cx="135" cy="441" rx="70" ry="13" fill="#101612" /><ellipse cx="288" cy="441" rx="71" ry="13" fill="#101612" />
    <g className="dancer-one"><path d="m108 321-12 108h29l24-106m1 0 32 101 24-9-24-114" fill="#89927c" /><path d="m102 247 51-12 36 82-89 10z" fill="#d9f96b" /><path d="m109 249-40-28-30 10m112 14 41-43 13-27" fill="none" stroke="#d9f96b" strokeWidth="25" strokeLinecap="round" /><circle cx="133" cy="212" r="24" fill="#cb956e" /><path d="m109 202 9-22 26-3 17 20-20-6-17 12z" fill="#171b16" /><path d="m96 429-10 13h41v-14m54-5 3 17 32-10-10-15" fill="#eeeada" /></g>
    <g className="dancer-two"><path d="m271 323-20 108h29l24-98m-5-11 17 103h28l-8-116" fill="#2b3531" /><path d="m267 245 44-2 24 80-75 9z" fill="#ff8068" /><path d="m273 255-36-35-6-29m75 63 37-22 29 2" fill="none" stroke="#ff8068" strokeWidth="25" strokeLinecap="round" /><circle cx="289" cy="213" r="24" fill="#9d6c4c" /><path d="m267 203 3-23 26-6 21 23-25-8z" fill="#222e24" /><path d="m253 429-12 13h43v-14m31-1v15h40l-13-15" fill="#e7e9d9" /></g>
    <g fill="#d9f96b"><path d="m67 155 4-12 4 12 12 4-12 4-4 12-4-12-12-4z" /><circle cx="354" cy="171" r="3" /></g>
  </svg>;
}

function VideoPlayer({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return failed ? <div className="media-empty"><strong>Video temporarily unavailable</strong><p>Please refresh and try again.</p></div> : <video src={url} controls playsInline preload="metadata" aria-label={label} onError={() => setFailed(true)} />;
}

function DancePage() {
  const config = root.useLoaderData();
  const session = authClient(config.googleClientId).useSession();
  const generation = useGeneration({ recaptchaSiteKey: config.recaptchaSiteKey });
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [ready, setReady] = useState(false);
  const uploadLock = useRef(false);
  const submissionLock = useRef(false);
  const running = generation.jobs.some(active);
  const cost = models[0].credits;
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STATE_KEY) ?? sessionStorage.getItem('mami:draft:v2') ?? 'null');
      if (saved && (saved.mode === 'solo' || saved.mode === 'duo')) setDraft({
        mode: saved.mode, left: typeof saved.left === 'string' ? saved.left : '',
        right: typeof saved.right === 'string' ? saved.right : '',
        sceneMode: saved.sceneMode === 'photo' || saved.sceneMode === 'description' ? saved.sceneMode : 'original',
        sceneDescription: typeof saved.sceneDescription === 'string' ? saved.sceneDescription.slice(0, SCENE_DESCRIPTION_LIMIT) : '',
        background: typeof saved.background === 'string' ? saved.background : '',
      });
    } catch {} setReady(true);
  }, []);
  useEffect(() => { if (ready) try { sessionStorage.setItem(STATE_KEY, JSON.stringify(draft)); } catch {} }, [draft, ready]);

  async function upload(file: File | undefined, slot: 'left' | 'right' | 'background') {
    if (!file || uploadLock.current || running || generation.submitting) return;
    setUploadError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setUploadError('Choose a JPG, PNG or WebP photo up to 10 MB.'); return;
    }
    uploadLock.current = true; setBusy(slot);
    try {
      const path = await uploadReference(file); setDraft(d => ({ ...d, [slot]: path }));
    } catch (error) { setUploadError(error instanceof Error ? error.message : 'Upload failed. Please try again.'); }
    finally { setBusy(null); uploadLock.current = false; }
  }

  async function submit() {
    if (submissionLock.current || running || generation.submitting || busy) return;
    const scene = parseScene({ mode: draft.sceneMode, description: draft.sceneDescription });
    if (!scene) { setSubmitError('Describe your scene using 1 to 600 characters.'); return; }
    if (scene.mode === 'photo' && !draft.background) { setSubmitError('Add a background photo first.'); return; }
    submissionLock.current = true;
    setSubmitError('');
    const input: GenerateInput & { scene: SceneChoice } = {
      modelId: models[0].id,
      slots: { left: draft.left, ...(draft.mode === 'duo' ? { right: draft.right } : {}), ...(scene.mode === 'photo' ? { background: draft.background } : {}) },
      scene,
    };
    try {
      const result = await generation.generate(input);
      if (result) document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally { submissionLock.current = false; }
  }
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.left || (draft.mode === 'duo' && !draft.right)) { setSubmitError('Add the selected dancer photos first.'); return; }
    if (!parseScene({ mode: draft.sceneMode, description: draft.sceneDescription })) { setSubmitError('Describe your scene using 1 to 600 characters.'); return; }
    if (draft.sceneMode === 'photo' && !draft.background) { setSubmitError('Add a background photo first.'); return; }
    if (!config.media.reference) { setSubmitError('The dance reference is being prepared. Please try again later.'); return; }
    if (!consent) { setSubmitError('Confirm permission for the photos before continuing.'); return; }
    if (!session.data?.user) { openSignIn(() => void submit(), 'mami_generate'); return; }
    await submit();
  }

  return <>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><span className="live-dot" /> PHOTO �� DANCE VIDEO</div>
        <h1>Puerto Rican<br />Mami <span className="outline-type">AI.</span><span className="headline-star" aria-hidden="true">?</span></h1>
        <p className="hero-tagline">Your face.<br /><span>Those moves.</span></p>
        <p className="hero-description">Put yourself in the dance. Add your photo, bring a friend, and choose your scene. The featured reference leads the moves.</p>
        <a className="button primary hero-cta" href="#create">Make it yours <Arrow /></a>
        <div className="hero-facts"><span>01�C02 DANCERS</span><span>FIXED ROUTINE</span><span>YOUR SCENE</span></div>
      </div>
      <div className="reference-stage" id="reference-video">
        <div className="stage-top"><span>THE MOVES START HERE</span><span className="stage-dot" /></div>
        {config.media.reference ? <VideoPlayer url={config.media.reference.url} label="Fixed dance reference video" /> : <DanceArtwork />}
        <div className="stage-bottom"><span>{config.media.reference ? `${config.media.reference.duration.toFixed(1)} SEC �� FIXED DANCE REFERENCE` : 'REFERENCE VIDEO COMING SOON'}</span><span>01 / REFERENCE</span></div>
        <span className="stage-sticker">better<br />with a friend.</span>
      </div>
    </section>
    <div className="marquee-strip" aria-hidden="true"><span>YOUR PHOTOS</span><i>?</i><span>YOUR PEOPLE</span><i>?</i><span>THE SAME ENERGY</span><i>?</i><span>MAKE IT MAMI</span><i>?</i></div>

    <section className="example-section" id="example-video" aria-labelledby="example-title">
      <div className="example-copy"><p className="eyebrow">WATCH / THE RESULT</p><h2 id="example-title">See a different<br /><em>version.</em></h2><p>A sample made with this dance reference. Watch the routine above, then see how different faces and outfits can change the result.</p><p className="input-hint">Example only. Your result can vary.</p></div>
      <div className="example-screen"><div className="stage-top"><span>EXAMPLE VIDEO</span><span className="stage-dot" /></div>{config.media.example ? <VideoPlayer url={config.media.example.url} label="Example generated dance video" /> : <div className="media-empty"><span className="media-play" aria-hidden="true">?</span><strong>Example video coming soon</strong><p>A sample result will appear here.</p></div>}</div>
    </section>

    <section className="creator-section" id="create">
      <div className="section-heading"><div><p className="eyebrow">01 / THE CREATOR</p><h2>Let's see <em>your</em> version.</h2></div><p>Photos for the look.<br />Video for the moves.</p></div>
      {config.mock && <div className="demo-banner" role="status"><strong>{config.previewOnly ? 'DESIGN PREVIEW' : 'LOCAL DEMO'}</strong><span>{config.previewOnly ? 'Interface preview. Uploads, sign-in and generation require the Cloudflare runtime.' : 'No AI calls or purchases. A completed test returns the featured dance reference unchanged.'}</span></div>}
      <form className="creator-console" onSubmit={onSubmit}>
        <div className="portrait-panel">
          <div className="panel-title"><h3>Who's dancing?</h3><div className="segmented" role="group" aria-label="Number of dancers"><button type="button" aria-pressed={draft.mode === 'solo'} onClick={() => setDraft(d => ({ ...d, mode: 'solo' }))}>Just me</button><button type="button" aria-pressed={draft.mode === 'duo'} onClick={() => setDraft(d => ({ ...d, mode: 'duo' }))}>Me + a friend</button></div></div>
          <div className={`photo-grid ${draft.mode === 'solo' ? 'solo' : ''}`}>
            {(['left', ...(draft.mode === 'duo' ? ['right'] : [])] as ('left' | 'right')[]).map((slot, i) => <div className="photo-slot" key={slot}>
              <label className={`drop-zone ${draft[slot] ? 'has-photo' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files[0], slot); }}>
                <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Upload ${slot} dancer photo`} disabled={!!busy || running} onChange={e => { void upload(e.target.files?.[0], slot); e.target.value = ''; }} />
                {draft[slot] ? <img src={draft[slot]} alt={`${slot} dancer portrait`} /> : <><span className="upload-circle"><UploadIcon /></span><strong>{busy === slot ? 'Uploading��' : 'Add photo'}</strong><span>or drop it here</span></>}
                <span className="slot-number">0{i + 1}</span>
                {draft[slot] && <span className="change-photo">Click to replace</span>}
              </label>
              <div className="slot-caption"><span>{slot === 'left' ? 'LEFT AT THE START' : 'RIGHT AT THE START'}</span>{draft[slot] && <button type="button" className="text-button" disabled={!!busy || running} onClick={() => setDraft(d => ({ ...d, [slot]: '' }))}>Remove</button>}</div>
            </div>)}
          </div>
          <p className="input-hint">One adult per photo. A clear face, visible shoulders, and even light work best. JPG, PNG or WebP �� up to 10 MB.</p>
          {draft.mode === 'solo' && <p className="solo-note">Solo replaces the first dancer on the left. Other people in the clip stay.</p>}
        </div>
        <div className="motion-panel">
          <SceneControls mode={draft.sceneMode} description={draft.sceneDescription} background={draft.background}
            disabled={!!busy || running || generation.submitting} uploading={busy === 'background'}
            onMode={sceneMode => { setDraft(d => ({ ...d, sceneMode })); setSubmitError(''); }}
            onDescription={sceneDescription => setDraft(d => ({ ...d, sceneDescription }))}
            onUpload={file => void upload(file, 'background')}
            onRemove={() => setDraft(d => ({ ...d, background: '' }))} />
          <div className="routine-summary"><p>{config.media.reference ? 'The featured routine guides the moves, camera and sound.' : 'The dance reference is being prepared.'}</p>
            {config.media.reference && <a href="#reference-video">Watch reference <Arrow /></a>}
          </div>
        </div>
        <div className="creator-actions">
          <label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required /><span>I have permission to use these photos. Everyone shown is 18 or older.</span></label>
          <div className="creator-submit">
          <button className="primary generate-button" type="submit" disabled={!!busy || generation.submitting || running || session.isPending || !config.media.reference}>
            {running ? 'Your video is in progress��' : generation.submitting ? 'Starting your video��' : config.mock ? 'Test the video flow' : 'Make my dance video'} <Arrow />
          </button>
          <p className="button-note">{config.mock ? 'Mock mode �� reference replay �� no AI generation' : `720p �� ${cost} credits per video`}</p>
          </div>
          <div className="creator-errors" aria-live="polite">{(uploadError || submitError) && <p className="error">{uploadError || submitError}</p>}
          {generation.error && <p className="error">{generation.error.code === 'insufficient_credits' || generation.error.code === 'payment_required' ? <>Purchase credits to generate a video. <PricingLink source="mami_credits">View credit packs</PricingLink></> : generation.error.code === 'login_required' ? <button type="button" className="text-button" onClick={() => openSignIn(() => void submit())}>Sign in to continue</button> : generation.error.message}</p>}</div>
        </div>
      </form>
      <div className="results" id="results" aria-live="polite">{generation.jobs.map(job => <ResultCard key={job.id} job={job} mock={config.mock} cancel={() => void generation.cancel(job.id).catch(e => setSubmitError(String(e)))} />)}</div>
    </section>

    <section className="how-section" id="how-it-works"><p className="eyebrow">02 / THE ROUTINE</p><div className="how-layout"><h2>Three steps.<br /><span className="muted">All your energy.</span></h2><div className="steps">{[
      ['Pick your people.', 'One photo for your spot, or two to bring your friend. Clear faces and visible shoulders help the model keep your look.'],
      ['Choose your scene.', 'Keep the original setting, describe a new one, or add a background photo. The featured reference still guides the dance, camera and sound.'],
      ['Make it your moment.', 'Purchase credits, then generate, review and download. Check the result before sharing, and label realistic AI-created footage when you post.'],
    ].map(([title, body], i) => <article key={title}><span className="step-number">0{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div></div></section>

    <section className="editorial-section"><span className="editorial-symbol" aria-hidden="true">?</span><div><p className="eyebrow">SAME ROUTINE. A DIFFERENT CAST.</p><h2>Good moves.<br />Better company.</h2><p>The Puerto Rican Mami dance is built for a shared moment. Your version starts with the people you choose and the featured dance routine. Keep the setup simple, give both dancers room, and let the routine do the talking.</p><a className="text-link" href="#create">Put yourself in the frame <Arrow /></a></div></section>

    <section className="pricing-section" id="pricing"><div className="section-heading"><div><p className="eyebrow">03 / CREDITS</p><h2>A pack. A few takes.<br />No subscription.</h2></div><p>{config.billingReady ? '10 credits per video.' : 'Pack preview �� checkout opens at launch.'}<br />Failed jobs return charged credits.</p></div>
      <Plans />
    </section>

    <section className="faq-section" id="faq"><div><p className="eyebrow">04 / GOOD TO KNOW</p><h2>Before you<br />hit the beat.</h2><p className="muted">A few things about the dance,<br />your photos, and your video.</p></div><div className="faq-list">{FAQ.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
    <section className="closing-cta"><p>YOUR NEXT GROUP CHAT MOMENT.</p><a href="#create">Make it <em>Mami.</em> <Arrow /></a></section>
  </>;
}

function ResultCard({ job, mock, cancel }: { job: PublicJob; mock: boolean; cancel: () => void }) {
  return <article className="job"><div className="result-heading"><strong>{mock ? 'Demo reference replay' : 'Your dance video'}</strong><span className="small-label">{job.status}</span></div>
    {job.outputs.map(output => output.mediaType.startsWith('video/') ? <video key={output.url} src={output.url} controls playsInline aria-label={mock ? 'Mock result: original reference unchanged' : 'Generated dance video'} /> : <img key={output.url} src={output.url} alt="Job output" />)}
    {active(job) && <div className="job-pending"><span className="loader" /><p>{mock ? 'Testing the job and delivery flow��' : 'Your dance video is being made��'}</p><button type="button" onClick={cancel}>Cancel job</button></div>}
    {job.status === 'failed' && <p className="error">Generation failed. Charged credits are returned. {job.error?.message}</p>}
    {job.status === 'canceled' && <p className="muted">Canceled. Charged credits are returned.</p>}
    {job.outputs.map(output => <a className="button primary" key={output.url} href={output.url} download>{mock ? 'Download reference replay' : 'Download video'} ��</a>)}
    {mock && job.status === 'succeeded' && <p className="input-hint">This is your input reference, unchanged. Mock mode performs no AI animation.</p>}
  </article>;
}
