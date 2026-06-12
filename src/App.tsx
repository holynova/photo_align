import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import exifr from 'exifr';
import GIFEncoder, { applyPalette, quantize } from 'gifenc';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileImage,
  Film,
  Github,
  Loader2,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Users
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PhotoStatus = 'queued' | 'ready' | 'needs-review' | 'failed';
type Score = '效果很好' | '可以使用' | '可能跳动' | '建议替换' | '无法识别';
type Aspect = '1:1' | '4:5' | '9:16' | '16:9';
type CropMode = 'face' | 'shoulders' | 'original';
type AlignMode = 'natural' | 'strict';
type TransitionMode = 'none' | 'fade' | 'slow';
type ExportFormat = 'mp4' | 'gif';

type Point = { x: number; y: number };

type FaceCandidate = {
  id: number;
  box: { x: number; y: number; width: number; height: number };
  leftEye: Point;
  rightEye: Point;
  confidence: number;
  landmarks: NormalizedLandmark[];
};

type PhotoItem = {
  id: string;
  file: File;
  url: string;
  name: string;
  dateText: string;
  manualDate: string;
  status: PhotoStatus;
  score: Score;
  warning: string;
  width: number;
  height: number;
  faces: FaceCandidate[];
  selectedFace: number;
  skipped: boolean;
};

type RenderSettings = {
  aspect: Aspect;
  speed: number;
  showDate: boolean;
  transition: TransitionMode;
  cropMode: CropMode;
  alignMode: AlignMode;
  format: ExportFormat;
};

type DemoManifest = {
  photos: Array<{
    name: string;
    url: string;
    date: string;
  }>;
};

const MAX_PHOTOS = 100;
const REPO_URL = 'https://github.com/holynova/photo_align';

const imageLeftEyeIndices = [33, 133, 159, 145, 153, 154, 155, 173];
const imageRightEyeIndices = [362, 263, 386, 374, 380, 381, 382, 398];
const DETECTION_MAX_SIZE = 1280;

const defaultSettings: RenderSettings = {
  aspect: '4:5',
  speed: 1.2,
  showDate: true,
  transition: 'fade',
  cropMode: 'shoulders',
  alignMode: 'natural',
  format: 'mp4'
};

function App() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [settings, setSettings] = useState<RenderSettings>(defaultSettings);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisText, setAnalysisText] = useState('等待上传');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [exportState, setExportState] = useState({ running: false, text: '', progress: 0, url: '', extension: 'mp4' });
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const usablePhotos = useMemo(
    () =>
      photos
        .filter((photo) => !photo.skipped && photo.faces[photo.selectedFace])
        .sort((a, b) => getPhotoSortTime(a) - getPhotoSortTime(b)),
    [photos]
  );

  const reviewCount = photos.filter((photo) => photo.status === 'needs-review' && !photo.skipped).length;
  const activePhoto = photos.find((photo) => photo.id === activeId) ?? usablePhotos[0] ?? photos[0];

  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setAnalysisText('加载本地人脸识别模型');
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
    const wasmUrl = new URL('mediapipe/wasm', baseUrl).toString().replace(/\/$/, '');
    const modelUrl = new URL('mediapipe/models/face_landmarker.task', baseUrl).toString();
    const vision = await FilesetResolver.forVisionTasks(wasmUrl);
    const options = {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: 'GPU' as const
      },
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      runningMode: 'IMAGE' as const,
      numFaces: 5
    };
    let landmarker: FaceLandmarker;
    try {
      landmarker = await FaceLandmarker.createFromOptions(vision, options);
    } catch {
      landmarker = await FaceLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate: 'CPU'
        }
      });
    }
    landmarkerRef.current = landmarker;
    return landmarker;
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | File[], dateOverrides = new Map<string, string>()) => {
      const imageFiles = Array.from(fileList)
        .filter((file) => file.type.startsWith('image/'))
        .slice(0, MAX_PHOTOS);

      if (!imageFiles.length) return;

      setExportState({ running: false, text: '', progress: 0, url: '', extension: 'mp4' });
      setIsAnalyzing(true);
      setAnalysisText('准备读取照片');

      const initialItems = await Promise.all(imageFiles.map((file) => createPhotoItem(file, dateOverrides.get(file.name))));
      setPhotos(initialItems);
      setActiveId(initialItems[0]?.id ?? null);

      try {
        const landmarker = await ensureLandmarker();
        const analyzed: PhotoItem[] = [];

        for (let index = 0; index < initialItems.length; index += 1) {
          const item = initialItems[index];
          setAnalysisText(`分析 ${index + 1} / ${initialItems.length}: ${item.name}`);
          const result = await analyzePhoto(item, landmarker);
          analyzed.push(result);
          setPhotos([...analyzed, ...initialItems.slice(index + 1)]);
          await new Promise((resolve) => window.setTimeout(resolve, 12));
        }

        setActiveId(analyzed.find((item) => item.faces[item.selectedFace] && !item.skipped)?.id ?? analyzed[0]?.id ?? null);
        setAnalysisText('分析完成');
      } catch (error) {
        console.error(error);
        setAnalysisText('模型加载或照片分析失败，请刷新后重试');
      } finally {
        setIsAnalyzing(false);
      }
    },
    [ensureLandmarker]
  );

  const loadDemo = useCallback(async () => {
    setAnalysisText('准备 Demo 照片');
    try {
      const demoBaseUrl = new URL('demo/', new URL(import.meta.env.BASE_URL, window.location.origin));
      const response = await fetch(new URL('manifest.json', demoBaseUrl));
      if (!response.ok) throw new Error('Demo manifest not found');
      const manifest = (await response.json()) as DemoManifest;
      const demoPhotos = manifest.photos.slice(0, 30);
      const dateOverrides = new Map<string, string>();
      const files = await Promise.all(
        demoPhotos.map(async (photo) => {
          const imageResponse = await fetch(new URL(photo.url, demoBaseUrl));
          if (!imageResponse.ok) throw new Error(`Cannot load demo photo ${photo.name}`);
          const blob = await imageResponse.blob();
          const type = blob.type || getImageMimeType(photo.name);
          dateOverrides.set(photo.name, photo.date);
          return new File([blob], photo.name, { type, lastModified: new Date(photo.date).getTime() });
        })
      );
      await handleFiles(files, dateOverrides);
    } catch (error) {
      console.error(error);
      setAnalysisText('Demo 加载失败，请检查 demo/manifest.json');
    }
  }, [handleFiles]);

  const renderPreview = useCallback(async () => {
    if (!previewCanvasRef.current || !activePhoto) return;
    await renderAlignedFrame(previewCanvasRef.current, activePhoto, settings);
  }, [activePhoto, settings]);

  useEffect(() => {
    void renderPreview();
  }, [renderPreview]);

  const updatePhoto = (id: string, updater: (photo: PhotoItem) => PhotoItem) => {
    setPhotos((current) => current.map((photo) => (photo.id === id ? updater(photo) : photo)));
  };

  const resetAll = () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos([]);
    setActiveId(null);
    setExportState({ running: false, text: '', progress: 0, url: '', extension: 'mp4' });
    setAnalysisText('等待上传');
  };

  const exportVideo = async () => {
    if (!usablePhotos.length) return;
    setExportState({ running: true, text: '准备渲染帧', progress: 0, url: '', extension: settings.format });

    try {
      const frames = await buildFrames(usablePhotos, settings, (progress) => {
        setExportState((state) => ({ ...state, text: `渲染帧 ${Math.round(progress * 100)}%`, progress: progress * 0.45 }));
      });
      const output =
        settings.format === 'gif'
          ? {
              url: encodeGif(frames, settings, (progress, text) => {
                setExportState((state) => ({ ...state, text, progress: 0.45 + progress * 0.55 }));
              }),
              extension: 'gif'
            }
          : await encodeVideoWithMediaRecorder(frames, (progress, text) => {
              setExportState((state) => ({ ...state, text, progress: 0.45 + progress * 0.55 }));
            });
      setExportState({ running: false, text: '导出完成', progress: 1, url: output.url, extension: output.extension });
    } catch (error) {
      console.error(error);
      setExportState({ running: false, text: '导出失败，可能是浏览器内存不足或编码器不可用', progress: 0, url: '', extension: settings.format });
    }
  };

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">本地隐私工具</p>
          <h1>人像时间线</h1>
        </div>
        <div className="privacy-pill">
          <ShieldCheck size={18} />
          照片只在本机处理
        </div>
        <a className="repo-link" href={REPO_URL} target="_blank" rel="noreferrer">
          <Github size={18} />
          GitHub
        </a>
      </section>

      {photos.length === 0 ? (
        <UploadPanel onFiles={handleFiles} onLoadDemo={loadDemo} isAnalyzing={isAnalyzing} />
      ) : (
        <section className="workspace">
          <div className="preview-column">
            <div className="preview-head">
              <div>
                <p className="eyebrow">预览</p>
                <h2>{activePhoto?.name ?? '对齐结果'}</h2>
              </div>
              <button className="icon-button" onClick={resetAll} title="重新上传">
                <RotateCcw size={18} />
              </button>
            </div>
            <div className="canvas-wrap">
              <canvas ref={previewCanvasRef} width={900} height={1125} />
            </div>
            <div className="status-row">
              {isAnalyzing ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
              <span>{analysisText}</span>
            </div>
          </div>

          <aside className="side-panel">
            <section className="panel-section">
              <div className="section-title">
                <SlidersHorizontal size={18} />
                <h3>生成设置</h3>
              </div>
              <ControlGroup label="画幅">
                {(['1:1', '4:5', '9:16', '16:9'] as Aspect[]).map((aspect) => (
                  <button
                    key={aspect}
                    className={settings.aspect === aspect ? 'seg active' : 'seg'}
                    onClick={() => setSettings({ ...settings, aspect })}
                  >
                    {aspect}
                  </button>
                ))}
              </ControlGroup>
              <label className="field">
                <span>速度</span>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={settings.speed}
                  onChange={(event) => setSettings({ ...settings, speed: Number(event.target.value) })}
                />
                <strong>{settings.speed.toFixed(1)}x</strong>
              </label>
              <ControlGroup label="过渡">
                {[
                  ['none', '无'],
                  ['fade', '轻微'],
                  ['slow', '融合']
                ].map(([transition, label]) => (
                  <button
                    key={transition}
                    className={settings.transition === transition ? 'seg active' : 'seg'}
                    onClick={() => setSettings({ ...settings, transition: transition as TransitionMode })}
                  >
                    {label}
                  </button>
                ))}
              </ControlGroup>
              <ControlGroup label="保留">
                {[
                  ['face', '脸部'],
                  ['shoulders', '头肩'],
                  ['original', '构图']
                ].map(([cropMode, label]) => (
                  <button
                    key={cropMode}
                    className={settings.cropMode === cropMode ? 'seg active' : 'seg'}
                    onClick={() => setSettings({ ...settings, cropMode: cropMode as CropMode })}
                  >
                    {label}
                  </button>
                ))}
              </ControlGroup>
              <ControlGroup label="对齐">
                {[
                  ['natural', '自然'],
                  ['strict', '严格']
                ].map(([alignMode, label]) => (
                  <button
                    key={alignMode}
                    className={settings.alignMode === alignMode ? 'seg active' : 'seg'}
                    onClick={() => setSettings({ ...settings, alignMode: alignMode as AlignMode })}
                  >
                    {label}
                  </button>
                ))}
              </ControlGroup>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.showDate}
                  onChange={(event) => setSettings({ ...settings, showDate: event.target.checked })}
                />
                <span>显示日期</span>
              </label>
            </section>

            <section className="panel-section">
              <div className="section-title">
                <Film size={18} />
                <h3>导出</h3>
              </div>
              <ControlGroup label="格式">
                {(['mp4', 'gif'] as ExportFormat[]).map((format) => (
                  <button
                    key={format}
                    className={settings.format === format ? 'seg active' : 'seg'}
                    onClick={() => setSettings({ ...settings, format })}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </ControlGroup>
              <button className="primary-button" disabled={exportState.running || !usablePhotos.length} onClick={exportVideo}>
                {exportState.running ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
                生成文件
              </button>
              {exportState.text && (
                <div className="export-box">
                  <div className="progress-track">
                    <span style={{ width: `${Math.round(exportState.progress * 100)}%` }} />
                  </div>
                  <p>{exportState.text}</p>
                  {exportState.url && (
                    <>
                      <div className="result-preview">
                        {exportState.extension === 'gif' ? (
                          <img src={exportState.url} alt="导出结果预览" />
                        ) : (
                          <video src={exportState.url} controls playsInline />
                        )}
                      </div>
                      <a href={exportState.url} download={`face-timeline.${exportState.extension}`} className="download-link">
                        下载结果
                      </a>
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="panel-section stats">
              <p>
                <FileImage size={16} />
                {photos.length} 张照片
              </p>
              <p>
                <Eye size={16} />
                {usablePhotos.length} 张可用
              </p>
              <p className={reviewCount ? 'warn' : ''}>
                <AlertTriangle size={16} />
                {reviewCount} 张待确认
              </p>
            </section>
          </aside>
        </section>
      )}

      {photos.length > 0 && (
        <PhotoTimeline photos={photos} activeId={activePhoto?.id ?? ''} onSelect={setActiveId} onUpdate={updatePhoto} />
      )}
    </main>
  );
}

function UploadPanel({
  onFiles,
  onLoadDemo,
  isAnalyzing
}: {
  onFiles: (files: FileList | File[]) => void;
  onLoadDemo: () => void;
  isAnalyzing: boolean;
}) {
  return (
    <section
      className="upload-panel"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFiles(event.dataTransfer.files);
      }}
    >
      <div className="upload-icon">
        <Upload size={34} />
      </div>
      <h2>上传一组人物照片</h2>
      <p>最多 100 张，支持 JPG / PNG。原型会在浏览器本地识别人脸、读取日期并生成对齐视频。</p>
      <div className="upload-actions">
        <button className="primary-button" type="button" onClick={onLoadDemo} disabled={isAnalyzing}>
          {isAnalyzing ? <Loader2 className="spin" size={18} /> : <Eye size={18} />}
          查看 Demo
        </button>
        <label className="secondary-button file-button">
          <Upload size={18} />
          选择照片
          <input type="file" accept="image/*" multiple onChange={(event) => event.target.files && onFiles(event.target.files)} />
        </label>
      </div>
      <div className="upload-notes">
        <span>
          <ShieldCheck size={16} /> 不上传服务器
        </span>
        <span>
          <Users size={16} /> 多人照片可选择主角
        </span>
        <span>
          <Calendar size={16} /> 自动读取拍摄时间
        </span>
      </div>
    </section>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="control-group">
      <span>{label}</span>
      <div className="segments">{children}</div>
    </div>
  );
}

function PhotoTimeline({
  photos,
  activeId,
  onSelect,
  onUpdate
}: {
  photos: PhotoItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updater: (photo: PhotoItem) => PhotoItem) => void;
}) {
  return (
    <section className="timeline">
      {photos.map((photo) => (
        <article key={photo.id} className={photo.id === activeId ? 'thumb active' : 'thumb'} onClick={() => onSelect(photo.id)}>
          <div className="thumb-image">
            <img src={photo.url} alt={photo.name} />
            {photo.faces.map((face) => (
              <button
                key={face.id}
                className={photo.selectedFace === face.id ? 'face-box selected' : 'face-box'}
                style={{
                  left: `${face.box.x * 100}%`,
                  top: `${face.box.y * 100}%`,
                  width: `${face.box.width * 100}%`,
                  height: `${face.box.height * 100}%`
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdate(photo.id, (item) => ({ ...item, selectedFace: face.id, status: item.dateText ? 'ready' : 'needs-review' }));
                }}
                title="选择这个人"
              />
            ))}
          </div>
          <div className="thumb-body">
            <strong>{photo.score}</strong>
            <span>{photo.warning || photo.dateText || '缺少日期'}</span>
            <input
              type="date"
              value={photo.manualDate}
              onInput={(event) =>
                onUpdate(photo.id, (item) => ({
                  ...item,
                  manualDate: event.currentTarget.value,
                  dateText: event.currentTarget.value || item.dateText,
                  status: item.faces.length ? 'ready' : item.status
                }))
              }
              onChange={(event) =>
                onUpdate(photo.id, (item) => ({
                  ...item,
                  manualDate: event.target.value,
                  dateText: event.target.value || item.dateText,
                  status: item.faces.length ? 'ready' : item.status
                }))
              }
              onClick={(event) => event.stopPropagation()}
            />
            <label className="mini-toggle" onClick={(event) => event.stopPropagation()}>
              <input
                type="checkbox"
                checked={photo.skipped}
                onChange={(event) => onUpdate(photo.id, (item) => ({ ...item, skipped: event.target.checked }))}
              />
              跳过
            </label>
          </div>
        </article>
      ))}
    </section>
  );
}

async function createPhotoItem(file: File, dateOverride = ''): Promise<PhotoItem> {
  const url = URL.createObjectURL(file);
  const image = await loadImage(url);
  const dateText = dateOverride || (await readExifDate(file));
  return {
    id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    url,
    name: file.name,
    dateText,
    manualDate: toDateInputValue(dateText),
    status: 'queued',
    score: '可以使用',
    warning: dateText ? '' : '缺少拍摄时间',
    width: image.naturalWidth,
    height: image.naturalHeight,
    faces: [],
    selectedFace: 0,
    skipped: false
  };
}

function getImageMimeType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function analyzePhoto(item: PhotoItem, landmarker: FaceLandmarker): Promise<PhotoItem> {
  const image = await loadImage(item.url);
  const detectionSource = prepareDetectionSource(image);
  const result = landmarker.detect(detectionSource);
  const faces = (result.faceLandmarks ?? []).map((landmarks, id) => createFaceCandidate(id, landmarks));
  const hasDate = Boolean(item.dateText);

  if (!faces.length) {
    return {
      ...item,
      status: 'failed',
      score: '无法识别',
      warning: '没有检测到人脸'
    };
  }

  const selectedFace = faces.reduce((best, face) => (face.box.width * face.box.height > faces[best].box.width * faces[best].box.height ? face.id : best), 0);
  const chosen = faces[selectedFace];
  const faceSize = Math.max(chosen.box.width, chosen.box.height);
  const eyeDistance = distance(chosen.leftEye, chosen.rightEye);
  const eyeAngle = Math.atan2(chosen.rightEye.y - chosen.leftEye.y, chosen.rightEye.x - chosen.leftEye.x);
  const sideAngle = Math.abs(normalizeAngle(eyeAngle));

  let score: Score = '效果很好';
  let warning = item.warning;
  if (faces.length > 1) warning = '检测到多个人，请选择主角';
  if (!hasDate) warning = warning || '缺少拍摄时间';
  if (chosen.confidence < 0.28 || faceSize < 0.1 || eyeDistance < 0.025) {
    score = '建议替换';
    warning = '眼睛关键点不稳定，建议换更清晰的正脸照片';
  } else if (faceSize < 0.18 || eyeDistance < 0.05) {
    score = '可以使用';
    warning = warning || '脸部较小，已使用高分辨率检测';
  } else if (sideAngle > 0.35) {
    score = '可能跳动';
    warning = warning || '脸部角度较大';
  } else if (faces.length > 1 || !hasDate) {
    score = '可以使用';
  }

  return {
    ...item,
    faces,
    selectedFace,
    score,
    warning,
    status: faces.length > 1 || !hasDate ? 'needs-review' : 'ready'
  };
}

function createFaceCandidate(id: number, landmarks: NormalizedLandmark[]): FaceCandidate {
  let leftEye = averageLandmarks(landmarks, imageLeftEyeIndices);
  let rightEye = averageLandmarks(landmarks, imageRightEyeIndices);
  if (leftEye.x > rightEye.x) {
    [leftEye, rightEye] = [rightEye, leftEye];
  }
  const minX = Math.min(...landmarks.map((point) => point.x));
  const minY = Math.min(...landmarks.map((point) => point.y));
  const maxX = Math.max(...landmarks.map((point) => point.x));
  const maxY = Math.max(...landmarks.map((point) => point.y));
  const eyeDistance = distance(leftEye, rightEye);
  const eyeLevel = Math.abs(leftEye.y - rightEye.y);
  const inBounds = [leftEye, rightEye].every((point) => point.x > 0 && point.x < 1 && point.y > 0 && point.y < 1);
  const confidence = clamp((eyeDistance / 0.065) * (1 - Math.min(0.7, eyeLevel * 2.2)) * (inBounds ? 1 : 0.25), 0, 1);
  return {
    id,
    landmarks,
    leftEye,
    rightEye,
    confidence,
    box: {
      x: clamp(minX, 0, 1),
      y: clamp(minY, 0, 1),
      width: clamp(maxX - minX, 0, 1),
      height: clamp(maxY - minY, 0, 1)
    }
  };
}

function prepareDetectionSource(image: HTMLImageElement) {
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (longestSide <= DETECTION_MAX_SIZE) return image;

  const scale = DETECTION_MAX_SIZE / longestSide;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return image;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function renderAlignedFrame(canvas: HTMLCanvasElement, photo: PhotoItem, settings: RenderSettings, opacity = 1) {
  const size = getCanvasSize(settings.aspect);
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paintBackdrop(ctx, canvas.width, canvas.height);
  await drawPhoto(ctx, canvas, photo, settings, opacity);
}

async function drawPhoto(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  photo: PhotoItem,
  settings: RenderSettings,
  opacity = 1
) {
  const face = photo.faces[photo.selectedFace];
  const image = await loadImage(photo.url);

  if (!face) {
    drawContain(ctx, image, canvas.width, canvas.height, opacity);
    return;
  }

  const left = toPixels(face.leftEye, image);
  const right = toPixels(face.rightEye, image);
  const sourceCenter = midpoint(left, right);
  const sourceAngle = Math.atan2(right.y - left.y, right.x - left.x);
  const sourceDistance = Math.max(1, distance(left, right));
  const target = getTargetGeometry(canvas.width, canvas.height, settings.cropMode, settings.alignMode);
  const targetDistance = distance(target.leftEye, target.rightEye);
  const scale = targetDistance / sourceDistance;
  const targetCenter = midpoint(target.leftEye, target.rightEye);
  const angle = settings.alignMode === 'strict' ? -sourceAngle : -sourceAngle * 0.72;
  const naturalNudge = settings.alignMode === 'natural' ? getNaturalNudge(face, image, canvas, scale) : { x: 0, y: 0 };

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(targetCenter.x + naturalNudge.x, targetCenter.y + naturalNudge.y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.translate(-sourceCenter.x, -sourceCenter.y);
  ctx.drawImage(image, 0, 0);
  ctx.restore();

  if (settings.showDate) drawDate(ctx, photo.dateText || photo.manualDate, canvas.width, canvas.height);
}

function getNaturalNudge(face: FaceCandidate, image: HTMLImageElement, canvas: HTMLCanvasElement, scale: number) {
  const faceCenter = {
    x: (face.box.x + face.box.width / 2) * image.naturalWidth,
    y: (face.box.y + face.box.height / 2) * image.naturalHeight
  };
  const eyeCenter = midpoint(toPixels(face.leftEye, image), toPixels(face.rightEye, image));
  return {
    x: (eyeCenter.x - faceCenter.x) * scale * 0.18,
    y: (eyeCenter.y - faceCenter.y) * scale * 0.12 + canvas.height * 0.015
  };
}

async function buildFrames(photos: PhotoItem[], settings: RenderSettings, onProgress: (progress: number) => void) {
  const frames: ImageData[] = [];
  const size = getCanvasSize(settings.aspect);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return frames;

  const holdFrames = Math.max(3, Math.round(10 / settings.speed));
  const transitionFrames = settings.transition === 'none' ? 0 : settings.transition === 'slow' ? 8 : 4;
  const total = photos.length * holdFrames + Math.max(0, photos.length - 1) * transitionFrames;
  let completed = 0;

  for (let index = 0; index < photos.length; index += 1) {
    for (let hold = 0; hold < holdFrames; hold += 1) {
      await renderAlignedFrame(canvas, photos[index], settings);
      frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      completed += 1;
      onProgress(completed / total);
    }

    if (transitionFrames && photos[index + 1]) {
      for (let step = 1; step <= transitionFrames; step += 1) {
        const alpha = step / (transitionFrames + 1);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        paintBackdrop(ctx, canvas.width, canvas.height);
        await drawPhoto(ctx, canvas, photos[index], settings, 1 - alpha);
        await drawPhoto(ctx, canvas, photos[index + 1], settings, alpha);
        frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        completed += 1;
        onProgress(completed / total);
      }
    }
  }

  return frames;
}

function encodeGif(frames: ImageData[], settings: RenderSettings, onProgress: (progress: number, text: string) => void) {
  if (!frames.length) throw new Error('No frames to encode');
  const gif = GIFEncoder({ initialCapacity: 1024 * 1024 });
  const delay = Math.max(35, Math.round(1000 / 18 / settings.speed));

  frames.forEach((frame, index) => {
    const palette = quantize(frame.data, 128, { format: 'rgb444' });
    const bitmap = applyPalette(frame.data, palette, 'rgb444');
    gif.writeFrame(bitmap, frame.width, frame.height, { palette, delay, repeat: 0 });
    onProgress((index + 1) / frames.length, `编码 GIF ${index + 1} / ${frames.length}`);
  });

  gif.finish();
  return URL.createObjectURL(new Blob([gif.bytes()], { type: 'image/gif' }));
}

async function encodeVideoWithMediaRecorder(
  frames: ImageData[],
  onProgress: (progress: number, text: string) => void
): Promise<{ url: string; extension: string }> {
  if (!frames.length) throw new Error('No frames to encode');
  const mimeType = getSupportedVideoMimeType();
  if (!mimeType) throw new Error('MediaRecorder video encoding is not supported');

  const canvas = document.createElement('canvas');
  canvas.width = frames[0].width;
  canvas.height = frames[0].height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  const fps = 24;
  const stream = canvas.captureStream(fps);
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000
  });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('MediaRecorder failed'));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();
  for (let index = 0; index < frames.length; index += 1) {
    ctx.putImageData(frames[index], 0, 0);
    onProgress((index + 1) / frames.length, `编码视频 ${index + 1} / ${frames.length}`);
    await new Promise((resolve) => window.setTimeout(resolve, 1000 / fps));
  }
  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());

  const blob = await done;
  return {
    url: URL.createObjectURL(blob),
    extension: mimeType.includes('mp4') ? 'mp4' : 'webm'
  };
}

function getSupportedVideoMimeType() {
  const candidates = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
}

function getTargetGeometry(width: number, height: number, cropMode: CropMode, alignMode: AlignMode) {
  const ratio = cropMode === 'face' ? 0.46 : cropMode === 'shoulders' ? 0.34 : 0.25;
  const strictBonus = alignMode === 'strict' ? 1.05 : 1;
  const eyeDistance = width * ratio * strictBonus;
  const y = height * (cropMode === 'original' ? 0.42 : cropMode === 'face' ? 0.44 : 0.38);
  return {
    leftEye: { x: width / 2 - eyeDistance / 2, y },
    rightEye: { x: width / 2 + eyeDistance / 2, y }
  };
}

function getCanvasSize(aspect: Aspect) {
  if (aspect === '1:1') return { width: 720, height: 720 };
  if (aspect === '9:16') return { width: 720, height: 1280 };
  if (aspect === '16:9') return { width: 960, height: 540 };
  return { width: 720, height: 900 };
}

function paintBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#000212');
  gradient.addColorStop(0.5, '#080a10');
  gradient.addColorStop(1, '#12131e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.5, 0, 0, width * 0.5, 0, Math.max(width, height) * 0.75);
  glow.addColorStop(0, 'rgba(94, 106, 210, 0.22)');
  glow.addColorStop(1, 'rgba(94, 106, 210, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawContain(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, opacity: number) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
  ctx.restore();
}

function drawDate(ctx: CanvasRenderingContext2D, dateText: string, width: number, height: number) {
  if (!dateText) return;
  ctx.save();
  ctx.font = `600 ${Math.max(22, Math.round(width * 0.035))}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  const label = dateText.slice(0, 10).replace(/-/g, '/');
  const metrics = ctx.measureText(label);
  const padX = 18;
  const boxW = metrics.width + padX * 2;
  const boxH = 46;
  const x = Math.max(24, width * 0.045);
  const y = height - Math.max(40, height * 0.07);
  ctx.fillStyle = 'rgba(8, 10, 16, 0.78)';
  roundRect(ctx, x, y - boxH / 2, boxW, boxH, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.stroke();
  ctx.fillStyle = '#f0f3f6';
  ctx.fillText(label, x + padX, y + 1);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

async function readExifDate(file: File) {
  try {
    const data = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']);
    const value = data?.DateTimeOriginal ?? data?.CreateDate ?? data?.ModifyDate;
    if (value instanceof Date && !Number.isNaN(value.getTime()) && value.getFullYear() >= 1900) {
      return value.toISOString().slice(0, 10);
    }
  } catch {
    return readDateFromFilename(file.name);
  }
  return readDateFromFilename(file.name);
}

function readDateFromFilename(name: string) {
  const match = name.match(/(?:19|20)\d{6}/);
  if (!match) return '';
  const raw = match[0];
  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : `${year}-${month}-${day}`;
}

function toDateInputValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
}

function getPhotoSortTime(photo: PhotoItem) {
  const value = photo.manualDate || photo.dateText;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) && time > 0 ? time : photo.file.lastModified;
}

function averageLandmarks(landmarks: NormalizedLandmark[], indices: number[]) {
  const points = indices.map((index) => landmarks[index]).filter(Boolean);
  if (!points.length) return { x: 0.5, y: 0.5 };
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  };
}

function toPixels(point: Point, image: HTMLImageElement): Point {
  return { x: point.x * image.naturalWidth, y: point.y * image.naturalHeight };
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export default App;
