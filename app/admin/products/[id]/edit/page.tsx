import { Suspense } from "react";
import { AdminLoading } from "../../../_components/admin-primitives";
import { ProductEditorRoute } from "../../_components/product-editor";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="w-full">
          <AdminLoading label="Ürün formu" />
        </div>
      }
    >
      <EditProduct params={params} />
    </Suspense>
  );
}

async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductEditorRoute productId={id} />;
}
