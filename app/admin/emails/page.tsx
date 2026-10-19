"use client";

import { Suspense, useState } from "react";
import {
  MagnifyingGlassIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminEmpty, AdminLoading } from "../_components/admin-primitives";
import { useAdminResource } from "../_components/admin-api";
import { formatDateTime } from "@/lib/format-date";

type TabMode = "templates" | "sent";
type ViewportMode = "desktop" | "mobile";

interface EmailTemplate {
  key: string;
  name: string;
  category: "order" | "customer" | "marketing" | "admin";
  description: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

interface SentEmailLog {
  _id: string;
  templateKey: string;
  recipient: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  status: "sent" | "failed";
  error?: string;
  resendId?: string;
  metadata?: Record<string, unknown>;
  _creationTime: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  order: "Sipariş",
  customer: "Müşteri",
  marketing: "Pazarlama",
  admin: "Yönetici",
};

function AdminEmailsContent() {
  const [activeTab, setActiveTab] = useState<TabMode>("templates");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  const templates = useAdminResource<EmailTemplate[]>("email-templates");
  const sentEmails = useAdminResource<SentEmailLog[]>("sent-emails");

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [selectedSentEmailId, setSelectedSentEmailId] = useState<string | null>(null);

  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");

  const term = query.trim().toLocaleLowerCase("tr-TR");

  const filteredTemplates = (templates.data || []).filter((t) => {
    if (selectedCategory !== "all" && t.category !== selectedCategory) return false;
    if (!term) return true;
    return `${t.name} ${t.key} ${t.subject} ${t.description}`.toLocaleLowerCase("tr-TR").includes(term);
  });

  const filteredSentEmails = (sentEmails.data || []).filter((e) => {
    if (!term) return true;
    return `${e.recipient} ${e.subject} ${e.templateKey}`.toLocaleLowerCase("tr-TR").includes(term);
  });



  const activeTemplate = filteredTemplates.find((t) => t.key === selectedTemplateKey) || filteredTemplates[0] || null;
  const activeSentEmail = filteredSentEmails.find((e) => e._id === selectedSentEmailId) || filteredSentEmails[0] || null;

  return (
    <Card className="overflow-hidden rounded-lg">
      {/* Üst Sekmeler ve Arama Barı */}
      <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[auto_minmax(0,1fr)_180px] sm:px-5 sm:items-center">
        {/* Sekmeler */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("templates");
              setQuery("");
            }}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "templates"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <EnvelopeIcon className="size-3.5" />
            <span>Şablonlar</span>
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono">
              {templates.data?.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("sent");
              setQuery("");
            }}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "sent"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PaperAirplaneIcon className="size-3.5" />
            <span>Gönderilenler</span>
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono">
              {sentEmails.data?.length ?? 0}
            </span>
          </button>
        </div>

        {/* Arama */}
        <div className="relative min-w-0">
          <Label htmlFor="email-search" className="sr-only">
            Arama
          </Label>
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="email-search"
            name="email-search"
            type="search"
            placeholder={
              activeTab === "templates"
                ? "Şablon veya konu ara..."
                : "Alıcı veya konu ara..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>

        {/* Kategori Filtresi (Yalnızca şablonlar sekmesinde) */}
        <div>
          {activeTab === "templates" ? (
            <>
              <Label htmlFor="category-filter" className="sr-only">
                Kategori
              </Label>
              <select
                id="category-filter"
                name="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring cursor-pointer"
              >
                <option value="all">Tüm kategoriler</option>
                <option value="order">Sipariş</option>
                <option value="customer">Müşteri</option>
                <option value="marketing">Pazarlama</option>
                <option value="admin">Yönetici</option>
              </select>
            </>
          ) : null}
        </div>
      </div>

      {/* ================= SPLIT VIEW (MASTER - DETAIL) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] min-h-[680px]">
        {/* SOL PANEL: LİSTE */}
        <div className="border-b lg:border-b-0 lg:border-r border-border overflow-y-auto max-h-[750px] divide-y divide-border">
          {activeTab === "templates" ? (
            templates.loading ? (
              <AdminLoading label="Şablonlar" variant="list" />
            ) : filteredTemplates.length === 0 ? (
              <div className="p-5">
                <AdminEmpty title="Şablon bulunamadı" description="Arama kriterini değiştirin." />
              </div>
            ) : (
              filteredTemplates.map((template) => {
                const isSelected = activeTemplate?.key === template.key;
                return (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => setSelectedTemplateKey(template.key)}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? "bg-accent/70 border-l-3 border-l-primary"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {template.name}
                      </span>
                      <Badge variant="outline" className="text-[11px] shrink-0">
                        {CATEGORY_LABELS[template.category] || template.category}
                      </Badge>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {template.key}
                    </span>
                    <p className="text-xs text-muted-foreground truncate">
                      {template.subject}
                    </p>
                  </button>
                );
              })
            )
          ) : sentEmails.loading ? (
            <AdminLoading label="İletimler" variant="list" />
          ) : filteredSentEmails.length === 0 ? (
            <div className="p-5">
              <AdminEmpty title="İletim kaydı yok" description="Kriterlere uygun kayıt bulunamadı." />
            </div>
          ) : (
            filteredSentEmails.map((email) => {
              const isSelected = activeSentEmail?._id === email._id;
              return (
                <button
                  key={email._id}
                  type="button"
                  onClick={() => setSelectedSentEmailId(email._id)}
                  className={`w-full text-left p-3.5 transition-colors cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? "bg-accent/70 border-l-3 border-l-primary"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {email.recipient}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[11px] shrink-0 ${
                        email.status === "sent"
                          ? "border-transparent bg-primary text-primary-foreground font-medium"
                          : "border-destructive/30 bg-destructive/10 text-destructive font-medium"
                      }`}
                    >
                      {email.status === "sent" ? "İletildi" : "Başarısız"}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground truncate">
                    {email.subject}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                    <span className="font-mono">{email.templateKey}</span>
                    <span>
                      {formatDateTime(email._creationTime, { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* SAĞ PANEL: CANLI ÖNİZLEME & DETAY ALANI */}
        <div className="flex flex-col min-h-0 bg-background">
          {activeTab === "templates" ? (
            activeTemplate ? (
              <>
                {/* Şablon Başlık & Önizleme Kontrolleri */}
                <div className="border-b border-border p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-sm text-foreground truncate">
                        {activeTemplate.name}
                      </h2>
                      <span className="font-mono text-xs text-muted-foreground">
                        ({activeTemplate.key})
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      <strong className="text-foreground font-medium">Konu:</strong>{" "}
                      {activeTemplate.subject}
                    </p>
                  </div>

                  {/* Cihaz Genişliği Toggle */}
                  <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1">
                    <button
                      type="button"
                      onClick={() => setViewportMode("desktop")}
                      className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                        viewportMode === "desktop"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Masaüstü"
                    >
                      <ComputerDesktopIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewportMode("mobile")}
                      className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                        viewportMode === "mobile"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Mobil"
                    >
                      <DevicePhoneMobileIcon className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Şablon Önizleme Gövdesi */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/20">
                  <div className="flex justify-center">
                    <div
                      style={{
                        width: viewportMode === "mobile" ? "375px" : "100%",
                        maxWidth: "640px",
                      }}
                      className="bg-white rounded-xl border border-border shadow-xs overflow-hidden transition-all duration-200"
                    >
                      <iframe
                        title={activeTemplate.name}
                        srcDoc={activeTemplate.bodyHtml}
                        className="w-full border-0 min-h-[560px]"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full p-8">
                <AdminEmpty title="Şablon seçin" description="Önizlemek için soldaki listeden bir şablon seçin." />
              </div>
            )
          ) : activeSentEmail ? (
            <>
              {/* İletim Detayı Başlığı */}
              <div className="border-b border-border p-4 sm:px-5 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-sm text-foreground">
                      {activeSentEmail.subject}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Alıcı: <strong className="text-foreground">{activeSentEmail.recipient}</strong>
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      activeSentEmail.status === "sent"
                        ? "border-transparent bg-primary text-primary-foreground font-medium"
                        : "border-destructive/30 bg-destructive/10 text-destructive font-medium"
                    }
                  >
                    {activeSentEmail.status === "sent" ? "İletildi" : "Başarısız"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs border-t border-border/60 pt-2.5">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Şablon:</span>
                    <span className="font-mono text-foreground">{activeSentEmail.templateKey}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Tarih:</span>
                    <span className="text-foreground">
                      {formatDateTime(activeSentEmail._creationTime, { dateStyle: "long", timeStyle: "medium" })}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-muted-foreground block text-[11px]">İleti ID:</span>
                    <span className="font-mono text-muted-foreground select-all">
                      {activeSentEmail.resendId || "—"}
                    </span>
                  </div>
                </div>

                {activeSentEmail.error && (
                  <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">
                    <strong>Hata:</strong> {activeSentEmail.error}
                  </div>
                )}
              </div>

              {/* İletim İçeriği */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/20">
                {activeSentEmail.htmlBody ? (
                  <div className="max-w-2xl mx-auto rounded-xl border border-border bg-white text-black p-4 overflow-x-auto shadow-xs">
                    <div dangerouslySetInnerHTML={{ __html: activeSentEmail.htmlBody }} />
                  </div>
                ) : activeSentEmail.textBody ? (
                  <div className="max-w-2xl mx-auto rounded-xl border border-border bg-card p-4">
                    <pre className="font-mono text-xs whitespace-pre-wrap text-foreground leading-relaxed">
                      {activeSentEmail.textBody}
                    </pre>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto p-8 text-center text-xs text-muted-foreground">
                    İçerik kaydedilmemiş.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full p-8">
              <AdminEmpty title="İletim kaydı seçin" description="Detaylarını görmek için soldan bir kayıt seçin." />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function AdminEmailsPage() {
  return (
    <Suspense fallback={<AdminLoading label="E-postalar" variant="overview" />}>
      <AdminEmailsContent />
    </Suspense>
  );
}
