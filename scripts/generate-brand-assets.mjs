import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.resolve(root, process.argv[2] ?? "assets/brand/logo-source.png");
const config = JSON.parse(await readFile(path.join(root, "store.config.json"), "utf8"));
const fontFile = path.join(root, "fonts/Manrope-Bold.ttf");
const padding = 0.08;

async function transparentLogo(input) {
  const meta = await sharp(input).metadata();
  if (meta.hasAlpha) return sharp(input).png().toBuffer();

  const { data: rgb, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: gray } = await sharp(input).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);

  for (let index = 0; index < gray.length; index += 1) {
    const rgbOffset = index * 3;
    const rgbaOffset = index * 4;
    rgba[rgbaOffset] = rgb[rgbOffset];
    rgba[rgbaOffset + 1] = rgb[rgbOffset + 1];
    rgba[rgbaOffset + 2] = rgb[rgbOffset + 2];
    rgba[rgbaOffset + 3] = Math.max(0, Math.min(255, Math.round((240 - gray[index]) * 255 / 240)));
  }

  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function squarePng(input, dimension, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  const trimmed = await sharp(input).trim({ threshold: 1 }).png().toBuffer();
  const inner = Math.round(dimension * (1 - padding * 2));
  const resized = await sharp(trimmed)
    .resize({ width: inner, height: inner, fit: "inside", kernel: "lanczos3" })
    .png()
    .toBuffer();

  return sharp({
    create: { width: dimension, height: dimension, channels: 4, background },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

function icoFromPng(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = header.length + entries.length * 16;
  const directory = entries.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...directory, ...entries.map(({ data }) => data)]);
}

async function renderText(text, size) {
  const rendered = await sharp({
    text: {
      text,
      font: `Manrope ${size}`,
      fontfile: fontFile,
      rgba: true,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });

  const data = await sharp(rendered.data).negate({ alpha: false }).png().toBuffer();
  return { data, width: rendered.info.width, height: rendered.info.height };
}

async function ogImage() {
  const tile = Buffer.from(
    '<svg width="180" height="180" xmlns="http://www.w3.org/2000/svg"><rect width="180" height="180" rx="40" fill="#ffffff"/></svg>',
  );
  const logo = await squarePng(await transparentLogo(sourcePath), 128);
  const title = await renderText(config.name, 64);
  const slogan = await renderText(config.slogan, 32);

  return sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      { input: tile, left: 510, top: 115 },
      { input: logo, left: 536, top: 141 },
      { input: title.data, left: Math.round((1200 - title.width) / 2), top: 345 },
      { input: slogan.data, left: Math.round((1200 - slogan.width) / 2), top: 420 },
    ])
    .png()
    .toBuffer();
}

async function main() {
  const cleaned = await transparentLogo(sourcePath);

  const logo = await squarePng(cleaned, 512);
  const apple = await sharp(
    await squarePng(cleaned, 180, { r: 255, g: 255, b: 255, alpha: 1 }),
  )
    .removeAlpha()
    .png()
    .toBuffer();
  const favicon = icoFromPng(
    await Promise.all(
      [16, 32, 48].map(async (size) => ({ size, data: await squarePng(cleaned, size) })),
    ),
  );
  const og = await ogImage();

  await mkdir(path.join(root, "public/brand"), { recursive: true });
  await writeFile(path.join(root, "public/brand/logo.png"), logo);
  await writeFile(path.join(root, "app/icon.png"), logo);
  await writeFile(path.join(root, "app/apple-icon.png"), apple);
  await writeFile(path.join(root, "app/favicon.ico"), favicon);
  await writeFile(path.join(root, "app/opengraph-image.png"), og);
  await writeFile(path.join(root, "app/twitter-image.png"), og);
  await writeFile(path.join(root, "app/opengraph-image.alt.txt"), `${config.name} paylaşım görseli`);
  await writeFile(path.join(root, "app/twitter-image.alt.txt"), `${config.name} paylaşım görseli`);

  console.log(`Generated brand assets from ${path.relative(root, sourcePath)}:`);
  console.log("  public/brand/logo.png (512x512)");
  console.log("  app/icon.png (512x512)");
  console.log("  app/apple-icon.png (180x180)");
  console.log("  app/favicon.ico (16, 32, 48)");
  console.log("  app/opengraph-image.png (1200x630)");
  console.log("  app/twitter-image.png (1200x630)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
