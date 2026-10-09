import OpengraphImage from "@/components/opengraph-image";
import { getCategory } from "@/lib/catalog";

export const alt = "Kategori paylaşım görseli";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image(props: {
  params: Promise<{ category: string }>;
}) {
  const params = await props.params;
  const category = await getCategory(params.category);
  const title = category?.title;

  return await OpengraphImage({ title });
}
