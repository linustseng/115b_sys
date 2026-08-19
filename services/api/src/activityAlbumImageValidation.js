import sharp from "sharp";

export const ACTIVITY_ALBUM_MAX_IMAGE_BYTES = 15 * 1024 * 1024;
// This caps decoded RGBA memory at roughly 76 MiB.  sharp/libvips enforces the
// same limit before it allocates the decoded image, which is important because
// a small compressed PNG/JPEG can otherwise expand dramatically.
export const ACTIVITY_ALBUM_MAX_IMAGE_PIXELS = 20_000_000;
export const ACTIVITY_ALBUM_MAX_IMAGE_DIMENSION = 10_000;
export const ACTIVITY_ALBUM_ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export async function validateActivityAlbumImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length <= 0 || buffer.length > ACTIVITY_ALBUM_MAX_IMAGE_BYTES) return null;
  try {
    // metadata() identifies the actual format and dimensions; raw().toBuffer()
    // forces a complete decoder pass. Do not replace this with magic/marker
    // checks: those accept truncated JPEGs and fake PNG payloads.
    const image = sharp(buffer, {
      animated: false,
      failOn: "error",
      limitInputPixels: ACTIVITY_ALBUM_MAX_IMAGE_PIXELS,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    const mimeType = metadata.format === "jpeg" ? "image/jpeg" : metadata.format === "png" ? "image/png" : "";
    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);
    if (!mimeType || !width || !height || width > ACTIVITY_ALBUM_MAX_IMAGE_DIMENSION || height > ACTIVITY_ALBUM_MAX_IMAGE_DIMENSION || width * height > ACTIVITY_ALBUM_MAX_IMAGE_PIXELS) return null;
    const decoded = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (decoded.info.width !== width || decoded.info.height !== height || decoded.info.size !== width * height * 4) return null;
    return { mimeType, width, height };
  } catch {
    return null;
  }
}

export function isAcceptedActivityAlbumMime(mimeType) {
  return ACTIVITY_ALBUM_ACCEPTED_MIME_TYPES.has(String(mimeType || "").trim().toLowerCase());
}
