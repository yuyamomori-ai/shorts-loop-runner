# Visual First production contract

Billing exhaustion (`credit_balance_exhausted` / `insufficient_quota`) stops production without timed retries. Normal 429 rate limiting still uses backoff. The private acceptance report includes live YouTube authorization and renderer/font checks. After resolving a connection or billing issue, the dashboard can rerun the two isolated tests within the same daily AI budget; it never uploads them.

Both A (knowledge with visual explanation) and B (footage with original commentary) use measured Japanese AI speech, short lower-screen captions, multiple visual scenes, and sourced explanatory graphics. Pexels is optional: absent stock produces original process/concept/comparison graphics, never a successful blank-background caption render. A production render that cannot meet the contract is held.

## Planning and evidence

`lib/visual.mjs` defines bounded segment fields and the shared publication gate. `runner/visual-plan.mjs` splits measured sentence durations into approximately 2–4 second scenes. Old records remain readable and acquire a visual plan before rendering; no destructive migration is used. Diagram labels and relations are checked alongside narration and overlays against retrieved source text. The verified content hash and approval digest bind these claims, the material mapping and the final render.

Stock is illustrative, not proof of an event. Up to three material searches/downloads are attempted per production video by default. Query results expire after one day, the cache has 60 entries, downloaded media is capped at 60 MB per file, and no 4K variant is selected. Provider responses, licenses, acquisition/rights timestamps, consent requirements, attribution and SHA-256 remain recorded. Asset inspection is reused only with the same byte hash. Social network downloads are unsupported.

## Rendering and validation

The renderer uses FFmpeg/libass already present in the image, including vector diagrams without a browser, Canvas or SVG rasterizer. OpenAI TTS takes priority when configured; model and voice settings are respected. Speech caches are content/voice/model/speed/hash bound and reused during visual repairs; successful jobs clean intermediate media.

Publication requires real non-silent narration, H.264 1080×1920 with audio, 20–60 seconds, sufficient scene changes, a sourced explanation where appropriate, fact/rights/originality approval, and visual approval. The decoder checks the complete output for errors, black frames, long freezes and audio levels. AI reviews the opening and scene samples for relevance, diagram clarity, reading comfort, pacing and variety. This is an internal assessment and does not guarantee audience retention or platform acceptance. Safe visual issues can trigger at most two local edit attempts with cached speech. Fact, rights and safety concerns never receive an editing-only override.

`SHORTSLOOP_PUBLISH_HOLD=true` holds scheduling and uploads while testing without erasing saved user preferences or tokens. `SHORTSLOOP_VALIDATE_ON_START=true` runs a science and a knowledge test with real configured OpenAI access in an isolated validation database. It never uploads; usage counts against the normal daily budget. A validation ID is a one-time run: changing it explicitly starts a new paid validation, so do not rotate it on ordinary restarts. Missing keys or failed checks are reported, never marked successful.

## Learning and checks

Visual features include scene timing, footage ratio, diagram/card counts, editing methods, hook visual type and caption density. Visual allocation requires 20 mature videos and at least eight samples per comparable group. Observed associations are labeled non-causal and retain 30% exploration. Real visual comparisons use only YouTube observations; fixtures and previews are excluded.

- `npm run test:engine`: domain, persistence, OAuth, upload-session and visual safety tests.
- `RUN_RENDER_TESTS=true node --test tests/render-visual.test.mjs`: actual FFmpeg encode/mix with **synthetic tone/video fixtures**, not an OpenAI acceptance test.
- `npm run preview:visual`: deterministic, Japanese **no-narration** layout examples, always non-publishable.
- Startup acceptance: real OpenAI planning, fact checking, speech, rendering, visual QA and originality checks in the deployed runtime.

The inspected production host on 2026-09-08 was Railway, repository `yuyamomori-ai/shorts-loop-runner`, branch `main`, `Dockerfile.cloud`, volume `/app/data`, health endpoint `/healthz`. Do not create a new Render service or move the persistent volume merely because older instructions name Render. The same Docker runtime remains usable on Render.
