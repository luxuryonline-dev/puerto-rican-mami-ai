export const MAX_MOTION_BYTES = 30 * 1024 * 1024;
export const MOTION_PATH = /^\/files\/assets\/motion\/[a-f0-9]{32}\.mp4$/;

/** Read the movie duration instead of trusting client-supplied metadata. */
export function mp4Duration(bytes: Uint8Array): number | null {
  if (bytes.byteLength < 16) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (text(4) !== 'ftyp') return null;
  function find(start: number, end: number, target: string): { start: number; end: number } | null {
    let at = start;
    while (at + 8 <= end) {
      let size = view.getUint32(at);
      let header = 8;
      if (size === 1) {
        if (at + 16 > end) return null;
        const large = view.getBigUint64(at + 8);
        if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        size = Number(large); header = 16;
      } else if (size === 0) size = end - at;
      if (size < header || at + size > end) return null;
      if (text(at + 4) === target) return { start: at + header, end: at + size };
      at += size;
    }
    return null;
  }
  const moov = find(0, bytes.byteLength, 'moov');
  if (!moov) return null;
  const movie = find(moov.start, moov.end, 'mvhd');
  if (!movie) return null;
  const at = movie.start;
  const version = bytes[at];
  if (version !== 0 && version !== 1) return null;
  const scaleAt = at + (version === 1 ? 20 : 12);
  const durationAt = scaleAt + 4;
  if (durationAt + (version === 1 ? 8 : 4) > movie.end) return null;
  const scale = view.getUint32(scaleAt);
  const duration = version === 1 ? Number(view.getBigUint64(durationAt)) : view.getUint32(durationAt);
  const seconds = duration / scale;
  return scale > 0 && Number.isFinite(seconds) && seconds >= 2 && seconds <= 20.05 ? seconds : null;
}
