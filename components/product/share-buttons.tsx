"use client";

import { useEffect, useState } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { CheckIcon, LinkIcon, ShareIcon } from "@heroicons/react/24/outline";
import { WhatsAppIcon, TelegramIcon, FacebookIcon, InstagramIcon } from "@/components/icons/social-icons";

type CopyStatus = "idle" | "copied" | "failed";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [instagramStatus, setInstagramStatus] = useState<CopyStatus>("idle");
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  useEffect(() => {
    if (copyStatus === "idle") return;
    const timer = window.setTimeout(() => setCopyStatus("idle"), 2200);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  useEffect(() => {
    if (instagramStatus === "idle") return;
    const timer = window.setTimeout(() => setInstagramStatus("idle"), 2200);
    return () => window.clearTimeout(timer);
  }, [instagramStatus]);

  const copyLink = async () => {
    setCopyStatus("idle");
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const shareToInstagram = async () => {
    setInstagramStatus("idle");
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setInstagramStatus("copied");
    } catch {
      setInstagramStatus("failed");
    }
  };

  const optionClassName =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

  return (
    <Popover className="relative ml-auto">
      <PopoverButton className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
        <ShareIcon className="size-3.5" aria-hidden="true" />
        Paylaş
      </PopoverButton>
      <PopoverPanel
        transition
        className="absolute right-0 top-full z-30 mt-2 w-48 origin-top-right rounded-xl border border-border bg-background p-1.5 shadow-xl transition duration-150 ease-out data-[closed]:-translate-y-1 data-[closed]:opacity-0"
      >
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={optionClassName}>
          <WhatsAppIcon className="size-4 shrink-0" />
          WhatsApp
        </a>
        <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className={optionClassName}>
          <FacebookIcon className="size-4 shrink-0" />
          Facebook
        </a>
        <button
          type="button"
          onClick={() => void shareToInstagram()}
          className={optionClassName}
          title="Instagram'da paylaş (cihaz paylaşımı açılır, desteklenmiyorsa bağlantı kopyalanır)"
        >
          <InstagramIcon className="size-4 shrink-0" />
          {instagramStatus === "copied" ? "Bağlantı Kopyalandı" : instagramStatus === "failed" ? "Kopyalanamadı" : "Instagram"}
        </button>
        <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className={optionClassName}>
          <TelegramIcon className="size-4 shrink-0" />
          Telegram
        </a>
        <button type="button" onClick={() => void copyLink()} className={optionClassName}>
          {copyStatus === "copied" ? (
            <>
              <CheckIcon className="size-4 shrink-0 text-emerald-500" aria-hidden="true" />
              Bağlantı Kopyalandı
            </>
          ) : copyStatus === "failed" ? (
            <>
              <LinkIcon className="size-4 shrink-0" aria-hidden="true" />
              Kopyalanamadı
            </>
          ) : (
            <>
              <LinkIcon className="size-4 shrink-0" aria-hidden="true" />
              Bağlantıyı Kopyala
            </>
          )}
        </button>
      </PopoverPanel>
    </Popover>
  );
}
