# Technical options for the portrait photo alignment video tool

## 1. Key technical points from the requirements

This product has a few core technical constraints:

- It must be a web tool
- Photos are processed entirely locally and never uploaded to a server
- It is used by ordinary people, with up to roughly 100 photos
- It must detect faces, eyes, and capture times
- It must handle exceptions such as multiple people, missing times, and failed detection
- It ultimately exports MP4 or GIF
- The default result should look natural and pleasant, not mechanically locked down

So the architecture must primarily solve:

1. Local image reading and EXIF parsing
2. In-browser face and eye landmark detection
3. Geometric image alignment based on those landmarks
4. Sorting, cropping, smoothing, and previewing many photos
5. In-browser video or GIF encoding
6. Performance and memory control with many high-resolution photos

## 2. The common processing pipeline

Whichever option is chosen, the core flow is essentially the same:

1. The user uploads photos
2. The browser reads the files and their EXIF data
3. Thumbnails and working-size images are generated
4. Face detection runs on each image
5. Eye landmarks and the face box are extracted
6. Problem photos are handled
7. Photos are sorted by capture time or by the user's order
8. Rotation, scale, translation, and crop parameters are computed per photo
9. Aligned frames are generated on a Canvas
10. A preview is generated
11. MP4 or GIF is exported

## 3. Option 1: pure front-end MVP — MediaPipe + Canvas + ffmpeg.wasm

### 3.1 Stack

- Front-end framework: React or Vue
- EXIF: exifr or piexifjs
- Face landmarks: MediaPipe Face Landmarker
- Image processing: Canvas / OffscreenCanvas
- Video export: ffmpeg.wasm
- GIF export: gif.js, or generated through ffmpeg.wasm
- State management: something lightweight is enough — Zustand, Pinia, or the framework's built-in state

### 3.2 How it works

The browser loads the face detection model and detects faces and eye points in each photo. Aligned frames are generated on a Canvas and then handed to ffmpeg.wasm, which encodes MP4 or GIF in the browser.

### 3.3 Pros

- Fully consistent with the "processed locally" positioning
- A clear engineering path, well suited to building an MVP quickly
- ffmpeg.wasm is fully capable, so export formats are flexible
- No server dependency, so deployment is simple
- Strong user trust, with a clear privacy selling point

### 3.4 Cons

- The ffmpeg.wasm bundle is large, so first load is slow
- Video encoding is CPU-heavy and may be very slow on low-end devices
- Memory pressure is noticeable with 100 high-resolution photos
- The mobile experience may be unstable
- MP4 encoding speed and browser compatibility need careful testing

### 3.5 When it fits

Best suited to the first MVP. Its strength is a direct path that can validate the product's value; its weaknesses are mainly performance and bundle size.

## 4. Option 2: high-performance pure front-end — MediaPipe + WebCodecs + MP4 muxer

### 4.1 Stack

- Front-end framework: React or Vue
- EXIF: exifr
- Face landmarks: MediaPipe Face Landmarker
- Image processing: Canvas / OffscreenCanvas / Web Worker
- Video encoding: WebCodecs
- MP4 muxing: mp4-muxer, Mediabunny, or a similar muxer
- GIF export: a separate GIF encoding library, or deferred as a non-core feature

### 4.2 How it works

After the Canvas produces each frame, the frame is handed to the WebCodecs VideoEncoder, and an MP4 muxer packages the output into an MP4 file. The whole process still happens locally in the browser.

### 4.3 Pros

- Better performance potential than ffmpeg.wasm
- Can use the browser's native video encoding
- Better suited to longer videos and larger photo counts
- The bundle can be much smaller than ffmpeg.wasm
- Easier to process as a stream, which lowers peak memory

### 4.4 Cons

- Browser compatibility is more complicated than with ffmpeg.wasm
- MP4 muxing needs extra handling
- Encoding parameters, codec support, and mobile behavior all need a lot of testing
- GIF export is less convenient than with ffmpeg.wasm
- Higher engineering complexity than option 1

### 4.5 When it fits

Suited to performance work after the MVP is validated, or adopted from the start if mobile and export speed matter a great deal. For a first version the technical risk is somewhat high.

## 5. Option 3: lightweight pure front-end — MediaPipe + Canvas + GIF first

### 5.1 Stack

- Front-end framework: React or Vue
- EXIF: exifr
- Face landmarks: MediaPipe Face Landmarker
- Image processing: Canvas
- GIF export: gif.js or omggif
- MP4: unsupported for now, or added later

### 5.2 How it works

The system only produces aligned image frames and encodes them into a GIF. Both preview and export revolve around GIF.

### 5.3 Pros

- The simplest to implement
- Relatively low technical risk
- No need to deal with MP4 codecs and muxers
- Good for quickly building a prototype to validate alignment quality
- Makes debugging individual frames easy

### 5.4 Cons

- GIF files are large
- GIF color quality is poor
- Less friendly for ordinary users to share than MP4
- File size balloons as frame count and resolution rise
- Does not match the final product's goal of a natural, good-looking output

### 5.5 When it fits

Suited to a very early algorithm and interaction prototype. Not recommended as the only export path in a real first version.

## 6. Option 4: local web page + local server

### 6.1 Stack

- Front end: React or Vue
- Local service: Node.js, Python, or Rust
- Face detection: MediaPipe, OpenCV, dlib, InsightFace, etc.
- Image processing: OpenCV / Sharp / Pillow
- Video export: native FFmpeg

### 6.2 How it works

The user starts a local app or local service; the web page only handles interaction, while image analysis and video generation are delegated to the local service. Photos still never go to the cloud.

### 6.3 Pros

- Markedly better performance
- Native FFmpeg is stable, mature, and supports many formats
- Easier to handle large numbers of high-resolution photos
- A far wider choice of face detection and image processing libraries
- Can support more complex algorithms and higher-quality export

### 6.4 Cons

- No longer "open a web page and use it"
- A high installation barrier
- Not lightweight enough for ordinary users
- Cross-platform packaging and updates are costly
- Distribution gets more complicated for a free small tool

### 6.5 When it fits

Suited to a future desktop or pro version. Not a good first choice for the current "free web tool" framing.

## 7. Option 5: cloud processing

### 7.1 Stack

- Front end: React or Vue
- Back end: Node.js / Python
- Storage: object storage
- Face detection: a server-side AI model
- Video generation: server-side FFmpeg

### 7.2 Pros

- Little pressure on the user's device
- Controllable performance
- A more stable experience on phones
- Easier to make export quality consistent
- Opens the door to accounts, saved projects, and batch processing later

### 7.3 Cons

- Contradicts the current "fully local processing" core positioning
- High privacy risk for photos of people's faces
- Requires server costs
- Requires handling upload, deletion, compliance, and data security
- Greater operational burden for a free small tool

### 7.4 When it fits

Not recommended right now. Avoid it unless the product direction changes in the future.

## 8. Recommendations for key modules

### 8.1 Face landmarks

Preferred:

- MediaPipe Face Landmarker

Why:

- Supports the web and JavaScript
- Can detect multiple faces
- Provides dense face landmarks, and the eye points are precise enough for alignment
- Better suited to future extension than a traditional 68-point landmark set

Alternatives:

- face-api.js
- TensorFlow.js models

When an alternative fits:

- You want a lighter model
- You only need a basic face box and a few landmarks
- You can accept the accuracy and maintenance risk

### 8.2 EXIF reading

Recommended:

- exifr

Why:

- Convenient on the front end
- Reads capture time, orientation, camera info, and more
- Well suited to parsing images in bulk

Things to watch:

- Images the user saved from social apps frequently have no EXIF
- How photos are exported from the iOS / Android camera roll can affect whether EXIF survives
- A "missing time" flow for the user to fill in must be designed

### 8.3 Image processing

Recommended:

- Canvas as the basis for the first version
- Bring in OffscreenCanvas + Web Worker when performance becomes a problem

What it handles:

- Correcting EXIF orientation
- Scaling to the working size
- Computing the affine transform from the eye points
- Cropping uniformly to the target aspect ratio
- Generating preview frames and export frames

### 8.4 Video export

For the first version:

- ffmpeg.wasm

For the medium to long term:

- WebCodecs + an MP4 muxer

Why:

- ffmpeg.wasm is straightforward to implement and fully capable, but performance and bundle size are problems
- WebCodecs has better performance potential, but higher engineering complexity and compatibility cost

## 9. Alignment algorithm recommendations

### 9.1 Strict eye alignment

Inputs:

- Left eye center L
- Right eye center R
- Target left eye point L'
- Target right eye point R'

Computed:

- The angle of the line between the eyes
- The distance between the eyes
- The rotation angle
- The scale factor
- The translation

Characteristics:

- Geometrically the clearest
- Very strong face stability
- But it can look mechanical

### 9.2 Natural stabilized alignment

Builds on strict eye alignment with some easing:

- The eye points are not locked down completely
- The face box center is taken into account as well
- Scale change between adjacent photos is limited
- The rotation angle is capped by a threshold
- The crop window is smoothed
- The hair and shoulder regions are preserved

Characteristics:

- Better matches ordinary users' taste
- The picture is less likely to look stiff
- The algorithm's parameters need repeated tuning

The first version should default to natural stabilized alignment and put strict eye alignment in an advanced option.

## 10. Recommended roadmap

### 10.1 Stage one: a usable MVP

Recommended:

- Option 1: MediaPipe + Canvas + ffmpeg.wasm

Goals:

- Complete upload, detection, sorting, exception handling, preview, and MP4/GIF export
- Validate whether users like this kind of video
- Validate how the natural-stabilization parameters feel

### 10.2 Stage two: performance work

Directions:

- Downsample images during preprocessing
- OffscreenCanvas + Web Worker
- Process in batches, avoiding decoding all 100 originals at once
- Cache intermediate results temporarily in IndexedDB
- Replace or supplement ffmpeg.wasm with WebCodecs

### 10.3 Stage three: experience improvements

Directions:

- HEIC support
- Better manual eye correction
- Mobile adaptation
- Saving and restoring a project locally
- More date styles and background fills

## 11. Overall conclusion

The most recommended path right now is:

> Build the first version as a pure front-end app, using MediaPipe Face Landmarker for face and eye landmark detection, Canvas for alignment and frame generation, and ffmpeg.wasm for MP4/GIF export.

This path best matches the current positioning: free, on the web, for ordinary users, processed entirely locally. It is not the highest-performance option, but it is the easiest way to get a complete end-to-end product quickly.

If the MVP is validated, gradually move video encoding to WebCodecs and optimize performance with Workers, OffscreenCanvas, and batched processing.
