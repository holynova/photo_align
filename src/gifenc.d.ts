declare module 'gifenc' {
  export default function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: { palette?: number[][]; delay?: number; repeat?: number }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(data: Uint8Array | Uint8ClampedArray, maxColors: number, options?: Record<string, unknown>): number[][];
  export function applyPalette(data: Uint8Array | Uint8ClampedArray, palette: number[][], format?: string): Uint8Array;
}
