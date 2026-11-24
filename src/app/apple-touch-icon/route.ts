import sharp from "sharp";

export const runtime = "nodejs";

const iconSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" rx="38" fill="#0f766e"/><path d="M90 20c-34 0-61 27-61 61 0 45 61 99 61 99s61-54 61-99c0-34-27-61-61-61Z" fill="#fff"/><circle cx="90" cy="82" r="24" fill="#0f766e"/><path d="M62 132h56M73 148h34" stroke="#0f766e" stroke-width="9" stroke-linecap="round"/></svg>`);

export async function GET() {
  const png = await sharp(iconSvg).resize(180, 180).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
