export type ExportTransition = 'none' | 'fade' | 'slow';

export const EXPORT_FPS = 24;
const BASE_HOLD_SECONDS = 0.5;

export type ExportFramePlan = {
  holdFrames: number;
  transitionFrames: number;
  totalFrames: number;
  frameDurationMs: number;
};

export function getExportFramePlan(photoCount: number, speed: number, transition: ExportTransition): ExportFramePlan {
  const safePhotoCount = Math.max(0, photoCount);
  const safeSpeed = Math.max(0.1, speed);
  const holdFrames = Math.max(3, Math.round((BASE_HOLD_SECONDS * EXPORT_FPS) / safeSpeed));
  const transitionFrames = transition === 'none' ? 0 : transition === 'slow' ? 8 : 4;
  const totalFrames = safePhotoCount * holdFrames + Math.max(0, safePhotoCount - 1) * transitionFrames;

  return {
    holdFrames,
    transitionFrames,
    totalFrames,
    frameDurationMs: Math.round(1000 / EXPORT_FPS)
  };
}

export function getExportDurationSeconds(photoCount: number, speed: number, transition: ExportTransition) {
  const plan = getExportFramePlan(photoCount, speed, transition);
  return plan.totalFrames / EXPORT_FPS;
}
