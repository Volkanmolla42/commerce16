import { Suspense } from "react";
import { AdminLoading, AdminPageHeader } from "../../../_components/admin-primitives";
import { ProductEditorRoute } from "../../_components/product-editor";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="scheme-dark w-full text-foreground">
          <AdminPageHeader title="Ürün detayları" description="Ürün bilgilerini, görsellerini ve varyantlarını düzenleyin." />
          <AdminLoading label="Ürün formu" variant="form-content" />
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
