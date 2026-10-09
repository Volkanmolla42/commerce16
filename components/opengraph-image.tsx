import { ImageResponse } from "next/og";
import { join } from "path";
import { readFile } from "fs/promises";
import { getStoreSettings } from "@/lib/catalog";

export const alt = "Mağaza paylaşım görseli";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  title?: string;
};

export default async function OpengraphImage(
  props?: Props,
): Promise<ImageResponse> {
  const { storeName } = await getStoreSettings();
  const title = props?.title ?? storeName;
  const initial = storeName.trim().slice(0, 1).toLocaleUpperCase("tr-TR") || "M";

  const file = await readFile(join(process.cwd(), "./fonts/Inter-Bold.ttf"));
  const font = Uint8Array.from(file).buffer;

  return new ImageResponse(
    <div tw="flex h-full w-full flex-col items-center justify-center bg-black">
      <div tw="flex h-[160px] w-[160px] flex-none items-center justify-center rounded-3xl border border-neutral-700 text-8xl font-bold text-white">
        {initial}
      </div>
      <p tw="mt-12 text-6xl font-bold text-white">{title}</p>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: font,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
