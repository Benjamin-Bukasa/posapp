const prisma = require("../config/prisma");
const { sendEmail, isEmailConfigured } = require("./notificationService");
const { buildApprovalRequestEmail } = require("../utils/emailTemplates");
const {
  createApprovalActionToken,
  ensureApprovalActionTokenTable,
} = require("../utils/approvalActionTokenStore");

const ACTION_BASE_URL =
  process.env.APPROVAL_ACTION_BASE_URL ||
  process.env.API_PUBLIC_URL ||
  process.env.SERVER_PUBLIC_URL ||
  process.env.BACKEND_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "http://localhost:5000";

const getActionLinkBase = () =>
  `${String(ACTION_BASE_URL).replace(/\/+$/, "")}/api/approval-actions`;

const getApprovalTokenExpiry = () => {
  const ttlHours = Number(process.env.APPROVAL_EMAIL_TOKEN_TTL_HOURS || 72);
  const safeHours = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 72;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + safeHours);
  return expiresAt;
};

const dedupeUsers = (users = []) => {
  const seen = new Set();
  return users.filter((user) => {
    if (!user?.id || !user?.email) return false;
    if (seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
};

const resolveApprovalRecipients = async (tenantId, approval) => {
  if (approval?.approverId) {
    const user = await prisma.user.findFirst({
      where: {
        id: approval.approverId,
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });
    return dedupeUsers(user ? [user] : []);
  }

  if (!approval?.approverRole) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      tenantId,
      role: approval.approverRole,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return dedupeUsers(users);
};

const sendApprovalRequestEmails = async ({
  tenantId,
  documentType,
  documentId,
  approval,
  documentLabel,
  documentSummary,
}) => {
  if (!tenantId || !documentId || !approval || !isEmailConfigured()) {
    return { sent: 0, skipped: true };
  }

  await ensureApprovalActionTokenTable();
  const recipients = await resolveApprovalRecipients(tenantId, approval);
  if (!recipients.length) {
    return { sent: 0, skipped: true };
  }

  let sent = 0;
  for (const recipient of recipients) {
    const expiresAt = getApprovalTokenExpiry();
    const approveToken = await createApprovalActionToken({
      tenantId,
      documentType,
      documentId,
      stepOrder: approval.stepOrder,
      approverUserId: recipient.id,
      recipientEmail: recipient.email,
      action: "APPROVED",
      expiresAt,
    });
    const rejectToken = await createApprovalActionToken({
      tenantId,
      documentType,
      documentId,
      stepOrder: approval.stepOrder,
      approverUserId: recipient.id,
      recipientEmail: recipient.email,
      action: "REJECTED",
      expiresAt,
    });

    const emailPayload = buildApprovalRequestEmail({
      recipientName:
        [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") ||
        recipient.email,
      documentLabel,
      documentSummary,
      approveUrl: `${getActionLinkBase()}/${approveToken}`,
      rejectUrl: `${getActionLinkBase()}/${rejectToken}`,
    });

    await sendEmail({
      to: recipient.email,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html,
    });
    sent += 1;
  }

  return { sent };
};

const notifyStockEntryApprovalStep = async ({ stockEntry, approval }) =>
  sendApprovalRequestEmails({
    tenantId: stockEntry?.tenantId,
    documentType: "STOCK_ENTRY",
    documentId: stockEntry?.id,
    approval,
    documentLabel: "l'entree de stock en attente",
    documentSummary: [
      { label: "Document", value: stockEntry?.id || "--" },
      { label: "Source", value: stockEntry?.sourceType || "--" },
      { label: "Boutique", value: stockEntry?.store?.name || "--" },
      { label: "Zone", value: stockEntry?.storageZone?.name || "--" },
      {
        label: "Cree par",
        value:
          [stockEntry?.createdBy?.firstName, stockEntry?.createdBy?.lastName]
            .filter(Boolean)
            .join(" ") || stockEntry?.createdBy?.email || "--",
      },
      {
        label: "Lignes",
        value: String(Array.isArray(stockEntry?.items) ? stockEntry.items.length : 0),
      },
    ],
  });

const notifyInventoryApprovalStep = async ({ session, approval }) =>
  sendApprovalRequestEmails({
    tenantId: session?.tenantId,
    documentType: "INVENTORY_SESSION",
    documentId: session?.id,
    approval,
    documentLabel: "l'inventaire en attente",
    documentSummary: [
      { label: "Code", value: session?.code || session?.id || "--" },
      { label: "Boutique", value: session?.store?.name || "--" },
      { label: "Zone", value: session?.storageZone?.name || "--" },
      {
        label: "Demande par",
        value:
          [session?.requestedBy?.firstName, session?.requestedBy?.lastName]
            .filter(Boolean)
            .join(" ") || session?.requestedBy?.email || "--",
      },
      {
        label: "Lignes",
        value: String(Array.isArray(session?.items) ? session.items.length : 0),
      },
      { label: "Statut", value: session?.status || "--" },
    ],
  });

const notifySupplyRequestApprovalStep = async ({ request, approval }) =>
  sendApprovalRequestEmails({
    tenantId: request?.tenantId,
    documentType: "SUPPLY_REQUEST",
    documentId: request?.id,
    approval,
    documentLabel: "la requisition en attente",
    documentSummary: [
      { label: "Code", value: request?.code || request?.id || "--" },
      { label: "Titre", value: request?.title || "--" },
      { label: "Boutique", value: request?.store?.name || "--" },
      { label: "Zone", value: request?.storageZone?.name || "--" },
      {
        label: "Demande par",
        value:
          [request?.requestedBy?.firstName, request?.requestedBy?.lastName]
            .filter(Boolean)
            .join(" ") || request?.requestedBy?.email || "--",
      },
      {
        label: "Lignes",
        value: String(Array.isArray(request?.items) ? request.items.length : 0),
      },
      { label: "Statut", value: request?.status || "--" },
    ],
  });

module.exports = {
  notifyStockEntryApprovalStep,
  notifyInventoryApprovalStep,
  notifySupplyRequestApprovalStep,
};
