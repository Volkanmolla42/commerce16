"use client";

import {
  createContext,
  useContext,
  useId,
  useRef,
  useSyncExternalStore,
  ViewTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const ImageTransitionContext = createContext<string | undefined>(undefined);
type ProductImageNavigation = {
  productId: string;
  name: string;
  pathname: string;
  imageUrl?: string;
  alt: string;
};
let activeNavigation: ProductImageNavigation | undefined;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => activeNavigation;
const getServerSnapshot = () => undefined;

export function ProductImageLink({
  productId,
  children,
  onNavigate,
  ...props
}: ComponentProps<typeof Link> & { productId: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const link = useRef<HTMLAnchorElement>(null);
  const name = `product-image-${productId}-${id}`;

  return (
    <Link
      {...props}
      ref={link}
      prefetch={props.prefetch ?? true}
      onNavigate={(event) => {
        let cancelled = false;
        onNavigate?.({
          preventDefault: () => {
            cancelled = true;
            event.preventDefault();
          },
        });
        if (cancelled || !link.current) return;
        const image =
          link.current.querySelector<HTMLImageElement>("img:not(.opacity-0)") ??
          link.current.querySelector<HTMLImageElement>("img");
        activeNavigation = {
          productId,
          name,
          pathname: new URL(link.current.href).pathname,
          imageUrl: image?.currentSrc || image?.src,
          alt: image?.alt ?? "",
        };
        listeners.forEach((listener) => listener());
      }}
    >
      <ImageTransitionContext value={name}>{children}</ImageTransitionContext>
    </Link>
  );
}

type ProductImageTransitionProps = { productId?: string; children: ReactNode };

function SharedProductImage({
  name,
  children,
}: {
  name?: string;
  children: ReactNode;
}) {
  return (
    <ViewTransition name={name} share="product-image-morph" default="none">
      {children}
    </ViewTransition>
  );
}

function useProductImageNavigation() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function ProductDetailImageTransition({
  productId,
  children,
}: ProductImageTransitionProps) {
  const pathname = usePathname();
  const navigation = useProductImageNavigation();
  // Cached detail pages adopt the clicked card identity when reactivated.
  // Inactive routes keep a separate name so cached pages cannot collide.
  const name =
    productId &&
    navigation?.productId === productId &&
    navigation.pathname === pathname
      ? navigation.name
      : productId
        ? `product-image-detail-${productId}`
        : undefined;
  return <SharedProductImage name={name}>{children}</SharedProductImage>;
}

export function ProductImageTransition(props: ProductImageTransitionProps) {
  const cardName = useContext(ImageTransitionContext);
  return cardName ? (
    <SharedProductImage name={cardName}>{props.children}</SharedProductImage>
  ) : (
    <ProductDetailImageTransition {...props} />
  );
}

// A cold route can commit its skeleton before product data arrives. Keep the
// clicked image in that first commit so the shared pair still exists.
export function ProductImagePreview() {
  const pathname = usePathname();
  const navigation = useProductImageNavigation();
  if (navigation?.pathname !== pathname || !navigation.imageUrl) return null;
  return (
    <ProductImageTransition productId={navigation.productId}>
      <Image
        src={navigation.imageUrl}
        alt={navigation.alt}
        fill
        unoptimized
        loading="eager"
        className="object-contain"
      />
    </ProductImageTransition>
  );
}
