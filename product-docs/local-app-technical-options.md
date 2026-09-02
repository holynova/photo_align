# Technical options for a local app

## 1. Background

If the product moves from a "web tool" to a "local app", the core constraints change:

- Photos can still be processed entirely locally
- The native file system, native FFmpeg, the GPU, and more mature image processing libraries all become available
- Performance, stability, and export quality are usually better than on the pure web
- But users must download and install it, and distribution, updates, signing, and cross-platform work all cost more

A local app fits a version that aims for reliable export, high-quality video, batch processing, and a stronger sense of privacy.

## 2. The common architecture of a local app

Whichever client technology is used, the core modules are broadly the same:

1. UI layer: upload, preview, exception confirmation, settings, export progress
2. File layer: reading local photos and EXIF, caching intermediate results
3. Detection layer: face detection, eye landmarks, multi-person detection
4. Alignment layer: computing rotation, scale, translation, crop, and smoothing parameters
5. Render layer: generating aligned frames in bulk
6. Encoding layer: calling FFmpeg or a system encoder to produce MP4/GIF
7. Project layer: saving a local project and restoring the editing state

## 3. Option 1: Electron + Node.js + native FFmpeg + MediaPipe/ONNX

### 3.1 Stack

- UI: React / Vue / Svelte
- Desktop shell: Electron
- File handling: Node.js
- EXIF: exiftool, exifr, sharp metadata
- Image processing: sharp, opencv4nodejs, Canvas
- Face landmarks: MediaPipe, ONNX Runtime, face-api.js, or an OpenCV approach
- Video export: native FFmpeg

### 3.2 How it works

Electron provides the desktop application and the UI. Node.js handles local file reading, caching, invoking FFmpeg, and model inference. The front end can still reuse most of the web version's interaction logic.

### 3.3 Pros

- High development velocity
- A mature front-end stack, so the UI iterates quickly
- Very easy to reuse the web version's code
- Node.js makes calling native FFmpeg, the file system, and Workers convenient
- Mature cross-platform support covering Windows, macOS, and Linux
- Good for quickly producing a complete, releasable desktop version

### 3.4 Cons

- Large installer and relatively high memory usage
- Electron bundles Chromium, so it feels less lightweight than Tauri or a native app
- Native dependencies, model files, and FFmpeg all need careful packaging
- App signing, notarization, and auto-update still carry engineering cost

### 3.5 When it fits

- The team is mainly front-end / Node.js
- You want a cross-platform desktop version as fast as possible
- You want to reuse as much of the web UI as possible
- You can accept a larger installer and memory footprint

## 4. Option 2: Tauri + web UI + Rust backend + native FFmpeg

### 4.1 Stack

- UI: React / Vue / Svelte
- Desktop shell: Tauri
- Backend: Rust
- Image processing: image, imageproc, an OpenCV Rust binding, a libvips binding
- Face landmarks: a MediaPipe sidecar process, ONNX Runtime, OpenCV
- Video export: native FFmpeg

### 4.2 How it works

The UI uses web technology while the core capabilities live in the Rust backend. Rust handles files, caching, task scheduling, image processing, and calling FFmpeg.

### 4.3 Pros

- The installer is usually smaller than Electron's
- Lower memory usage
- A Rust backend suits high-performance batch processing
- The local security boundary is easier to control
- The UI can still reuse part of the web version's code
- Matches the "local, lightweight, private" character of the product

### 4.4 Cons

- Higher development complexity than Electron
- The Rust ecosystem is less direct than Python or JS for face landmarks
- Integrating MediaPipe, ONNX, or OpenCV has a meaningful engineering barrier
- Differences between system WebViews can cause UI compatibility problems
- The team needs both front-end and Rust skills

### 4.5 When it fits

- You want the product to feel lighter and more native
- The team has Rust capability
- You are willing to spend more engineering effort on performance and bundle size
- You want a high-quality local tool for the long term

## 5. Option 3: Python + Qt/PySide + OpenCV/MediaPipe + FFmpeg

### 5.1 Stack

- UI: PySide6 / PyQt
- EXIF: Pillow, exifread, piexif
- Image processing: OpenCV, Pillow, NumPy
- Face landmarks: MediaPipe Python, OpenCV, dlib, InsightFace
- Video export: FFmpeg or OpenCV VideoWriter
- Packaging: PyInstaller, Briefcase, Nuitka

### 5.2 How it works

The whole application is written mainly in Python. The UI uses Qt, while image processing, model inference, and video generation all happen on the Python side.

### 5.3 Pros

- Extremely high velocity for algorithm development
- OpenCV, MediaPipe, NumPy, and Pillow form a mature ecosystem
- Very well suited to quickly validating the face alignment algorithm
- Calling FFmpeg is simple
- Very friendly for technical prototypes and internal tools

### 5.4 Cons

- Packaging and cross-platform distribution are full of pitfalls
- The installer may be very large
- The UI usually feels less polished than a web UI or a native UI
- Packaging the Python runtime, models, OpenCV, and FFmpeg together gets heavy
- macOS signing and notarization, and Windows antivirus false positives, both need handling

### 5.5 When it fits

- You want an algorithm validation build or an internal test build first
- The team knows Python/CV
- Processing capability matters more than UI polish
- The algorithm core may be ported to another client later

## 6. Option 4: Flutter Desktop + native plugins + FFmpeg

### 6.1 Stack

- UI: Flutter
- Business logic: Dart
- Native plugins: Swift/Kotlin/C++/Rust
- Image processing: OpenCV, a native image library, or a Rust/C++ module
- Face landmarks: MediaPipe, ML Kit, ONNX Runtime, or platform-native capabilities
- Video export: FFmpeg Kit, native FFmpeg, or a platform encoder

### 6.2 How it works

Flutter handles the cross-platform UI, and heavy computation is implemented via native plugins. Well suited to covering both desktop and mobile in the future.

### 6.3 Pros

- Good UI experience with strong cross-platform consistency
- Extending to iOS/Android later is more natural
- Performance is more controllable than an Electron UI
- Well suited to a consumer-grade application

### 6.4 Cons

- The desktop ecosystem is less mature than the mobile one
- Face detection, FFmpeg, file permissions, and more all need plugin work
- Developing complex native plugins is costly
- Little ability to reuse the web version's code

### 6.5 When it fits

- You definitely plan a mobile app later
- The team knows Flutter
- You want a polished, cross-platform-consistent UI
- You are willing to invest in native plugin development

## 7. Option 5: native macOS app — Swift/SwiftUI + Vision + AVFoundation

### 7.1 Stack

- UI: SwiftUI / AppKit
- EXIF: ImageIO
- Faces and eyes: Apple Vision
- Image processing: Core Image / Metal
- Video export: AVFoundation

### 7.2 How it works

The macOS version is built entirely on Apple's native frameworks: Vision for face and landmark detection, Core Image/Metal for image processing, and AVFoundation for video export.

### 7.3 Pros

- The best experience on macOS
- Excellent performance
- A relatively manageable installer size
- Stable system frameworks, with no need to bundle large models
- Strong video export and hardware acceleration
- The privacy story is very natural

### 7.4 Cons

- Covers only Apple platforms
- Windows users cannot use it
- Going cross-platform later is expensive
- Requires native Apple development skills

### 7.5 When it fits

- Your first users are mainly Mac users
- You are after a high-quality experience
- You are willing to build a single-platform, high-craft tool first

## 8. Option 6: native Windows app — .NET/WPF/WinUI + OpenCV/ONNX + FFmpeg

### 8.1 Stack

- UI: WPF / WinUI 3
- Business logic: C#
- Image processing: OpenCVSharp, ImageSharp
- Face landmarks: ONNX Runtime, OpenCV, a MediaPipe sidecar process
- Video export: FFmpeg or Media Foundation

### 8.2 Pros

- A good native Windows experience
- Mature file system, hardware encoding, and installer capabilities
- C# is fairly efficient for desktop applications
- Stable for Windows users

### 8.3 Cons

- Covers only Windows
- A separate macOS version is needed
- The UI and algorithm ecosystems are less flexible than Python's
- Little reuse of the web version's code

### 8.4 When it fits

- Your target users are mainly on Windows
- The team knows .NET
- You want a Windows-only tool

## 9. Option 7: C++ / Qt + OpenCV + FFmpeg

### 9.1 Stack

- UI: Qt Widgets / Qt Quick
- Image processing: OpenCV
- Face landmarks: MediaPipe C++, dlib, ONNX Runtime, OpenCV
- Video export: FFmpeg

### 9.2 Pros

- Strong performance
- Mature cross-platform support
- Very direct for image and video processing
- The highest degree of control
- Suited to a professional-grade tool

### 9.3 Cons

- High development cost
- Slow UI iteration
- High engineering complexity
- Probably too heavy for a small free tool

### 9.4 When it fits

- You need a professional local tool for the long term
- The team has C++/Qt experience
- Performance and stability requirements are extremely high

## 10. Recommendations for the core modules

### 10.1 Face landmark detection

Recommended, in order:

1. MediaPipe Face Landmarker
2. Apple Vision, for a native macOS/iOS approach
3. ONNX Runtime plus a face landmark model
4. OpenCV/dlib, as a fallback or for prototyping

### 10.2 Video export

Recommended:

- Cross-platform desktop: native FFmpeg
- Native macOS: AVFoundation
- Native Windows: FFmpeg or Media Foundation

A desktop app should no longer prefer ffmpeg.wasm. Native FFmpeg is better on speed, stability, and format support.

### 10.3 Image processing

Recommended:

- Python prototype: OpenCV + NumPy
- Electron: sharp + OpenCV/ONNX
- Tauri/Rust: image/imageproc + an OpenCV/libvips binding
- macOS: Core Image / Metal
- C++: OpenCV

### 10.4 Saving projects

A local app is better suited than the web to supporting saved projects.

Worth saving:

- The original photo paths, or imported copies
- Each photo's EXIF time
- Face boxes and eye landmarks
- The target person the user picked
- Manually corrected points
- The ordering
- The export settings

## 11. Comparison table

| Option | Dev velocity | Performance | Bundle size | Cross-platform | UI experience | Algorithm convenience | Recommended stage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Electron + Node | High | Medium | Large | Strong | Strong | Medium | Desktop MVP |
| Tauri + Rust | Medium | High | Small | Strong | Strong | Medium-low | Long-term local version |
| Python + Qt | High | Medium-high | Large | Medium | Medium | Very high | Algorithm prototype |
| Flutter Desktop | Medium | Medium-high | Medium | Strong | Strong | Medium | Desktop + mobile path |
| Native macOS | Medium | Very high | Small | Weak | Very strong | Medium | Mac flagship version |
| Native Windows | Medium | High | Medium | Weak | Strong | Medium | Windows-only version |
| C++/Qt | Low | Very high | Medium | Strong | Medium | High | Professional long-term version |

## 12. Recommended paths

### 12.1 If you want a local app MVP as fast as possible

Recommended:

> Electron + React + Node.js + MediaPipe/ONNX + native FFmpeg

Why:

- Reuses the most from the web approach
- The fastest to develop
- The UI can be made quite good
- Local FFmpeg solves export performance and stability
- Well suited to shipping a small free tool quickly

### 12.2 If you want a lightweight, high-quality, long-maintained local app

Recommended:

> Tauri + React/Vue + a Rust backend + native FFmpeg + ONNX/MediaPipe

Why:

- Lighter
- Better matches the character of a local privacy tool
- Better performance
- A cleaner architecture for the long term

The cost is higher engineering difficulty.

### 12.3 If you want to get the algorithm right first

Recommended:

> Python + PySide6 + OpenCV + MediaPipe + FFmpeg

Why:

- The fastest way to validate the algorithm
- The most convenient for debugging face points, alignment parameters, and video generation
- Very well suited to building an internal tool first

But it should not be shipped directly as the final consumer product unless you can accept the packaging and UI polish problems.

### 12.4 If your first users are mainly Mac users

Recommended:

> SwiftUI + Vision + Core Image + AVFoundation

Why:

- The best experience
- Strong performance
- No need to bundle large models or FFmpeg
- Matches the macOS story about privacy and local photo processing very well

The downside is that it does not cover Windows.

## 13. Overall conclusion

For a local app version, there are two realistic paths:

1. The fast product path: Electron + Node.js + native FFmpeg
2. The long-term flagship path: Tauri + Rust + native FFmpeg

If the project is still validating product value, prefer Electron.  
If you have already decided to build a lightweight desktop tool for the long term, prefer Tauri.  
If you have not yet validated how well the algorithm works, building an internal prototype in Python first is the fastest route.
