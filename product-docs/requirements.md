# Requirements: portrait photo alignment video tool

## 1. Product overview

This product is a free web tool that requires no sign-in and runs entirely locally. The user uploads a set of portrait photos; the tool detects faces, eye positions, and capture times in the browser, then generates a natural, stable video or GIF of how the person changes over time.

The core of the product is not professional retouching or complex editing. It is to help ordinary users turn photos of one person taken at different times into a natural, good-looking change video with as few steps as possible.

## 2. Positioning

### 2.1 One-line description

Upload several photos of one person and generate a naturally aligned change-over-time video locally.

### 2.2 Target users

- Ordinary users
- People who want to organize photos of themselves, family, or friends across different years
- People who want to create a growth record, a change record, or a commemorative video

### 2.3 Core value

- Photos are processed entirely locally, protecting privacy
- Faces and capture times are detected automatically, lowering the effort required
- The subject's face is stabilized automatically, making the change video feel natural
- The user can make the necessary choices in the special cases that need them
- Free, lightweight, usable the moment it opens

## 3. Product principles

1. Privacy first: photos are not uploaded to a server, no account is created, and no user data is stored long term.
2. Simplicity first: aimed at ordinary users, avoiding the complex parameters of professional editing software.
3. Naturalness first: by default, aim for a video that looks natural rather than mechanically pinning the eyes in place.
4. Interrupt the user rarely: only ask the user to choose when the system cannot decide reliably.
5. Results-oriented: the user's main goal is to get a shareable video or GIF quickly.

## 4. Use cases

### 4.1 Growth record

The user uploads photos of one person from childhood to the present, and the tool sorts them chronologically and generates a growth video.

### 4.2 Change record

The user uploads photos of themselves or a friend from different years and different stages of life, and generates a change-over-time video.

### 4.3 Commemorative video

The user gathers a person's historical photos and generates a short video suitable for keeping or sharing.

## 5. MVP scope

### 5.1 Photo upload

The user can upload a set of photos on the page.

Basic requirements:

- Support batch selection and drag-and-drop upload
- The first version supports at most 100 photos
- The first version prioritizes JPG and PNG
- HEIC can come later as an enhancement
- The upload page states clearly that photos are processed locally and are never uploaded

### 5.2 Local photo analysis

The tool performs analysis in the browser.

What is analyzed:

- Read the photo's capture time
- Detect faces in the photo
- Detect the eye positions of the target face
- Determine whether the photo contains more than one person
- Determine whether photo quality might affect the result

Capture time rules:

- Prefer the EXIF capture time
- If there is no EXIF time, mark the photo as "missing a date"
- The user can fill in the date manually
- The user can also choose to order photos by upload order

### 5.3 Face and eye alignment

The system aligns photos using the face and eye landmarks.

The default is "natural stabilization mode":

- The face center stays as stable as possible
- Eye positions stay roughly stable
- Rotation, scale, and translation are handled automatically
- Detection error is smoothed to avoid a jittery picture
- Fairly natural changes in head pose and composition are preserved

An advanced mode can offer "strict eye alignment":

- The two eye points are the primary reference
- The left and right eye positions are made to coincide across all photos as closely as possible
- Suited to users who want to observe facial change more explicitly

### 5.4 Handling problem photos

The system surfaces only the photos that need a decision from the user.

Cases that need the user:

- More than one person detected in a photo
- No capture time could be read
- No face detected
- Eyes not detected reliably
- Issues that may affect the result, such as a profile view, blur, or a face that is too small

Actions available to the user:

- Pick the target person in a group photo
- Fill in a date for a photo
- Skip a photo
- Correct the eye positions by hand
- Accept the system's note and continue

### 5.5 Photo quality score

After analyzing each photo, the system gives a simple status the user can understand.

Suggested statuses:

- Looks great
- Usable
- May jitter
- Replace this one
- No face found

Purpose of scoring:

- Help the user understand why some photos do not work well
- Reduce confusion about the algorithm's results
- Guide the user toward replacing a photo with a better one

### 5.6 Timeline ordering

Photos are sorted by capture time by default.

Requirements:

- The user can view the sorted photo timeline
- The user can reorder photos manually
- Photos missing a date need the user to confirm how to handle them

### 5.7 Video preview

The user can see a preview of the result before exporting.

The preview page contains:

- The video preview area
- The photo timeline
- Export settings
- Notices about problem photos

### 5.8 Export settings

The first version offers only a few key settings.

The settings are:

- Output format: MP4, GIF
- Aspect ratio: 1:1, 4:5, 9:16, 16:9
- Playback speed: slow, standard, fast, or a slider
- Date display: on, off
- Transition: none, subtle crossfade, slow blend
- Framing: close-up face, hair and shoulders, keep the original composition as much as possible
- Alignment mode: natural stabilization, strict eye alignment

Export priority:

- First priority: MP4
- Second priority: GIF

Why:

- MP4 files are smaller
- Color and image quality are better
- Better suited to sharing on social platforms and in chat apps

## 6. Recommended user flow

### 6.1 Upload page

Page goal: let the user start quickly.

Main content:

- The batch upload entry point
- The local privacy statement
- Supported formats and photo count

Suggested copy:

> Upload several photos of one person and generate a naturally aligned change video locally.

### 6.2 Analysis page

Page goal: let the user understand that the system is processing photos.

Processing steps:

- Read photo metadata
- Detect faces
- Detect eyes
- Sort by time
- Generate the preview

### 6.3 Needs-confirmation page

Page goal: handle only the problems the system cannot decide on its own.

What is shown:

- Pick the target person for group photos
- Fill in a time for photos missing a date
- Skip or manually correct photos where detection failed
- Notices for low-quality photos

### 6.4 Preview and edit page

Page goal: let the user reach a satisfying result quickly.

Page structure:

- Left or top: the video preview
- Right or bottom: the settings
- Bottom: the photo timeline

The user can adjust:

- Speed
- Aspect ratio
- Date display
- Transition
- Framing
- Alignment mode

### 6.5 Export page

Page goal: produce the final result.

Features:

- Choose MP4 or GIF
- Show export progress
- Offer a download when it finishes

## 7. Out of scope

The first version explicitly does not include:

- An account system
- Cloud upload or cloud processing
- A social community
- A complex template marketplace
- A music library
- Beauty filters
- Face swapping
- Age prediction
- Automatically determining whether every photo is the same person
- Professional frame-by-frame editing
- Large libraries of caption, sticker, and filter templates

## 8. Suggested technical direction

### 8.1 Application form

The first version should be a pure front-end web tool.

Why:

- It matches the fully-local privacy positioning
- Deployment is simple
- The user just opens a web page
- No accounts or server storage are needed

### 8.2 Front-end capabilities that may be used

Technical directions worth evaluating:

- EXIF reading: to obtain the capture time
- An in-browser face detection model: to detect faces and eye landmarks
- Canvas: for cropping, rotation, scaling, and preview
- WebCodecs or ffmpeg.wasm: to generate video locally
- A GIF encoding library: to export GIFs

### 8.3 Key technical risks

- Processing 100 high-resolution photos in the browser puts significant pressure on performance and memory
- HEIC support may be complicated on the web
- Varying face angles, occlusion, and low-resolution photos all degrade eye detection
- Local video encoding may take a long time
- GIF files may be large and limited in quality

## 9. Success criteria

The first version can be judged successful by these criteria:

- The user can complete a generation without signing in
- 30 ordinary portrait photos can be analyzed in an acceptable amount of time
- Both eyes are detected automatically in most front-facing photos
- Multi-person, missing-time, and failed-detection cases are clearly surfaced
- The user can produce an MP4 within 3 to 5 minutes
- The default result looks natural, with no obvious mechanical jitter
- The user knows their photos were not uploaded, and the sense of privacy is clear

## 10. Future enhancements

Worth considering once the MVP is validated:

- HEIC support
- Finer manual eye correction
- Bulk quality filtering
- More natural motion smoothing
- More date styles
- Blurred background fill
- Saving and restoring a local project
- Higher quality video export
- A better mobile experience

## 11. Open questions

The following still need to be settled:

1. Must the first version support HEIC, or is JPG and PNG enough to start?
2. Should strict eye alignment ship as an advanced option?
3. Should the manual eye-marking entry point appear only when detection fails?
4. Must the first version export GIF, or should it focus on MP4 first?
5. Should the default video duration be computed automatically from the photo count, or should the user set the speed explicitly?
6. Do we need to support taking a photo directly or picking from the camera roll on mobile?
7. Do we need a stronger "your photos are never uploaded" notice on the page?
