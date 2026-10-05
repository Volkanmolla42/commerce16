import OpengraphImage from "@/components/opengraph-image";
import { getCategory } from "@/lib/catalog";

export default async function Image(props: {
  params: Promise<{ category: string }>;
}) {
  const params = await props.params;
  const category = await getCategory(params.category);
  const title = category?.seo?.title || category?.title;

  return await OpengraphImage({ title });
}
