"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

export function Gallery({
  images,
}: {
  images: { src: string; altText: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedIndex = Number(searchParams.get("image") ?? 0);
  const imageIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < images.length
    ? requestedIndex : 0;

  const updateImage = (index: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("image", index.toString());
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const nextImageIndex = imageIndex + 1 < images.length ? imageIndex + 1 : 0;
  const previousImageIndex =
    imageIndex === 0 ? images.length - 1 : imageIndex - 1;

  return (
    <div>
      <div className="relative aspect-square h-full max-h-[550px] w-full overflow-hidden">
        {images[imageIndex] && (
          <Image
            className="h-full w-full object-contain"
            fill
            sizes="(min-width: 1024px) 66vw, 100vw"
            alt={images[imageIndex]?.altText as string}
            src={images[imageIndex]?.src as string}
            priority={true}
          />
        )}

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => updateImage(previousImageIndex)}
              aria-label="Önceki ürün görseli"
              className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-800 shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-white dark:hover:bg-neutral-800 dark:focus-visible:outline-white"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => updateImage(nextImageIndex)}
              aria-label="Sonraki ürün görseli"
              className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-800 shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-white dark:hover:bg-neutral-800 dark:focus-visible:outline-white"
            >
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <ul
          aria-label="Diğer ürün görselleri"
          className="no-scrollbar mx-auto mt-5 flex w-fit max-w-full items-center justify-start gap-3 overflow-x-auto px-1 py-2 lg:justify-center"
        >
          {images.map((image, index) => {
            const isActive = index === imageIndex;

            return (
              <li key={image.src} className="h-20 w-20 shrink-0">
                <button
                  type="button"
                  onClick={() => updateImage(index)}
                  aria-label={`Ürün görseli ${index + 1} seç`}
                  aria-pressed={isActive}
                  className={`group h-full w-full rounded-xl p-0.5 transition hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900 dark:focus-visible:outline-white ${
                    isActive
                      ? "ring-2 ring-neutral-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-black"
                      : ""
                  }`}
                >
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black">
                    <Image
                      className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      alt={image.altText}
                      src={image.src}
                      width={80}
                      height={80}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
