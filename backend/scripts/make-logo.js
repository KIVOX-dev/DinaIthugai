// Rebuilds a crisp transparent logo from the low-resolution newspaper scan.
//   node scripts/make-logo.js <source.png> <out.png>
// Pipeline: crop -> 4x Lanczos upscale -> alpha matte from luminance -> blur + steep curve (vector-like edges)
// -> un-blend colour from white -> downsample to 2x for smooth anti-aliasing.
const sharp = require("sharp");

const UP = 4;
const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

(async () => {
  const [src, out] = process.argv.slice(2);
  const crop = { left: 380, top: 76, width: 785, height: 160 };
  const up = await sharp(src)
    .extract(crop)
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .toColourspace("srgb")
    .resize(crop.width * UP, crop.height * UP, { kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data: rgb, info } = up;
  const W = info.width, H = info.height, CH = info.channels;
  console.log("channels", CH);

  // alpha matte from "distance from white"
  const matte = Buffer.alloc(W * H);
  for (let i = 0, j = 0; j < W * H; i += CH, j++) {
    const mn = Math.min(rgb[i], rgb[i + 1], rgb[i + 2]);
    matte[j] = Math.round(255 * Math.max(0, Math.min(1, (250 - mn) / 70)));
  }
  // blur the matte, then apply a steep curve: removes stair-steps and gives clean vector-like contours
  const bl = await sharp(matte, { raw: { width: W, height: H, channels: 1 } }).blur(2.2).raw().toBuffer({ resolveWithObject: true });
  const blurred = bl.data, BC = bl.info.channels;
  console.log("blur channels", BC);
  const rgba = Buffer.alloc(W * H * 4);
  for (let j = 0; j < W * H; j++) {
    const a = smoothstep(0.38, 0.62, blurred[j * BC] / 255);
    const i = j * CH, o = j * 4;
    // colour: un-blend against white using the *unsmoothed* coverage so edge pixels keep the ink colour
    const cov = Math.max(matte[j] / 255, 0.001);
    for (let c = 0; c < 3; c++) rgba[o + c] = Math.max(0, Math.min(255, Math.round((rgb[i + c] - 255 * (1 - cov)) / cov)));
    rgba[o + 3] = Math.round(a * 255);
  }
  // 2x output (1570x320): crisp at the 80px display height even on 3x screens
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .resize(crop.width * 2, crop.height * 2, { kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log("logo written", crop.width * 2, "x", crop.height * 2);
})();
