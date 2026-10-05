"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import {
  LockIcon,
  PlusSignIcon,
  Database01Icon,
  Logout01Icon,
  Package01Icon,
  ShoppingCart01Icon,
  ArrowUpRight01Icon,
  Delete02Icon,
  AnalyticsUpIcon,
  CheckmarkBadge01Icon,
} from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export default function AdminPage() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean | null>(null);
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");

  // Convex data
  const products = useQuery(api.products.listAllAdmin);
  const categories = useQuery(api.categories.list);
  const orders = useQuery(api.orders.listAllAdmin);
  const createProduct = useMutation(api.products.create);
  const removeProduct = useMutation(api.products.remove);
  const updateProduct = useMutation(api.products.update);
  const updateOrderStatus = useMutation(api.orders.updateStatus);
  const seedDb = useMutation(api.seed.seedDatabase);

  // Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categorySlug, setCategorySlug] = useState("apparel");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Check admin session on mount
  useEffect(() => {
    checkAdminSession();
  }, []);

  const checkAdminSession = async () => {
    try {
      const res = await fetch("/api/admin-auth");
      const data = await res.json();
      setIsAdminAuthenticated(data.authenticated === true);
    } catch {
      setIsAdminAuthenticated(false);
    }
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pinDigits];
    newPin[index] = value.slice(-1);
    setPinDigits(newPin);
    setPinError(null);

    // Auto advance focus
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit on last digit
    if (index === 5 && value) {
      const fullCode = newPin.join("");
      if (fullCode.length === 6) {
        verifyPin(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(paste)) {
      const digits = paste.split("");
      setPinDigits(digits);
      verifyPin(paste);
    }
  };

  const verifyPin = async (codeToVerify?: string) => {
    const finalCode = codeToVerify || pinDigits.join("");
    if (finalCode.length < 6) {
      setPinError("Lütfen 6 haneli parolayı eksiksiz girin.");
      return;
    }

    setIsVerifying(true);
    setPinError(null);

    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: finalCode }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdminAuthenticated(true);
      } else {
        setPinError(data.error || "Hatalı yönetici parolası!");
        setPinDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setPinError("Giriş doğrulanırken bir hata oluştu.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await fetch("/api/admin-auth", { method: "DELETE" });
      setIsAdminAuthenticated(false);
      setPinDigits(["", "", "", "", "", ""]);
    } catch {
      // ignore
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setActionMessage(null);

    try {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-");

      const finalImage =
        imageUrl.trim() ||
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80";

      await createProduct({
        title,
        slug,
        price,
        availableForSale: true,
        categorySlug,
        images: [finalImage],
      });

      setShowAddModal(false);
      setTitle("");
      setPrice("");
      setImageUrl("");
      setActionMessage("Ürün başarıyla eklendi!");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setActionMessage(`Hata: ${err.message}`);
      } else {
        setActionMessage("Ürün eklenirken bir hata oluştu.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: Id<"products">) => {
    if (!confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
    try {
      await removeProduct({ id });
      setActionMessage("Ürün başarıyla silindi.");
    } catch {
      setActionMessage("Ürün silinirken bir hata oluştu.");
    }
  };

  const handleToggleStatus = async (id: Id<"products">, currentAvailable: boolean) => {
    try {
      await updateProduct({ id, availableForSale: !currentAvailable });
      setActionMessage("Ürün durumu güncellendi.");
    } catch {
      setActionMessage("Durum güncellenemedi.");
    }
  };

  const handleStatusChange = async (
    orderId: Id<"orders">,
    status: "pending" | "paid" | "shipped" | "delivered" | "cancelled"
  ) => {
    try {
      await updateOrderStatus({ id: orderId, status });
      setActionMessage("Sipariş durumu güncellendi.");
    } catch {
      setActionMessage("Sipariş durumu güncellenirken hata oluştu.");
    }
  };

  const handleSeed = async () => {
    try {
      const msg = await seedDb({ force: false });
      setActionMessage(msg);
    } catch {
      setActionMessage("Başlangıç verisi yüklenirken bir hata oluştu.");
    }
  };

  // Loading state
  if (isAdminAuthenticated === null) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  // PIN Login Screen
  if (!isAdminAuthenticated) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <Card className="w-full max-w-md rounded-3xl p-8 shadow-xl border-border bg-card">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <LockIcon className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
              Yönetici Girişi
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Yönetim paneline erişmek için 6 haneli güvenlik kodunuzu girin.
            </p>
          </div>

          <div className="mt-8">
            <div className="flex justify-center gap-2.5 sm:gap-3" onPaste={handlePaste}>
              {pinDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={isVerifying}
                  className="h-13 w-11 sm:h-14 sm:w-12 rounded-2xl border-2 border-border bg-muted/30 text-center text-xl font-bold text-foreground transition focus:border-primary focus:bg-background focus:outline-hidden disabled:opacity-50"
                />
              ))}
            </div>

            {pinError && (
              <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-center text-xs font-medium text-destructive">
                {pinError}
              </div>
            )}

            <Button
              onClick={() => verifyPin()}
              disabled={isVerifying || pinDigits.join("").length < 6}
              size="lg"
              className="mt-6 w-full rounded-2xl shadow-lg font-semibold"
            >
              {isVerifying ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                "Doğrula ve Giriş Yap"
              )}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const totalRevenue = (orders || []).reduce(
    (sum, o) => sum + parseFloat(o.total || "0"),
    0
  );

  // Authenticated Admin Dashboard
  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Yönetim Paneli
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Katalog, sipariş ve mağaza operasyonları
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowAddModal(true)}
            size="default"
            className="rounded-xl shadow-sm gap-1.5 font-semibold"
          >
            <PlusSignIcon className="h-4 w-4" />
            <span>Yeni Ürün Ekle</span>
          </Button>
          <Button
            onClick={handleSeed}
            variant="outline"
            size="default"
            className="rounded-xl gap-1.5 border-border"
          >
            <Database01Icon className="h-4 w-4" />
            <span>Örnek Verileri Yükle</span>
          </Button>
          <Button
            onClick={handleAdminLogout}
            variant="outline"
            size="default"
            className="rounded-xl gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Logout01Icon className="h-4 w-4" />
            <span>Çıkış Yap</span>
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm font-medium text-foreground">
          {actionMessage}
        </div>
      )}

      {/* Modern E-Commerce Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-border bg-card p-5 shadow-xs">
          <CardHeader className="p-0 flex flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Toplam Ürün
            </CardTitle>
            <Package01Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0 mt-2">
            <div className="text-3xl font-bold text-foreground">
              {products ? products.length : "..."}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card p-5 shadow-xs">
          <CardHeader className="p-0 flex flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Aktif Satışta
            </CardTitle>
            <CheckmarkBadge01Icon className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-0 mt-2">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {products ? products.filter((p) => p.availableForSale).length : "..."}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card p-5 shadow-xs">
          <CardHeader className="p-0 flex flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Toplam Sipariş
            </CardTitle>
            <ShoppingCart01Icon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-0 mt-2">
            <div className="text-3xl font-bold text-foreground">
              {orders ? orders.length : "..."}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card p-5 shadow-xs">
          <CardHeader className="p-0 flex flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Toplam Ciro
            </CardTitle>
            <AnalyticsUpIcon className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-0 mt-2">
            <div className="text-3xl font-bold text-foreground">
              ${totalRevenue.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex gap-3 border-b border-border pb-2">
        <Button
          variant={activeTab === "products" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("products")}
          className="rounded-xl font-semibold gap-2"
        >
          <Package01Icon className="h-4 w-4" />
          <span>Ürün Kataloğu ({products?.length || 0})</span>
        </Button>
        <Button
          variant={activeTab === "orders" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("orders")}
          className="rounded-xl font-semibold gap-2"
        >
          <ShoppingCart01Icon className="h-4 w-4" />
          <span>Siparişler ({orders?.length || 0})</span>
        </Button>
      </div>

      {/* Products Table Tab */}
      {activeTab === "products" && (
        <Card className="mt-6 overflow-hidden rounded-2xl border-border bg-card shadow-xs">
          {!products ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Ürünler yükleniyor...
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Henüz ürün bulunmuyor.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Fiyat</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={p.images?.[0]}
                          alt={p.title}
                          className="h-10 w-10 rounded-lg object-cover border border-border"
                        />
                        <span className="font-medium text-foreground">
                          {p.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.slug}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      ${p.price}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.categorySlug ? (
                        <Badge variant="secondary" className="text-xs uppercase">
                          {p.categorySlug}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleStatus(p._id, p.availableForSale)}
                        className="cursor-pointer"
                      >
                        <Badge
                          variant={p.availableForSale ? "success" : "secondary"}
                          className="cursor-pointer"
                        >
                          {p.availableForSale ? "Satışta (Kapat)" : "Pasif (Aç)"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-primary">
                          <Link href={`/product/${p.slug}`} target="_blank">
                            <span>Görüntüle</span>
                            <ArrowUpRight01Icon className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(p._id)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        >
                          <Delete02Icon className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* Orders Table Tab */}
      {activeTab === "orders" && (
        <Card className="mt-6 overflow-hidden rounded-2xl border-border bg-card shadow-xs">
          {!orders ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Siparişler yükleniyor...
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Henüz alınmış sipariş bulunmuyor.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sipariş ID</TableHead>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Ürünler</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Teslimat Adresi</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o._id}>
                    <TableCell className="font-mono text-xs text-muted-foreground font-bold">
                      #{o._id.slice(-8).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {o.customerName}
                      </div>
                      <div className="text-xs text-muted-foreground">{o.customerEmail}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {o.items.map((item, idx) => (
                          <div key={idx} className="text-xs text-foreground/80">
                            {item.quantity}x {item.title} (${item.price})
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-foreground">
                      ${o.total}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {o.shippingAddress || "Belirtilmemiş"}
                    </TableCell>
                    <TableCell>
                      <select
                        value={o.status}
                        onChange={(e) =>
                          handleStatusChange(
                            o._id,
                            e.target.value as "pending" | "paid" | "shipped" | "delivered" | "cancelled"
                          )
                        }
                        className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="pending">Beklemede</option>
                        <option value="paid">Ödendi</option>
                        <option value="shipped">Kargolandı</option>
                        <option value="delivered">Teslim Edildi</option>
                        <option value="cancelled">İptal Edildi</option>
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* Add Product Dialog */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Ürün Ekle</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="product-title" className="text-xs uppercase tracking-wider text-muted-foreground">
                Ürün Adı
              </Label>
              <Input
                id="product-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: Minimalist Sırt Çantası"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-price" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Fiyat ($)
                </Label>
                <Input
                  id="product-price"
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="99.99"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-category" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Kategori
                </Label>
                <select
                  id="product-category"
                  value={categorySlug}
                  onChange={(e) => setCategorySlug(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {categories && categories.length > 0 ? (
                    categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.title}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="apparel">Giyim</option>
                      <option value="accessories">Aksesuar</option>
                      <option value="footwear">Ayakkabı</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-image" className="text-xs uppercase tracking-wider text-muted-foreground">
                Görsel URL
              </Label>
              <Input
                id="product-image"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
              />
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddModal(false)}
              >
                İptal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
