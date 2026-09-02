# Photo Align development tasks

Status convention: `[ ]` not started, `[~]` in progress, `[x]` done. When you finish an item, record the verification command and its result underneath it.

## Phase 0: Establish a baseline (P0)

- [ ] Record the current demo's detection success rate, review count, export time, and peak memory
  - Use the first 30 photos from `demo/manifest.json`.
  - Test each output format supported by Chrome and Safari separately.
  - Acceptance: results are recorded in this file or in the PR description, so before/after comparisons are possible.
- [~] Fill in a minimum of automated verification
  - Add unit tests for date parsing, photo sorting, target eye position, and frame duration calculation.
  - Add browser smoke tests for loading the demo, picking a subject, editing a date, skipping a photo, and exporting.
  - Acceptance: `npm test` is available, and both the build and the tests pass.
  - Progress: 5 unit tests added for dates and the export frame plan; browser smoke tests still to be written.

## Phase 1: Rework the export pipeline (P0)

- [~] Remove the full `ImageData[]` frame buffer
  - Change the flow to "decode image -> render one frame -> encode/write immediately".
  - For video, evaluate WebCodecs first; MediaRecorder can serve as the compatibility path.
  - GIF must be written frame by frame; all RGBA frames cannot be kept in memory.
  - Acceptance: peak memory stays stable while exporting the 30 demo photos; 100 ordinary photos do not crash the page because of the frame buffer.
  - Progress: now reuses a single canvas and writes frames one at a time to GIF/MediaRecorder; a real-browser memory baseline still needs to be recorded.
- [x] Add an image decode cache
  - Decode each photo only once, and actively release ImageBitmap/cache resources when the export ends.
  - Acceptance: `loadImage()` is no longer called per frame inside the export loop.
- [x] Fix the semantics of "speed"
  - Use a fixed FPS throughout, and derive the frame count from each photo's hold duration.
  - GIF and video should have roughly the same total duration at the same speed.
  - Acceptance: total duration at 0.5x, 1x, and 2x is within one frame of the expected value.
- [x] Make output format capabilities explicit
  - Detect MP4/WebM/GIF support at startup.
  - When MP4 is unsupported, disable it or rename it to WebM — never change the format silently.
  - Acceptance: the UI option, MIME type, extension, and downloaded file all agree.
- [x] Add export cancellation and error recovery
  - Allow cancelling mid-export, releasing the encoder, media tracks, and temporary resources.
  - After a failure the user can retry directly, without refreshing or re-analyzing the photos.

## Phase 2: Fix data and alignment correctness (P1)

- [ ] Fix the EXIF date timezone offset
  - Format using the local year/month/day rather than slicing the output of `toISOString()`.
  - Cover UTC+8, day-boundary, and no-EXIF filename-fallback cases with tests.
- [ ] Fix face box coordinates on thumbnails
  - Correctly account for the scale and crop offset introduced by `object-fit: cover`, or change the thumbnail to a non-cropping layout.
  - Acceptance: face boxes land on the actual face in landscape, portrait, and square photos.
- [ ] Re-evaluate quality after switching subjects
  - Extract the scoring logic into a pure function.
  - When the selected face changes, update score, warning, and review status along with it.
- [ ] Calibrate "natural" and "strict" alignment
  - Define the eye position, rotation, and natural-offset rules for both modes explicitly.
  - Strict mode should place both eyes exactly on their target points; natural mode needs a bounded drift.
  - Acceptance: compare eye position error against fixed test images, and guard against regressions.
- [ ] Make the timeline order match the output order
  - The timeline shows the actual export order by default.
  - Photos with no date need a clear and stable sort strategy.

## Phase 3: Round out the core workflow (P1)

- [ ] Add a low-resolution motion preview
  - Support play, pause, previous, next, and loop.
  - Update the preview quickly when settings change, without requiring a full export first.
- [ ] Add a "photos needing attention" workflow
  - Provide all / needs review / no face found / skipped filters.
  - Provide a "next problem photo" action.
  - Prompt the user clearly to pick a subject in group photos.
- [ ] Round out photo management
  - Support appending photos, deleting one, bulk skipping, restoring, and drag-to-reorder.
  - Show clear feedback when there are more than 100 photos, an unsupported format, or a corrupt file — never ignore it silently.
- [ ] Add an export summary
  - Before generating, show the format, resolution, estimated duration, photo count, and browser compatibility.
  - After generating, keep the in-page preview, a regenerate action, and the download link.

## Phase 4: Mobile, styling, and accessibility (P2)

- [ ] Improve the information order on mobile
  - Show the preview first, and move settings into a collapsible section or a bottom sheet.
  - Acceptance: at 320px wide there is no overflow, occlusion, or unusable control.
- [ ] Round out keyboard and screen reader support
  - Clickable cards use semantic buttons, or gain proper `tabIndex`/keyboard handlers.
  - Face selection boxes get readable names and a selected state.
  - Segmented controls get `aria-pressed`, and every focus state is clearly visible.
- [ ] Improve upload feedback
  - Add a drag-over state, model loading progress, analysis progress, failure reasons, and a retry button.
- [ ] Make the settings easier to understand
  - Keep setting names short, and convey the "natural vs strict" and transition differences through the live preview.
  - Do not add long instructional copy or a marketing-style page.

## Phase 5: Engineering and release (P2)

- [ ] Split up `src/App.tsx`
  - Suggested boundaries: `face-detection`, `photo-metadata`, `alignment-renderer`, `export`, state management, and UI components.
  - Pure computation must not depend on React or the DOM, so it stays testable.
- [ ] Move detection and encoding into a Web Worker
  - The main thread only handles interaction, preview, and progress display.
  - Acceptance: page scrolling and button feedback stay smooth during analysis and export.
- [ ] Add `lint`, `test`, and CI
  - CI runs at least dependency install, type checking, tests, and a production build.
- [ ] Update dependencies with security advisories
  - Upgrade the Vite and `js-yaml` dependency chains, then run `npm audit`, the tests, and the build.
- [ ] Optimize first-paint resources
  - Load MediaPipe only after the user starts the demo or an upload.
  - Show download and cache status for the roughly 36MB of model assets.
- [ ] Verify the GitHub Pages release
  - Run `npm run build:pages`.
  - Check the `/photo_align/` base path, the demo, WASM, the model, and export.

## Definition of done

- 100 photos can be analyzed and exported, with the page staying responsive and no steadily growing resource leak.
- The demo's detection, sorting, multi-person selection, date editing, skipping, preview, and export flows all work.
- GIF/video speed and format match what the UI promises.
- The main flow has no blocking issues on desktop or mobile, and the primary actions can be completed with a keyboard.
- `npm run build`, `npm test`, lint, and the browser smoke tests all pass.
