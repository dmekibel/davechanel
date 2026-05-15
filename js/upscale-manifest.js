// Upscale review manifest — one folder per piece, each piece holds its
// source.jpg + v1.jpg / v2.jpg / ... variants. Surfaced in the FS only
// when ?dev=1 is in the URL (see file-system.js). Lets David review
// gpt-image-2 upscale variants via the Image Viewer's existing pan/zoom +
// left/right side buttons.
//
// Hand-maintained for now — regenerate by re-running the copy step in
// the chat history when new variants land.

const piece = (name, variantCount) => ({
  name,
  type: "folder",
  icon: "🔬",
  children: [
    {
      name: `${name} — source`,
      type: "file",
      kind: "image",
      src:     `content/images/web/upscales/${name}/source.jpg`,
      preview: `content/images/web/upscales/${name}/source.jpg`,
      thumb:   `content/images/web/upscales/${name}/source.jpg`,
    },
    ...Array.from({ length: variantCount }, (_, i) => ({
      name: `${name} — upscale v${i + 1}`,
      type: "file",
      kind: "image",
      src:     `content/images/web/upscales/${name}/v${i + 1}.jpg`,
      preview: `content/images/web/upscales/${name}/v${i + 1}.jpg`,
      thumb:   `content/images/web/upscales/${name}/v${i + 1}.jpg`,
    })),
  ],
});

// Variant counts per piece — bump when fresh runs land.
export const UPSCALES = [
  piece("IMG_9675", 3),
  piece("IMG_9881", 5),
  piece("IMG_1268", 4),
  piece("IMG_9670", 2),
  piece("IMG_1267", 1),
  // pieces with 0 variants are omitted (IMG_1222, IMG_1270 timed out;
  // IMG_9739 was blocked by kie.ai safety filter)
];
