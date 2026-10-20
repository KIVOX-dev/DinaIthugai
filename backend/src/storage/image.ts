import sharp, { type Metadata } from "sharp";

export type DetectedType = "image/jpeg" | "image/png" | "image/webp";

/** Content-based type detection (file signatures). The filename and client MIME are never trusted. */
export function detectImageType(buf: Buffer): DetectedType | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export class ImageRejected extends Error {
  constructor(public reason: "empty" | "too_large" | "unsupported_type" | "corrupt" | "dimensions", message: string) {
    super(message);
  }
}

export type ProcessedImage = {
  width: number;
  height: number;
  variants: { name: "orig" | "lg" | "md" | "sm" | "thumb"; buffer: Buffer; width: number; height: number }[];
};

const VARIANT_WIDTHS: { name: "orig" | "lg" | "md" | "sm" | "thumb"; width: number }[] = [
  { name: "orig", width: 2400 },
  { name: "lg", width: 1600 },
  { name: "md", width: 1000 },
  { name: "sm", width: 600 },
  { name: "thumb", width: 320 },
];

export async function processImage(
  buf: Buffer,
  opts: { maxBytes: number; maxDimension: number; allowedTypes?: string[] },
): Promise<ProcessedImage> {
  if (buf.length === 0) throw new ImageRejected("empty", "The file is empty.");
  if (buf.length > opts.maxBytes) throw new ImageRejected("too_large", `The file exceeds ${Math.round(opts.maxBytes / 1048576)} MB.`);
  const type = detectImageType(buf);
  if (!type || (opts.allowedTypes && !opts.allowedTypes.includes(type))) {
    throw new ImageRejected("unsupported_type", "Only JPEG, PNG and WebP images are accepted.");
  }
  let meta: Metadata;
  try {
    meta = await sharp(buf, { limitInputPixels: 80_000_000, failOn: "error" }).metadata();
  } catch {
    throw new ImageRejected("corrupt", "The image could not be read. It may be corrupt.");
  }
  const orientedSwap = (meta.orientation ?? 1) >= 5;
  const w = orientedSwap ? meta.height : meta.width;
  const h = orientedSwap ? meta.width : meta.height;
  if (!w || !h || w < 50 || h < 50) throw new ImageRejected("dimensions", "The image is too small.");
  if (w > opts.maxDimension || h > opts.maxDimension) {
    throw new ImageRejected("dimensions", `Images may be at most ${opts.maxDimension}px on the longest side.`);
  }
  const variants: ProcessedImage["variants"] = [];
  try {
    for (const v of VARIANT_WIDTHS) {
      // Re-encoding drops EXIF/GPS and any appended payloads (polyglot protection); rotate() applies EXIF orientation first.
      const { data, info } = await sharp(buf, { limitInputPixels: 80_000_000, failOn: "error" })
        .rotate()
        .resize({ width: v.width, withoutEnlargement: true })
        .webp({ quality: v.name === "thumb" ? 70 : 82 })
        .toBuffer({ resolveWithObject: true });
      variants.push({ name: v.name, buffer: data, width: info.width, height: info.height });
    }
  } catch {
    throw new ImageRejected("corrupt", "The image could not be processed.");
  }
  return { width: w, height: h, variants };
}
