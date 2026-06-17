import { useEffect, useMemo, useState } from "react";
import { Eye, Printer, ReceiptText, Save, X } from "lucide-react";
import { API_URL, requestJson } from "../api/client";
import useAuthStore from "../stores/authStore";
import useToastStore from "../stores/toastStore";
import { shouldSkipPermissionToast } from "../utils/permissionErrors";
import { hasAnyPermission } from "../utils/permissions";

const cardClassName = "rounded-xl border border-border bg-surface p-5 shadow-sm";

const DEFAULT_RECEIPT_SETTINGS = {
  paperFormat: "80mm",
  logoUrl: "",
  showLogo: false,
  logoMonochrome: true,
  headerText: "",
  footerText: "Merci pour votre achat",
  showHeaderText: true,
  showFooterText: true,
  showBusinessName: true,
  showStoreName: true,
  showTicketNumber: true,
  showDateTime: true,
  showCashier: true,
  showCustomer: true,
  showItems: true,
  showSubtotal: true,
  showTotal: true,
  showPaymentMethod: true,
  showAmountReceived: true,
  showOriginalAmount: true,
  showChange: true,
  showLoyaltyPoints: true,
};

const toggleFields = [
  { key: "showLogo", label: "Afficher le logo" },
  { key: "logoMonochrome", label: "Logo noir et blanc" },
  { key: "showBusinessName", label: "Afficher le nom de l'entreprise" },
  { key: "showStoreName", label: "Afficher la boutique" },
  { key: "showHeaderText", label: "Afficher l'en-tete" },
  { key: "showTicketNumber", label: "Afficher le numero de ticket" },
  { key: "showDateTime", label: "Afficher la date et l'heure" },
  { key: "showCashier", label: "Afficher le caissier" },
  { key: "showCustomer", label: "Afficher le client" },
  { key: "showItems", label: "Afficher les lignes articles" },
  { key: "showSubtotal", label: "Afficher le sous-total" },
  { key: "showTotal", label: "Afficher le total" },
  { key: "showPaymentMethod", label: "Afficher le mode de paiement" },
  { key: "showAmountReceived", label: "Afficher le montant recu" },
  { key: "showOriginalAmount", label: "Afficher le montant remis client" },
  { key: "showChange", label: "Afficher la monnaie" },
  { key: "showLoyaltyPoints", label: "Afficher les points fidelite" },
  { key: "showFooterText", label: "Afficher le pied de ticket" },
];

const formatAmount = (value, currencyCode = "USD") =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDateTime = (value) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const resolveAssetUrl = (value) => {
  if (!value) return "";
  if (
    String(value).startsWith("http://") ||
    String(value).startsWith("https://") ||
    String(value).startsWith("blob:") ||
    String(value).startsWith("data:")
  ) {
    return value;
  }
  return value.startsWith("/")
    ? `${API_URL}${value}`
    : `${API_URL}/${String(value).replace(/^\/+/, "")}`;
};

const previewOrder = {
  id: "sale-preview-001",
  createdAt: new Date().toISOString(),
  subtotal: 18.5,
  total: 20,
  currencyCode: "USD",
  loyaltyPoints: 4,
  customer: {
    firstName: "Client",
    lastName: "Test",
  },
  items: [
    {
      quantity: 2,
      unitPrice: 5,
      total: 10,
      product: { name: "Pain sandwich" },
    },
    {
      quantity: 1,
      unitPrice: 8.5,
      total: 8.5,
      product: { name: "Saucisse fumee" },
    },
  ],
  payments: [
    {
      method: "CASH",
      amount: 25,
      originalAmount: 56250,
      originalCurrencyCode: "CDF",
      currencyCode: "USD",
    },
  ],
};

const buildPrintableReceiptHtml = ({ settings, user }) => {
  const amountReceived = 25;
  const payment = previewOrder.payments[0];
  const total = Number(previewOrder.total || 0);
  const paid = Number(amountReceived);
  const originalPaid = Number(payment.originalAmount || paid);
  const originalCurrencyCode = payment.originalCurrencyCode || previewOrder.currencyCode;
  const showOriginalPayment =
    originalCurrencyCode !== previewOrder.currencyCode ||
    Math.abs(originalPaid - paid) > 0.005;
  const change = Math.max(0, paid - total);
  const paperWidth = settings.paperFormat === "58mm" ? "58mm" : "80mm";
  const logoSource = resolveAssetUrl(settings.logoUrl);
  const businessName = user?.tenantName || "POSapp";
  const storeName = user?.storeName || "Boutique principale";

  return `<!doctype html>
  <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <title>Test impression ticket</title>
      <style>
        @page { size: ${paperWidth} auto; margin: 0; }
        html, body {
          margin: 0;
          padding: 0;
          background: #fff;
          color: #000;
          font-family: "Courier New", monospace;
          width: ${paperWidth};
        }
        body { padding: 4mm; box-sizing: border-box; }
        .receipt { width: 100%; }
        .center { text-align: center; }
        .title { font-size: 16px; font-weight: 700; text-transform: uppercase; }
        .subtitle, .meta, .footer, .header-note { font-size: 11px; line-height: 1.4; }
        .header-note, .footer { white-space: pre-wrap; }
        .divider {
          margin: 8px 0;
          border-top: 1px dashed #000;
        }
        .logo-wrap { margin-bottom: 8px; text-align: center; }
        .logo {
          max-width: 52mm;
          max-height: 48px;
          object-fit: contain;
          ${settings.logoMonochrome ? "filter: grayscale(1) contrast(1.1);" : ""}
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        td {
          vertical-align: top;
          padding: 2px 0;
        }
        .item-name {
          width: 70%;
          padding-right: 8px;
        }
        .item-title { font-weight: 700; }
        .item-meta { font-size: 10px; }
        .item-total, .value { text-align: right; white-space: nowrap; }
        .grand-total td {
          font-size: 13px;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <section class="receipt">
        <div class="center">
          ${
            settings.showLogo && logoSource
              ? `<div class="logo-wrap"><img class="logo" src="${escapeHtml(logoSource)}" alt="Logo" /></div>`
              : ""
          }
          ${settings.showStoreName ? `<div class="title">${escapeHtml(storeName)}</div>` : ""}
          ${settings.showBusinessName ? `<div class="subtitle">${escapeHtml(businessName)}</div>` : ""}
          ${
            settings.showHeaderText && settings.headerText
              ? `<div class="header-note">${escapeHtml(settings.headerText)}</div>`
              : ""
          }
          ${settings.showTicketNumber ? `<div class="meta">Ticket: VIEW-0001</div>` : ""}
          ${
            settings.showDateTime
              ? `<div class="meta">Date: ${escapeHtml(formatDateTime(previewOrder.createdAt))}</div>`
              : ""
          }
          ${
            settings.showCashier
              ? `<div class="meta">Caissier: ${escapeHtml(
                  `${user?.firstName || "Admin"} ${user?.lastName || ""}`.trim(),
                )}</div>`
              : ""
          }
          ${settings.showCustomer ? `<div class="meta">Client: Client Test</div>` : ""}
        </div>

        <div class="divider"></div>

        ${
          settings.showItems
            ? `<table><tbody>
                ${previewOrder.items
                  .map(
                    (item) => `
                  <tr>
                    <td class="item-name">
                      <div class="item-title">${escapeHtml(item.product.name)}</div>
                      <div class="item-meta">${item.quantity} x ${escapeHtml(
                        formatAmount(item.unitPrice, previewOrder.currencyCode),
                      )}</div>
                    </td>
                    <td class="item-total">${escapeHtml(
                      formatAmount(item.total, previewOrder.currencyCode),
                    )}</td>
                  </tr>`,
                  )
                  .join("")}
              </tbody></table>
              <div class="divider"></div>`
            : ""
        }

        <table>
          <tbody>
            ${
              settings.showSubtotal
                ? `<tr><td>Sous-total</td><td class="value">${escapeHtml(
                    formatAmount(previewOrder.subtotal, previewOrder.currencyCode),
                  )}</td></tr>`
                : ""
            }
            ${
              settings.showTotal
                ? `<tr class="grand-total"><td>Total</td><td class="value">${escapeHtml(
                    formatAmount(total, previewOrder.currencyCode),
                  )}</td></tr>`
                : ""
            }
            ${
              settings.showPaymentMethod
                ? `<tr><td>Paiement</td><td class="value">Cash</td></tr>`
                : ""
            }
            ${
              settings.showAmountReceived
                ? `<tr><td>Montant recu</td><td class="value">${escapeHtml(
                    formatAmount(paid, previewOrder.currencyCode),
                  )}</td></tr>`
                : ""
            }
            ${
              settings.showOriginalAmount && showOriginalPayment
                ? `<tr><td>Remis client</td><td class="value">${escapeHtml(
                    formatAmount(originalPaid, originalCurrencyCode),
                  )}</td></tr>`
                : ""
            }
            ${
              settings.showChange
                ? `<tr class="grand-total"><td>Monnaie</td><td class="value">${escapeHtml(
                    formatAmount(change, previewOrder.currencyCode),
                  )}</td></tr>`
                : ""
            }
          </tbody>
        </table>

        ${
          settings.showLoyaltyPoints
            ? `<div class="divider"></div><div>Points gagnes: ${escapeHtml(
                previewOrder.loyaltyPoints,
              )}</div>`
            : ""
        }

        <div class="divider"></div>
        ${
          settings.showFooterText
            ? `<div class="footer center">${escapeHtml(
                settings.footerText || "Merci pour votre achat",
              )}</div>`
            : ""
        }
      </section>
      <script>
        window.onload = function () {
          setTimeout(function () {
            window.focus();
            window.print();
          }, 200);
        };
      </script>
    </body>
  </html>`;
};

const ReceiptPreview = ({ settings, user }) => {
  const amountReceived = 25;
  const payment = previewOrder.payments[0];
  const total = Number(previewOrder.total || 0);
  const paid = Number(amountReceived);
  const originalPaid = Number(payment.originalAmount || paid);
  const originalCurrencyCode = payment.originalCurrencyCode || previewOrder.currencyCode;
  const showOriginalPayment =
    originalCurrencyCode !== previewOrder.currencyCode ||
    Math.abs(originalPaid - paid) > 0.005;
  const change = Math.max(0, paid - total);
  const widthClass = settings.paperFormat === "58mm" ? "w-[250px]" : "w-[330px]";
  const logoSource = resolveAssetUrl(settings.logoUrl);
  const businessName = user?.tenantName || "POSapp";
  const storeName = user?.storeName || "Boutique principale";

  return (
    <div
      className={[
        widthClass,
        "rounded-2xl border border-dashed border-border bg-white p-4 font-mono text-[11px] leading-5 text-black shadow-sm",
      ].join(" ")}
    >
      <div className="text-center">
        {settings.showLogo && logoSource ? (
          <div className="mb-2 flex justify-center">
            <img
              src={logoSource}
              alt="Logo ticket"
              className="max-h-12 max-w-[160px] object-contain"
              style={{
                filter: settings.logoMonochrome ? "grayscale(1) contrast(1.1)" : "none",
              }}
            />
          </div>
        ) : null}
        {settings.showStoreName ? (
          <div className="text-sm font-bold uppercase">{storeName}</div>
        ) : null}
        {settings.showBusinessName ? (
          <div className="text-[11px]">{businessName}</div>
        ) : null}
        {settings.showHeaderText && settings.headerText ? (
          <div className="mt-1 whitespace-pre-wrap">{settings.headerText}</div>
        ) : null}
        {settings.showTicketNumber ? <div>Ticket: VIEW-0001</div> : null}
        {settings.showDateTime ? <div>Date: {formatDateTime(previewOrder.createdAt)}</div> : null}
        {settings.showCashier ? <div>Caissier: {user?.firstName || "Admin"} {user?.lastName || ""}</div> : null}
        {settings.showCustomer ? <div>Client: Client Test</div> : null}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      {settings.showItems ? (
        <>
          <div className="space-y-2">
            {previewOrder.items.map((item, index) => (
              <div key={`${item.product.name}-${index}`} className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{item.product.name}</div>
                  <div className="text-[10px]">
                    {item.quantity} x {formatAmount(item.unitPrice, previewOrder.currencyCode)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {formatAmount(item.total, previewOrder.currencyCode)}
                </div>
              </div>
            ))}
          </div>
          <div className="my-2 border-t border-dashed border-black" />
        </>
      ) : null}

      <div className="space-y-1">
        {settings.showSubtotal ? (
          <div className="flex justify-between gap-3">
            <span>Sous-total</span>
            <span>{formatAmount(previewOrder.subtotal, previewOrder.currencyCode)}</span>
          </div>
        ) : null}
        {settings.showTotal ? (
          <div className="flex justify-between gap-3 font-bold">
            <span>Total</span>
            <span>{formatAmount(total, previewOrder.currencyCode)}</span>
          </div>
        ) : null}
        {settings.showPaymentMethod ? (
          <div className="flex justify-between gap-3">
            <span>Paiement</span>
            <span>Cash</span>
          </div>
        ) : null}
        {settings.showAmountReceived ? (
          <div className="flex justify-between gap-3">
            <span>Montant recu</span>
            <span>{formatAmount(paid, previewOrder.currencyCode)}</span>
          </div>
        ) : null}
        {settings.showOriginalAmount && showOriginalPayment ? (
          <div className="flex justify-between gap-3">
            <span>Remis client</span>
            <span>{formatAmount(originalPaid, originalCurrencyCode)}</span>
          </div>
        ) : null}
        {settings.showChange ? (
          <div className="flex justify-between gap-3 font-bold">
            <span>Monnaie</span>
            <span>{formatAmount(change, previewOrder.currencyCode)}</span>
          </div>
        ) : null}
      </div>

      {settings.showLoyaltyPoints ? (
        <>
          <div className="my-2 border-t border-dashed border-black" />
          <div>Points gagnes: {previewOrder.loyaltyPoints}</div>
        </>
      ) : null}

      <div className="my-2 border-t border-dashed border-black" />
      {settings.showFooterText ? (
        <div className="text-center whitespace-pre-wrap">
          {settings.footerText || "Merci pour votre achat"}
        </div>
      ) : null}
    </div>
  );
};

const ReceiptSettingsPage = () => {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const showToast = useToastStore((state) => state.showToast);
  const [settings, setSettings] = useState(DEFAULT_RECEIPT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const canRead = hasAnyPermission(user, ["settings.read"]);
  const canUpdate = hasAnyPermission(user, ["settings.update"]);

  useEffect(() => {
    if (!accessToken || !canRead) return;

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const payload = await requestJson("/api/receipt-settings/current", {
          token: accessToken,
        });
        if (active) {
          setSettings({
            ...DEFAULT_RECEIPT_SETTINGS,
            ...(payload || {}),
          });
        }
      } catch (error) {
        if (active) {
          if (shouldSkipPermissionToast(error)) {
            return;
          }
          showToast({
            title: "Erreur",
            message:
              error.message || "Impossible de charger les parametres du ticket.",
            variant: "danger",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [accessToken, canRead, showToast]);

  const groupedToggles = useMemo(
    () => [
      toggleFields.slice(0, 6),
      toggleFields.slice(6, 12),
      toggleFields.slice(12),
    ],
    [],
  );

  const setField = (key, value) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (!canUpdate) return;
    setSaving(true);
    try {
      const payload = await requestJson("/api/receipt-settings/current", {
        method: "PATCH",
        token: accessToken,
        body: settings,
      });
      setSettings({
        ...DEFAULT_RECEIPT_SETTINGS,
        ...(payload || {}),
      });
      showToast({
        title: "Ticket enregistre",
        message: "Les parametres du ticket de vente ont ete sauvegardes.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible d'enregistrer le ticket.",
        variant: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = () => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove();
      }, 1000);
    };

    iframe.onload = () => {
      try {
        const frameWindow = iframe.contentWindow;
        if (!frameWindow) {
          throw new Error("Fenetre d'impression indisponible.");
        }

        frameWindow.focus();
        frameWindow.print();
        cleanup();

        showToast({
          title: "Test impression",
          message: "Le ticket test a ete envoye a l'impression.",
          variant: "success",
        });
      } catch (error) {
        cleanup();
        showToast({
          title: "Impression impossible",
          message: error.message || "Le ticket test n'a pas pu etre imprime.",
          variant: "warning",
        });
      }
    };

    document.body.appendChild(iframe);
    const frameDocument =
      iframe.contentWindow?.document || iframe.contentDocument;

    if (!frameDocument) {
      iframe.remove();
      showToast({
        title: "Impression impossible",
        message: "Le moteur d'impression du navigateur n'est pas disponible.",
        variant: "warning",
      });
      return;
    }

    frameDocument.open();
    frameDocument.write(buildPrintableReceiptHtml({ settings, user }));
    frameDocument.close();
  };

  if (!canRead) {
    return (
      <section className="flex h-full w-full flex-col gap-4 p-4">
        <div className={cardClassName}>
          <h1 className="text-xl font-semibold text-text-primary">Ticket de vente</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Vous n'avez pas les permissions necessaires pour consulter cette page.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full w-full flex-col gap-4 p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Ticket de vente</h1>
          <p className="text-sm text-text-secondary">
            Configurez l'en-tete, le pied de ticket, le format, le logo et les
            informations visibles sur le ticket.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleTestPrint}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-primary transition hover:border-primary/40"
          >
            <Printer size={16} />
            Test impression
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-primary transition hover:border-primary/40"
          >
            <Eye size={16} />
            Apercu
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canUpdate || saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Sauvegarde..." : "Enregistrer"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-4">
          <div className={cardClassName}>
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <ReceiptText size={18} />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-text-primary">Contenu</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Definissez les textes libres et le format physique du ticket.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-text-primary">Format du ticket</label>
                <select
                  value={settings.paperFormat}
                  onChange={(event) => setField("paperFormat", event.target.value)}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                >
                  <option value="58mm">58 mm</option>
                  <option value="80mm">80 mm</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-text-primary">URL du logo</label>
                <input
                  type="text"
                  value={settings.logoUrl}
                  onChange={(event) => setField("logoUrl", event.target.value)}
                  placeholder="https://... ou /uploads/..."
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                />
              </div>
              <div className="grid gap-2 lg:col-span-2">
                <label className="text-sm font-medium text-text-primary">En-tete du ticket</label>
                <textarea
                  rows={3}
                  value={settings.headerText}
                  onChange={(event) => setField("headerText", event.target.value)}
                  placeholder="Ex: Avenue de la Paix, Kinshasa"
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                />
              </div>
              <div className="grid gap-2 lg:col-span-2">
                <label className="text-sm font-medium text-text-primary">Pied de ticket</label>
                <textarea
                  rows={3}
                  value={settings.footerText}
                  onChange={(event) => setField("footerText", event.target.value)}
                  placeholder="Ex: Merci pour votre achat"
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                />
              </div>
            </div>
          </div>

          <div className={cardClassName}>
            <h2 className="text-base font-semibold text-text-primary">Elements affiches</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Activez ou masquez chaque bloc du ticket selon vos besoins.
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {groupedToggles.map((group, groupIndex) => (
                <div
                  key={`group-${groupIndex}`}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="space-y-3">
                    {group.map((field) => (
                      <label
                        key={field.key}
                        className="flex items-center justify-between gap-3 text-sm text-text-primary"
                      >
                        <span>{field.label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(settings[field.key])}
                          onChange={(event) => setField(field.key, event.target.checked)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={cardClassName}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Apercu rapide</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Rendu instantane du ticket avec les reglages courants.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="text-sm font-medium text-primary transition hover:opacity-80"
            >
              Ouvrir
            </button>
          </div>

          <div className="mt-4 flex justify-center overflow-auto rounded-2xl bg-background p-4">
            <ReceiptPreview settings={settings} user={user} />
          </div>
        </div>
      </div>

      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Apercu du ticket</h3>
                <p className="text-sm text-text-secondary">
                  Verification du format, du logo et des informations affichees.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-xl border border-border bg-background p-2 text-text-secondary transition hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex justify-center bg-background p-6">
              <ReceiptPreview settings={settings} user={user} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default ReceiptSettingsPage;
