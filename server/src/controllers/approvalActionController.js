const {
  getApprovalActionToken,
  markApprovalActionTokenUsed,
} = require("../utils/approvalActionTokenStore");
const { processStockEntryApprovalDecision } = require("./stockEntryController");
const { processInventorySessionApprovalDecision } = require("./inventorySessionController");
const { processSupplyRequestApprovalDecision } = require("./supplyRequestController");

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildResultPage = ({
  title,
  message,
  tone = "success",
}) => {
  const accent = tone === "danger" ? "#b91c1c" : "#0f766e";
  const label = tone === "danger" ? "Action impossible" : "Action traitée";

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;font-family:Arial,sans-serif;background:#f3f4f6;color:#111827;">
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
          <div style="max-width:560px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 12px 36px rgba(15,23,42,.08);">
            <div style="padding:18px 24px;background:${accent};color:#fff;font-weight:700;">${label}</div>
            <div style="padding:24px;">
              <h1 style="margin:0 0 12px;font-size:24px;">${escapeHtml(title)}</h1>
              <p style="margin:0;line-height:1.7;color:#374151;">${escapeHtml(message)}</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

const executeApprovalAction = async (req, res) => {
  try {
    const tokenRecord = await getApprovalActionToken(req.params.token);
    if (!tokenRecord) {
      return res
        .status(404)
        .send(
          buildResultPage({
            title: "Lien introuvable",
            message:
              "Ce lien de validation n'existe pas ou n'est plus disponible.",
            tone: "danger",
          }),
        );
    }

    if (tokenRecord.usedAt) {
      return res
        .status(410)
        .send(
          buildResultPage({
            title: "Lien déjà utilisé",
            message:
              "Cette action a déjà été traitée. Retournez dans l'application pour vérifier le statut du document.",
            tone: "danger",
          }),
        );
    }

    if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      return res
        .status(410)
        .send(
          buildResultPage({
            title: "Lien expiré",
            message:
              "Ce lien de validation a expiré. Demandez l'envoi d'un nouvel email si nécessaire.",
            tone: "danger",
          }),
        );
    }

    if (tokenRecord.documentType === "STOCK_ENTRY") {
      await processStockEntryApprovalDecision({
        tenantId: tokenRecord.tenantId,
        entryId: tokenRecord.documentId,
        user: tokenRecord.approver,
        decision: tokenRecord.action,
        note: "Validation par lien email sécurisé.",
      });
      await markApprovalActionTokenUsed(tokenRecord);

      return res.send(
        buildResultPage({
          title:
            tokenRecord.action === "APPROVED"
              ? "Entrée de stock validée"
              : "Entrée de stock rejetée",
          message:
            tokenRecord.action === "APPROVED"
              ? "L'entrée de stock a bien été validée. Vous pouvez fermer cette page."
              : "L'entrée de stock a bien été rejetée. Vous pouvez fermer cette page.",
        }),
      );
    }

    if (tokenRecord.documentType === "INVENTORY_SESSION") {
      await processInventorySessionApprovalDecision({
        tenantId: tokenRecord.tenantId,
        sessionId: tokenRecord.documentId,
        user: tokenRecord.approver,
        decision: tokenRecord.action,
        note: "Validation par lien email securise.",
      });
      await markApprovalActionTokenUsed(tokenRecord);

      return res.send(
        buildResultPage({
          title:
            tokenRecord.action === "APPROVED"
              ? "Inventaire valide"
              : "Inventaire rejete",
          message:
            tokenRecord.action === "APPROVED"
              ? "L'inventaire a bien ete valide. Vous pouvez fermer cette page."
              : "L'inventaire a bien ete rejete. Vous pouvez fermer cette page.",
        }),
      );
    }

    if (tokenRecord.documentType === "SUPPLY_REQUEST") {
      await processSupplyRequestApprovalDecision({
        tenantId: tokenRecord.tenantId,
        requestId: tokenRecord.documentId,
        user: tokenRecord.approver,
        decision: tokenRecord.action,
        note: "Validation par lien email securise.",
      });
      await markApprovalActionTokenUsed(tokenRecord);

      return res.send(
        buildResultPage({
          title:
            tokenRecord.action === "APPROVED"
              ? "Requisition validee"
              : "Requisition rejetee",
          message:
            tokenRecord.action === "APPROVED"
              ? "La requisition a bien ete validee. Vous pouvez fermer cette page."
              : "La requisition a bien ete rejetee. Vous pouvez fermer cette page.",
        }),
      );
    }

    return res
      .status(400)
      .send(
        buildResultPage({
          title: "Workflow non pris en charge",
          message:
            "Ce type de document n'est pas encore disponible pour la validation par email.",
          tone: "danger",
        }),
      );
  } catch (error) {
    return res
      .status(error.status || 500)
      .send(
        buildResultPage({
          title: "Action impossible",
          message:
            error.message ||
            "La validation par email n'a pas pu être traitée.",
          tone: "danger",
        }),
      );
  }
};

module.exports = {
  executeApprovalAction,
};
