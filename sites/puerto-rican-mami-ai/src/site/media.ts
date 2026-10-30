export const SITE_MEDIA = {
  reference: 'assets/site/reference.mp4',
  example: 'assets/site/example.mp4',
} as const;
export function mediaUrl(key: string, etag: string) {
  return `/files/${key}?v=${encodeURIComponent(etag.replaceAll('"', ''))}`;
}
export function isSiteMedia(key: string): boolean {
  return key === SITE_MEDIA.reference || key === SITE_MEDIA.example;
}
