import OpengraphImage from "@/components/opengraph-image";
import { getPage } from "@/lib/catalog";
import { notFound } from "next/navigation";

export default async function Image(props: {
  params: Promise<{ page: string }>;
}) {
  const params = await props.params;
  const page = await getPage(params.page);
  if (!page) return notFound();
  const title = page.seo?.title || page.title;

  return await OpengraphImage({ title });
}
