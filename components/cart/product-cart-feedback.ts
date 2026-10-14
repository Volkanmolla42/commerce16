"use client";

import { useEffect, useState, type RefObject } from "react";

const PRODUCT_CART_ADDED = "commerce:product-cart-added";

export function notifyProductAddedToCart() {
  window.dispatchEvent(new Event(PRODUCT_CART_ADDED));
}

// Animate a disposable image, leaving the gallery and its ViewTransition intact.
function flyProductImageToCart(target: HTMLElement, onArrive: () => void) {
  const image = findRenderedElement<HTMLImageElement>(
    "[data-product-gallery-image]",
  );
  if (
    !image ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !image.complete ||
    !image.naturalWidth
  ) {
    onArrive();
    return () => {};
  }

  const source = image.getBoundingClientRect();
  const destination = target.getBoundingClientRect();
  if (
    !source.width ||
    !source.height ||
    !destination.width ||
    !destination.height
  ) {
    onArrive();
    return () => {};
  }
  const headerBottom =
    document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  const isVisible =
    source.bottom > headerBottom && source.top < window.innerHeight;
  // When the gallery is off-screen, keep the feedback visible above the action bar.
  const start = isVisible
    ? source
    : {
        left: (window.innerWidth - 80) / 2,
        top: Math.max(
          headerBottom,
          (findRenderedElement(
            "[data-product-purchase-bar]",
          )?.getBoundingClientRect().top ?? window.innerHeight) - 100,
        ),
        width: 80,
        height: 80,
      };
  const dx =
    destination.left + destination.width / 2 - (start.left + start.width / 2);
  const dy =
    destination.top + destination.height / 2 - (start.top + start.height / 2);
  const scale =
    Math.min(
      destination.width / start.width,
      destination.height / start.height,
    ) * 0.55;
  const copy = document.createElement("img");
  copy.src = image.currentSrc || image.src;
  copy.alt = "";
  copy.setAttribute("aria-hidden", "true");
  Object.assign(copy.style, {
    position: "fixed",
    left: `${start.left}px`,
    top: `${start.top}px`,
    width: `${start.width}px`,
    height: `${start.height}px`,
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: "45",
    borderRadius: "16px",
    transformOrigin: "center",
  });
  document.body.appendChild(copy);
  const animation = copy.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 0.9, offset: 0 },
      {
        transform: `translate(${dx * 0.6}px, ${dy * 0.3 - 32}px) scale(0.35)`,
        opacity: 0.95,
        offset: 0.6,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
        opacity: 0,
        offset: 1,
      },
    ],
    { duration: 650, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
  );

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const remove = () => {
    animation.cancel();
    copy.remove();
    motion.removeEventListener("change", stopMotion);
  };
  const stopMotion = () => {
    if (motion.matches) {
      remove();
      onArrive();
    }
  };
  motion.addEventListener("change", stopMotion);
  animation.onfinish = () => {
    remove();
    onArrive();
  };
  return remove;
}

export function useProductCartFeedback(target: RefObject<HTMLElement | null>) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelFlight: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const confirm = () => {
      setConfirmed(true);
      timer = setTimeout(() => setConfirmed(false), 1800);
    };
    const onAdded = () => {
      if (!target.current) return;
      cancelFlight?.();
      clearTimeout(timer);
      setConfirmed(false);
      cancelFlight = flyProductImageToCart(target.current, confirm);
    };
    window.addEventListener(PRODUCT_CART_ADDED, onAdded);
    return () => {
      window.removeEventListener(PRODUCT_CART_ADDED, onAdded);
      cancelFlight?.();
      clearTimeout(timer);
    };
  }, [target]);

  return confirmed;
}

// Cached routes can retain hidden gallery nodes in the DOM.
function findRenderedElement<T extends HTMLElement>(selector: string) {
  return Array.from(document.querySelectorAll<T>(selector)).find(
    (element) => element.getClientRects().length > 0,
  );
}
