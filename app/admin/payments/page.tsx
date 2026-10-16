"use client";

import { SyntheticEvent, useState } from "react";
import {
  CreditCardIcon,
  BanknotesIcon,
  TruckIcon,
  PlusIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui";
import {
  AdminEmpty,
  AdminLoading,
  AdminNotice,
} from "../_components/admin-primitives";
import { AdminHeaderAction } from "../_components/admin-header-action";
import { runAdminAction, useAdminResource } from "../_components/admin-api";
import { adminPath } from "@/lib/admin/routes";
import { cleanIban, formatIban } from "@/lib/iban";

type BankAccount = {
  id: string;
  bankName: string;
  accountHolder: string;
  iban: string;
};

type PaymentSettingsData = {
  cashOnDelivery: {
    enabled: boolean;
    fee: number;
    description: string;
  };
  bankTransfer: {
    enabled: boolean;
    description: string;
    accounts: BankAccount[];
  };
  paytr: {
    enabled: boolean;
    testMode: boolean;
    merchantId?: string;
    merchantKey?: string;
    merchantSalt?: string;
    description: string;
  };
};

function MethodCardHeader({
  icon: Icon,
  title,
  subtitle,
  badgeText,
  enabled,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  badgeText?: string;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border p-4 sm:px-5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
          <Icon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
            {badgeText && (
              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 shrink-0">
                {badgeText}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
      </div>

      <label className="relative inline-flex items-center cursor-pointer gap-2 shrink-0 select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="sr-only peer"
        />
        <div className="relative h-6 w-11 rounded-full bg-muted-foreground/30 transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-checked:bg-primary after:absolute after:top-[2px] after:left-[2px] after:size-5 after:rounded-full after:bg-background after:shadow-sm after:transition-all after:content-[''] peer-checked:after:translate-x-5" />
        <Badge variant={enabled ? "default" : "secondary"} className="text-xs px-2 py-0.5">
          {enabled ? "Aktif" : "Pasif"}
        </Badge>
      </label>
    </div>
  );
}

function AdminPaymentsContent() {
  const { data, error, loading, refresh } =
    useAdminResource<PaymentSettingsData>("payments");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Kapıda Ödeme State
  const [codEnabled, setCodEnabled] = useState<boolean | null>(null);
  const [codFee, setCodFee] = useState<string | null>(null);
  const [codDesc, setCodDesc] = useState<string | null>(null);

  // Havale State
  const [bankEnabled, setBankEnabled] = useState<boolean | null>(null);
  const [bankDesc, setBankDesc] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);

  // PayTR State
  const [paytrEnabled, setPaytrEnabled] = useState<boolean | null>(null);
  const [paytrDesc, setPaytrDesc] = useState<string | null>(null);

  // Yeni banka hesabı modal ve form state
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newAccountHolder, setNewAccountHolder] = useState("");
  const [newIban, setNewIban] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (loading) return <AdminLoading label="Ödeme yöntemleri" variant="settings-content" />;
  if (!data) {
    return (
      <AdminEmpty
        title="Ödeme yöntemleri yüklenemedi"
        description={error || "Bağlantıyı kontrol edip yeniden deneyebilirsiniz."}
      />
    );
  }

  // Aktif değerler (state değişmediyse veritabanındaki veriler kullanılır)
  const activeCodEnabled = codEnabled !== null ? codEnabled : data.cashOnDelivery.enabled;
  const activeCodFee = codFee !== null ? codFee : String(data.cashOnDelivery.fee);
  const activeCodDesc = codDesc !== null ? codDesc : data.cashOnDelivery.description;

  const activeBankEnabled = bankEnabled !== null ? bankEnabled : data.bankTransfer.enabled;
  const activeBankDesc = bankDesc !== null ? bankDesc : data.bankTransfer.description;
  const activeAccounts = accounts !== null ? accounts : data.bankTransfer.accounts;

  const activePaytrEnabled = paytrEnabled !== null ? paytrEnabled : data.paytr.enabled;
  const activePaytrDesc = paytrDesc !== null ? paytrDesc : data.paytr.description;

  const handleAddAccount = () => {
    if (!newBankName.trim() || !newAccountHolder.trim() || !newIban.trim()) {
      setModalError("Lütfen banka adı, hesap sahibi ve IBAN alanlarını doldurun.");
      return;
    }

    const newAccount: BankAccount = {
      id: `bank-${Date.now()}`,
      bankName: newBankName.trim(),
      accountHolder: newAccountHolder.trim(),
      iban: cleanIban(newIban),
    };

    setAccounts([...activeAccounts, newAccount]);
    setNewBankName("");
    setNewAccountHolder("");
    setNewIban("");
    setModalError(null);
    setShowAddAccountModal(false);
  };

  const handleRemoveAccount = (id: string) => {
    setAccounts(activeAccounts.filter((acc) => acc.id !== id));
  };

  const copyIban = (id: string, iban: string) => {
    navigator.clipboard.writeText(iban);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSave = async (e?: SyntheticEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage(null);
    setActionError(null);

    const parsedFee = parseFloat(activeCodFee.replace(",", ".")) || 0;
    if (parsedFee < 0) {
      setActionError("Kapıda ödeme ek hizmet bedeli 0 veya pozitif bir tutar olmalıdır.");
      setSaving(false);
      return;
    }

    try {
      await runAdminAction("payments.update", {
        cashOnDelivery: {
          enabled: activeCodEnabled,
          fee: parsedFee,
          description: activeCodDesc,
        },
        bankTransfer: {
          enabled: activeBankEnabled,
          description: activeBankDesc,
          accounts: activeAccounts,
        },
        paytr: {
          enabled: activePaytrEnabled,
          testMode: true,
          merchantId: data.paytr.merchantId ?? "",
          merchantKey: data.paytr.merchantKey ?? "",
          merchantSalt: data.paytr.merchantSalt ?? "",
          description: activePaytrDesc,
        },
      });

      setMessage("Ödeme yöntemleri ve ayarları başarıyla güncellendi.");
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Ödeme yöntemleri kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Üst Header Aksiyon Butonu */}
      <AdminHeaderAction route={adminPath("payments")}>
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          size="sm"
          className="h-9 px-4 text-xs font-semibold shadow-sm cursor-pointer"
        >
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </AdminHeaderAction>

      {/* Bildirim Alanı */}
      {(message || actionError || error) && (
        <div className="mb-6">
          <AdminNotice kind={actionError || error ? "error" : "success"}>
            {actionError || error || message}
          </AdminNotice>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Üst Sıra: PayTR Sanal POS ve Kapıda Ödeme (2 Kolon) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
          {/* 1. PayTR Sanal POS */}
          <Card className="rounded-lg overflow-hidden border border-border bg-card">
            <MethodCardHeader
              icon={CreditCardIcon}
              title="PayTR Kredi & Banka Kartı"
              subtitle="Online sanal POS ile kartlı ödeme"
              badgeText="Demo Modu"
              enabled={activePaytrEnabled}
              onToggle={(checked) => setPaytrEnabled(checked)}
            />

            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Demo Simülasyonu:</span> Sistem hazır test kartlarıyla çalışır. Müşteriler ödeme sayfasında kart bilgisi girerek siparişini anında tamamlayabilir; gerçek bakiye çekilmez.
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="paytr-desc" className="text-xs font-medium">
                  Ödeme Sayfası Açıklaması
                </Label>
                <textarea
                  id="paytr-desc"
                  rows={3}
                  value={activePaytrDesc}
                  onChange={(e) => setPaytrDesc(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring resize-none leading-relaxed"
                  placeholder="Kart bilgileriniz mağazamızda saklanmaz."
                />
                <p className="text-xs text-muted-foreground">
                  Müşteri kartla ödeme seçeneğini seçtiğinde gösterilen açıklama metnidir.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 2. Kapıda Ödeme */}
          <Card className="rounded-lg overflow-hidden border border-border bg-card">
            <MethodCardHeader
              icon={TruckIcon}
              title="Kapıda Ödeme"
              subtitle="Teslimat anında nakit veya kartla tahsilat"
              enabled={activeCodEnabled}
              onToggle={(checked) => setCodEnabled(checked)}
            />

            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="space-y-1.5">
                <Label htmlFor="cod-fee" className="text-xs font-medium">
                  Ek Hizmet / Kargo Tahsilat Bedeli (TL)
                </Label>
                <div className="relative">
                  <Input
                    id="cod-fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={activeCodFee}
                    onChange={(e) => setCodFee(e.target.value)}
                    placeholder="0.00"
                    className="h-10 text-sm pr-12 font-mono"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-xs font-semibold text-muted-foreground">
                    TL
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Kargo firmasının tahsilat hizmet bedeli varsa tutar belirleyin. Ek ücret yoksa 0 bırakın.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cod-desc" className="text-xs font-medium">
                  Ödeme Sayfası Açıklaması
                </Label>
                <textarea
                  id="cod-desc"
                  rows={3}
                  value={activeCodDesc}
                  onChange={(e) => setCodDesc(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring resize-none leading-relaxed"
                  placeholder="Siparişinizi kapıda teslim alırken nakit veya banka kartı ile ödeyebilirsiniz."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alt Sıra: Havale / EFT ile Ödeme (Geniş Kolon) */}
        <Card className="rounded-lg overflow-hidden border border-border bg-card">
          <MethodCardHeader
            icon={BanknotesIcon}
            title="Havale / EFT ile Ödeme"
            subtitle="Banka hesaplarına doğrudan transfer ile sipariş alma"
            enabled={activeBankEnabled}
            onToggle={(checked) => setBankEnabled(checked)}
          />

          <CardContent className="space-y-6 p-4 sm:p-5">
            <div className="space-y-1.5">
              <Label htmlFor="bank-desc" className="text-xs font-medium">
                Havale Talimatı ve Bilgilendirme Notu
              </Label>
              <textarea
                id="bank-desc"
                rows={2}
                value={activeBankDesc}
                onChange={(e) => setBankDesc(e.target.value)}
                className="w-full rounded-md border border-input bg-background p-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring resize-none leading-relaxed"
                placeholder="Siparişi oluşturduktan sonra belirtilen banka hesabına sipariş numaranızı açıklama kısmına yazarak ödeme yapınız."
              />
              <p className="text-xs text-muted-foreground">
                Bu talimat sipariş tamamlama ekranında ve müşteriye gönderilen sipariş alındı e-postasında gösterilir.
              </p>
            </div>

            {/* Banka Hesapları Yönetimi */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Banka Hesapları ({activeAccounts.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Müşterilerinize ödeme sayfasında ve sipariş e-postasında sunulan aktif IBAN listesi
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setModalError(null);
                    setShowAddAccountModal(true);
                  }}
                  className="h-9 gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
                >
                  <PlusIcon className="size-4" />
                  <span>Banka Hesabı Ekle</span>
                </Button>
              </div>

              {/* Hesap Listesi Tablosu */}
              {activeAccounts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Henüz kayıtlı banka hesabı bulunmuyor.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddAccountModal(true)}
                    className="text-xs"
                  >
                    <PlusIcon className="size-3.5 mr-1" />
                    İlk Hesabı Ekleyin
                  </Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 min-w-[140px]">Banka Adı</th>
                          <th className="px-4 py-3 min-w-[160px]">Hesap Sahibi</th>
                          <th className="px-4 py-3 min-w-[260px]">IBAN</th>
                          <th className="px-4 py-3 text-right w-16">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-card">
                        {activeAccounts.map((acc) => (
                          <tr key={acc.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">
                              {acc.bankName}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {acc.accountHolder}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-foreground tracking-wide select-all">
                                  {formatIban(acc.iban)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyIban(acc.id, acc.iban)}
                                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                                  title="IBAN Kopyala"
                                >
                                  {copiedId === acc.id ? (
                                    <ClipboardDocumentCheckIcon className="size-4 text-primary" />
                                  ) : (
                                    <ClipboardDocumentIcon className="size-4" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveAccount(acc.id)}
                                className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                title="Hesabı Kaldır"
                              >
                                <TrashIcon className="size-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alt Kaydet Butonu */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Değişikliklerin mağazanızda geçerli olması için kaydedin.
          </p>
          <Button
            type="submit"
            disabled={saving}
            className="min-h-10 px-6 font-semibold cursor-pointer"
          >
            {saving ? "Kaydediliyor…" : "Ayarları Kaydet"}
          </Button>
        </div>
      </form>

      {/* Yeni Banka Hesabı Ekleme Dialog Modalı */}
      <Dialog open={showAddAccountModal} onOpenChange={setShowAddAccountModal}>
        <DialogContent className="max-w-md p-5 sm:p-6">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="text-base font-bold text-foreground">
              Yeni Banka Hesabı Ekle
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Müşterilerin havale/EFT yapacağı banka hesap ve IBAN bilgilerini girin.
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {modalError}
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="modal-bank-name" className="text-xs font-medium">
                Banka Adı
              </Label>
              <Input
                id="modal-bank-name"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                placeholder="Örn: Garanti BBVA, Ziraat Bankası"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modal-acc-holder" className="text-xs font-medium">
                Hesap Sahibi (Ad Soyad / Şirket Unvanı)
              </Label>
              <Input
                id="modal-acc-holder"
                value={newAccountHolder}
                onChange={(e) => setNewAccountHolder(e.target.value)}
                placeholder="Örn: Ahmet Yılmaz veya Şirket A.Ş."
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modal-iban" className="text-xs font-medium">
                IBAN Numarası
              </Label>
              <Input
                id="modal-iban"
                value={newIban}
                onChange={(e) => setNewIban(e.target.value)}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                className="h-10 text-sm font-mono uppercase"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddAccountModal(false);
                setModalError(null);
              }}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={handleAddAccount}
              className="font-semibold cursor-pointer"
            >
              Hesabı Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminPaymentsPage() {
  return <AdminPaymentsContent />;
}
