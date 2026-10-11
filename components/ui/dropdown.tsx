"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export interface DetailsDropdownProps extends ComponentPropsWithoutRef<"details"> {
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
}

/**
 * HTML <details> tabanlı, dışarı tıklanıldığında ve Escape basıldığında
 * otomatik kapanan yeniden kullanılabilir dropdown bileşeni.
 */
export function DetailsDropdown({
  children,
  className,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  ...props
}: DetailsDropdownProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!closeOnOutsideClick && !closeOnEscape) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!closeOnOutsideClick) return;
      const el = detailsRef.current;
      if (el && el.open && !el.contains(event.target as Node)) {
        el.removeAttribute("open");
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!closeOnEscape) return;
      const el = detailsRef.current;
      if (event.key === "Escape" && el && el.open) {
        el.removeAttribute("open");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeOnOutsideClick, closeOnEscape]);

  return (
    <details ref={detailsRef} className={cn("group relative", className)} {...props}>
      {children}
    </details>
  );
}
