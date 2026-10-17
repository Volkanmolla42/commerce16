"use client";

import { useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { NoSymbolIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { AdminEmpty, AdminLoading, AdminNotice } from "../_components/admin-primitives";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { formatMoney } from "@/lib/format-money";

type Promotion = Doc<"promotions">;
type PromotionType = Promotion["type"];

const typeLabels: Record<PromotionType, string> = {
  cart_percentage: "Sepette yüzde indirim",
  buy_x_get_y: "X al Y öde",
  category_free_shipping: "Kategoriye/ürüne kargo bedava",
};

function promotionDetail(rule: Promotion, categoryTitle?: string, productTitle?: string) {
  const target = productTitle
    ? `Ürün: ${productTitle}`
    : categoryTitle
      ? `Kategori: ${categoryTitle}`
      : "";
  if (rule.type === "cart_percentage") {
    return `%${rule.percentage ?? 0} indirim${target ? ` · ${target}` : ""}${rule.minSubtotalKurus !== undefined ? ` · Min. ${formatMoney(rule.minSubtotalKurus / 100)}` : ""}`;
  }
  if (rule.type === "buy_x_get_y") {
    return `${rule.buyQuantity ?? 0} al ${rule.payQuantity ?? 0} öde${target ? ` · ${target}` : ""}${rule.minSubtotalKurus !== undefined ? ` · Min. ${formatMoney(rule.minSubtotalKurus / 100)}` : ""}`;
  }
  return `${productTitle ?? categoryTitle ?? "Seçili kapsam"} için kargo bedava`;
}

export default function AdminPromotionsPage() {
  const { data: promotions, error, loading, refresh } = useAdminResource<Promotion[]>("promotions");
  const categories = useQuery(api.categories.list, {});
  const products = useQuery(api.products.list, { limit: 100 });
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PromotionType>("cart_percentage");
  const [targetType, setTargetType] = useState<"all" | "category" | "product">("all");
  const [categorySlug, setCategorySlug] = useState("");
  const [productId, setProductId] = useState("");
  const [percentage, setPercentage] = useState("10");
  const [buyQuantity, setBuyQuantity] = useState("3");
  const [payQuantity, setPayQuantity] = useState("2");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const categoryTitle = (slug?: string) => categories?.find((category) => category.slug === slug)?.title;
  const productTitle = (id?: string) => products?.find((product) => product._id === id)?.title;

  const changeType = (next: PromotionType) => {
    setType(next);
    if (next === "cart_percentage" && targetType === "category") setTargetType("all");
    if (next === "category_free_shipping" && targetType === "all") setTargetType("category");
  };

  const save = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setActionError(null);
    try {
      const trimmedTitle = title.trim();
      if (trimmedTitle.length < 2) throw new Error("Kampanya adı en az 2 karakter olmalı.");
      if (targetType === "product" && !productId) throw new Error("Kampanya için bir ürün seçin.");
      if (targetType === "category" && type === "category_free_shipping" && !categorySlug) {
        throw new Error("Kargo bedava kampanyası için kategori seçin.");
      }
      const minSubtotalKurus = minSubtotal.trim()
        ? Math.round(Number(minSubtotal.replace(",", ".")) * 100)
        : undefined;
      if (minSubtotalKurus !== undefined && (!Number.isSafeInteger(minSubtotalKurus) || minSubtotalKurus < 0)) {
        throw new Error("Asgari sepet tutarı geçersiz.");
      }
      await runAdminAction("promotion.create", {
        title: trimmedTitle,
        type,
        isActive: true,
        ...(targetType === "category" && categorySlug ? { categorySlug } : {}),
        ...(targetType === "product" && productId ? { productId } : {}),
        ...(type === "cart_percentage" ? { percentage: Number(percentage) } : {}),
        ...(type === "buy_x_get_y" ? { buyQuantity: Number(buyQuantity), payQuantity: Number(payQuantity) } : {}),
        ...(type !== "category_free_shipping" && minSubtotalKurus !== undefined ? { minSubtotalKurus } : {}),
      });
      setTitle("");
      setMessage("Kampanya oluşturuldu.");
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Kampanya oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  };

  const disablePromotion = async (rule: Promotion) => {
    if (!window.confirm(`“${rule.title}” kampanyasını devre dışı bırakmak istediğinize emin misiniz?`)) return;
    setMessage(null);
    setActionError(null);
    try {
      await runAdminAction("promotion.disable", undefined, rule._id);
      setMessage(`“${rule.title}” devre dışı bırakıldı.`);
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Kampanya devre dışı bırakılamadı.");
    }
  };

  return (
    <div className="space-y-5">
      {(message || actionError || error) && (
        <AdminNotice kind={actionError || error ? "error" : "success"}>
          {actionError || error || message}
        </AdminNotice>
      )}

      <Card className="rounded-lg">
        <div className="border-b border-border p-4 sm:px-5">
          <h2 className="text-sm font-semibold text-foreground">Yeni Kampanya</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Kampanyalar kupon kodu olmadan sepette otomatik hesaplanır; kuponla birlikte kullanılabilir.
          </p>
        </div>
        <form onSubmit={save} className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="promotion-title">Kampanya adı</Label>
              <Input
                id="promotion-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                placeholder="Örn: Hafta sonu %10"
                required
                minLength={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="promotion-type">Kampanya türü</Label>
              <select
                id="promotion-type"
                value={type}
                onChange={(event) => changeType(event.target.value as PromotionType)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring"
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {type === "cart_percentage" ? (
              <div className="space-y-1.5">
                <Label htmlFor="promotion-percentage">İndirim oranı (%)</Label>
                <Input
                  id="promotion-percentage"
                  type="number"
                  min={1}
                  max={90}
                  step={1}
                  value={percentage}
                  onChange={(event) => setPercentage(event.target.value)}
                  required
                />
              </div>
            ) : null}

            {type === "buy_x_get_y" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="promotion-buy">Kaç al?</Label>
                  <Input id="promotion-buy" type="number" min={2} max={10} step={1} value={buyQuantity} onChange={(event) => setBuyQuantity(event.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promotion-pay">Kaç öde?</Label>
                  <Input id="promotion-pay" type="number" min={1} max={9} step={1} value={payQuantity} onChange={(event) => setPayQuantity(event.target.value)} required />
                </div>
              </>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="promotion-target">Hedef</Label>
              <select
                id="promotion-target"
                value={targetType}
                onChange={(event) => setTargetType(event.target.value as "all" | "category" | "product")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring"
              >
                {type !== "category_free_shipping" ? <option value="all">Tüm sepet</option> : null}
                {type !== "cart_percentage" ? <option value="category">Kategori</option> : null}
                <option value="product">Ürün</option>
              </select>
            </div>

            {targetType === "category" ? (
              <div className="space-y-1.5">
                <Label htmlFor="promotion-category">Kategori</Label>
                <select
                  id="promotion-category"
                  value={categorySlug}
                  onChange={(event) => setCategorySlug(event.target.value)}
                  required={type === "category_free_shipping"}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring"
                >
                  <option value="">Kategori seçin</option>
                  {(categories ?? []).map((category) => (
                    <option key={category.slug} value={category.slug}>{category.title}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {targetType === "product" ? (
              <div className="space-y-1.5">
                <Label htmlFor="promotion-product">Ürün</Label>
                <select
                  id="promotion-product"
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring"
                >
                  <option value="">Ürün seçin</option>
                  {(products ?? []).map((product) => (
                    <option key={product._id} value={product._id}>{product.title}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {type !== "category_free_shipping" ? (
              <div className="space-y-1.5">
                <Label htmlFor="promotion-minimum">Asgari sepet tutarı (TL)</Label>
                <Input
                  id="promotion-minimum"
                  type="number"
                  min={0}
                  step="0.01"
                  value={minSubtotal}
                  onChange={(event) => setMinSubtotal(event.target.value)}
                  placeholder="Sınır yok"
                />
              </div>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="gap-1.5">
              <PlusIcon className="size-4" />
              {saving ? "Oluşturuluyor..." : "Kampanyayı Oluştur"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden rounded-lg">
        <div className="flex items-center justify-between border-b border-border p-4 sm:px-5">
          <h2 className="text-sm font-semibold text-foreground">Kampanyalar</h2>
          <span className="text-xs text-muted-foreground">{promotions?.length ?? 0} kampanya</span>
        </div>
        {loading ? (
          <AdminLoading label="Kampanyalar" variant="table" />
        ) : !promotions?.length ? (
          <div className="p-5">
            <AdminEmpty title="Henüz kampanya yok" description="Yukarıdaki formdan otomatik bir kampanya oluşturun." />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {promotions.map((rule) => (
              <article key={rule._id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{rule.title}</h3>
                    <Badge variant="outline" className={`text-[11px] ${rule.isActive ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground"}`}>
                      {rule.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {typeLabels[rule.type]} · {promotionDetail(rule, categoryTitle(rule.categorySlug), productTitle(rule.productId))}
                  </p>
                </div>
                {rule.isActive ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 self-start text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:self-auto"
                    onClick={() => void disablePromotion(rule)}
                  >
                    <NoSymbolIcon className="size-3.5" />
                    Kapat
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
