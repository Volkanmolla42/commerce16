"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

type AdminHeaderContextValue = { route: string; slot: HTMLElement | null };

// Shell'in o anki rotası ve aksiyon yuvası. cacheComponents gezinilen sayfaları DOM'da gizli tuttuğu için
// aksiyonun gerçekten görünen sayfaya ait olduğunu ancak rota karşılaştırmasıyla anlayabiliriz.
export const AdminHeaderContext = createContext<AdminHeaderContextValue>({ route: "", slot: null });

export function AdminHeaderAction({ route, children }: { route: string; children: ReactNode }) {
  const { route: currentRoute, slot } = useContext(AdminHeaderContext);
  if (!slot || currentRoute !== route) return null;
  return createPortal(children, slot);
}
