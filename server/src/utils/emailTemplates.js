const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getBranding = () => ({
  appUrl: process.env.APP_URL || "http://localhost:5173",
  logoUrl:
    process.env.COMPANY_LOGO_URL ||
    "https://via.placeholder.com/160x44?text=POSapp",
  bannerUrl: process.env.EMAIL_BANNER_URL || "",
  companyName: process.env.COMPANY_NAME || "POSapp",
  companyAddress: process.env.COMPANY_ADDRESS || "Kinshasa, RDC",
  supportEmail: process.env.COMPANY_SUPPORT_EMAIL || "support@POSapp.com",
  supportPhone: process.env.COMPANY_SUPPORT_PHONE || "+243 000 000 000",
  year: new Date().getFullYear(),
});

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("fr-FR") : "");

const buildSummaryTable = (items = []) => {
  const safeItems = Array.isArray(items)
    ? items.filter((item) => item?.label && item?.value !== undefined && item?.value !== null && item?.value !== "")
    : [];

  if (!safeItems.length) {
    return "";
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; background:#f8fafc; border:1px solid #dbe3ea;">
      ${safeItems
        .map(
          (item, index) => `
            <tr>
              <td valign="top" width="36%" style="padding:12px 14px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:18px; color:#667085; border-bottom:${index === safeItems.length - 1 ? "0" : "1px solid #e5e7eb"};">
                ${escapeHtml(item.label)}
              </td>
              <td valign="top" style="padding:12px 14px; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:20px; color:#101828; font-weight:700; border-bottom:${index === safeItems.length - 1 ? "0" : "1px solid #e5e7eb"};">
                ${escapeHtml(item.value)}
              </td>
            </tr>`,
        )
        .join("")}
    </table>
  `;
};

const buildButton = ({ href, label, background = "#0f766e" }) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
    <tr>
      <td align="center" bgcolor="${background}" style="border-radius:4px; background:${background};">
        <a href="${escapeHtml(href)}" style="display:inline-block; padding:14px 22px; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:18px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:4px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>
`;

const buildDualButtons = ({ primary, secondary }) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr>
      <td style="padding:0 12px 12px 0;">
        ${buildButton(primary)}
      </td>
      <td style="padding:0 0 12px 0;">
        ${buildButton(secondary)}
      </td>
    </tr>
  </table>
`;

const buildEmailLayout = ({
  preheader,
  eyebrow,
  title,
  greeting = "Bonjour,",
  intro,
  contentHtml = "",
  footerNote = "",
}) => {
  const {
    logoUrl,
    bannerUrl,
    companyName,
    companyAddress,
    supportEmail,
    supportPhone,
    year,
  } = getBranding();

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#eef2f6;">
    <div style="display:none; font-size:1px; color:#eef2f6; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      ${escapeHtml(preheader || title)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; background:#eef2f6; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px; width:100%; border-collapse:collapse;">
            <tr>
              <td style="background:#143b37; padding:22px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td valign="middle" align="left">
                      <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}" style="display:block; height:40px; border:0;" />
                    </td>
                    <td valign="middle" align="right" style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; font-weight:700; color:#d8f274; text-transform:uppercase; letter-spacing:1px;">
                      ${escapeHtml(eyebrow)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="height:5px; line-height:5px; font-size:0; background:#d8f274;">&nbsp;</td>
            </tr>
            ${
              bannerUrl
                ? `<tr>
              <td style="background:#ffffff;">
                <img src="${escapeHtml(bannerUrl)}" alt="${escapeHtml(companyName)}" style="display:block; width:100%; max-width:680px; border:0;" />
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="background:#ffffff; border-left:1px solid #d7dee7; border-right:1px solid #d7dee7;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="padding:30px 28px 22px 28px; font-family:Arial,Helvetica,sans-serif; color:#101828;">
                      <div style="font-size:12px; line-height:18px; color:#667085; margin-bottom:8px;">
                        ${escapeHtml(greeting)}
                      </div>
                      <div style="font-size:28px; line-height:34px; font-weight:700; color:#101828; margin-bottom:12px;">
                        ${escapeHtml(title)}
                      </div>
                      <div style="font-size:15px; line-height:24px; color:#475467; margin-bottom:22px;">
                        ${intro}
                      </div>
                      ${contentHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc; border:1px solid #d7dee7; border-top:0; padding:20px 28px;">
                <div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:18px; color:#667085; margin-bottom:8px;">
                  Support: <span style="color:#143b37; font-weight:700;">${escapeHtml(supportEmail)}</span> | ${escapeHtml(supportPhone)}
                </div>
                ${
                  footerNote
                    ? `<div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:18px; color:#667085; margin-bottom:8px;">
                    ${footerNote}
                  </div>`
                    : ""
                }
                <div style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:17px; color:#98a2b3;">
                  ${escapeHtml(companyName)}, ${escapeHtml(companyAddress)}. Tous droits reserves &copy; ${year}.<br />
                  Ceci est un message automatique.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const buildAccountCreationEmail = ({ tenantName, identifier, tempPassword }) => {
  const { appUrl, companyName } = getBranding();
  const subject = "Creation de compte POSapp";

  const text = `Bonjour,

Votre compte pour la boutique ${tenantName} est cree.
Identifiant: ${identifier}
Mot de passe temporaire: ${tempPassword}

Pour des raisons de securite, veuillez changer votre mot de passe des la premiere connexion.
Acceder a l'application: ${appUrl}

Merci,
L'equipe ${companyName}`;

  const html = buildEmailLayout({
    preheader: `Votre compte ${companyName} est pret.`,
    eyebrow: "Compte cree",
    title: `Bienvenue sur ${companyName}`,
    intro: `Votre compte pour la boutique <strong style="color:#143b37;">${escapeHtml(
      tenantName,
    )}</strong> est maintenant actif.`,
    contentHtml: `
      ${buildSummaryTable([
        { label: "Identifiant", value: identifier },
        { label: "Mot de passe temporaire", value: tempPassword },
      ])}
      <div style="height:18px; line-height:18px; font-size:0;">&nbsp;</div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:22px; color:#475467; margin-bottom:18px;">
        Pour votre securite, modifiez ce mot de passe lors de votre premiere connexion.
      </div>
      ${buildButton({ href: appUrl, label: "Acceder a l'application", background: "#002e31" })}
      <div style="height:14px; line-height:14px; font-size:0;">&nbsp;</div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:18px; color:#667085;">
        Si le bouton ne fonctionne pas, ouvrez directement ce lien:<br />
        <span style="color:#143b37; font-weight:700;">${escapeHtml(appUrl)}</span>
      </div>
    `,
    footerNote: `Si vous n'etes pas a l'origine de cette demande, ignorez simplement cet email.`,
  });

  return { subject, text, html };
};

const buildSubscriptionCreatedEmail = ({
  tenantName,
  plan,
  billingCycle,
  price,
  endsAt,
}) => {
  const { appUrl, companyName } = getBranding();
  const cycleLabel = billingCycle === "ANNUAL" ? "Annuel" : "Mensuel";
  const endsAtLabel = formatDate(endsAt);
  const subject = "Confirmation d'abonnement POSapp";

  const text = `Bonjour,

Votre abonnement POSapp est actif.
Boutique: ${tenantName}
Plan: ${plan}
Cycle: ${cycleLabel}
Montant: $${price}
Fin de periode: ${endsAtLabel}

Acceder a l'application: ${appUrl}

Merci,
L'equipe ${companyName}`;

  const html = buildEmailLayout({
    preheader: "Votre abonnement POSapp est actif.",
    eyebrow: "Abonnement actif",
    title: "Confirmation d'abonnement",
    intro: `Votre abonnement est actif pour la boutique <strong style="color:#143b37;">${escapeHtml(
      tenantName,
    )}</strong>.`,
    contentHtml: `
      ${buildSummaryTable([
        { label: "Plan", value: plan },
        { label: "Cycle", value: cycleLabel },
        { label: "Montant", value: `$${price}` },
        { label: "Fin de periode", value: endsAtLabel },
      ])}
      <div style="height:18px; line-height:18px; font-size:0;">&nbsp;</div>
      ${buildButton({ href: appUrl, label: "Acceder a l'application", background: "#002e31" })}
    `,
  });

  return { subject, text, html };
};

const buildSubscriptionExpiredEmail = ({ tenantName, plan, endsAt }) => {
  const { appUrl, companyName } = getBranding();
  const endsAtLabel = formatDate(endsAt);
  const subject = "Abonnement expire - POSapp";

  const text = `Bonjour,

Votre abonnement POSapp pour la boutique ${tenantName} a expire le ${endsAtLabel}.
Plan: ${plan}

Veuillez renouveler votre abonnement pour reactiver vos utilisateurs.
Acceder a l'application: ${appUrl}

L'equipe ${companyName}`;

  const html = buildEmailLayout({
    preheader: "Votre abonnement a expire.",
    eyebrow: "Action requise",
    title: "Abonnement expire",
    intro: `Votre abonnement pour la boutique <strong style="color:#143b37;">${escapeHtml(
      tenantName,
    )}</strong> a expire le <strong>${escapeHtml(endsAtLabel)}</strong>.`,
    contentHtml: `
      ${buildSummaryTable([
        { label: "Plan", value: plan },
        { label: "Date d'expiration", value: endsAtLabel },
      ])}
      <div style="height:18px; line-height:18px; font-size:0;">&nbsp;</div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:22px; color:#475467; margin-bottom:18px;">
        Renouvelez votre abonnement pour retablir l'acces de vos utilisateurs sans attendre.
      </div>
      ${buildButton({ href: appUrl, label: "Renouveler maintenant", background: "#b42318" })}
    `,
  });

  return { subject, text, html };
};

const buildSubscriptionPostExpiredEmail = ({ tenantName, plan, endsAt }) => {
  const payload = buildSubscriptionExpiredEmail({ tenantName, plan, endsAt });
  return {
    ...payload,
    subject: "Rappel : abonnement expire - POSapp",
  };
};

const buildSubscriptionWarningEmail = ({ tenantName, plan, endsAt, daysLeft }) => {
  const { appUrl, companyName } = getBranding();
  const endsAtLabel = formatDate(endsAt);
  const reminderLabel =
    daysLeft === 0 ? "aujourd'hui" : `dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`;
  const subject =
    daysLeft === 0
      ? "Rappel : abonnement POSapp expire aujourd'hui"
      : `Rappel : abonnement POSapp expire ${reminderLabel}`;

  const text = `Bonjour,

Votre abonnement POSapp pour la boutique ${tenantName} expire ${reminderLabel} (le ${endsAtLabel}).
Plan: ${plan}

Pour eviter toute interruption, veuillez renouveler votre abonnement.
Acceder a l'application: ${appUrl}

L'equipe ${companyName}`;

  const html = buildEmailLayout({
    preheader: `Votre abonnement expire ${reminderLabel}.`,
    eyebrow: "Rappel",
    title: "Votre abonnement expire bientot",
    intro: `L'abonnement de la boutique <strong style="color:#143b37;">${escapeHtml(
      tenantName,
    )}</strong> expire <strong>${escapeHtml(reminderLabel)}</strong> (le ${escapeHtml(
      endsAtLabel,
    )}).`,
    contentHtml: `
      ${buildSummaryTable([
        { label: "Plan actuel", value: plan },
        { label: "Expiration", value: endsAtLabel },
      ])}
      <div style="height:18px; line-height:18px; font-size:0;">&nbsp;</div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:22px; color:#475467; margin-bottom:18px;">
        Renouvelez maintenant pour eviter toute interruption de service.
      </div>
      ${buildButton({ href: appUrl, label: "Renouveler maintenant", background: "#b54708" })}
    `,
  });

  return { subject, text, html };
};

const buildSubscriptionRenewedEmail = ({
  tenantName,
  plan,
  billingCycle,
  price,
  endsAt,
}) => {
  const { appUrl, companyName } = getBranding();
  const endsAtLabel = formatDate(endsAt);
  const cycleLabel = billingCycle === "ANNUAL" ? "Annuel" : "Mensuel";
  const subject = "Abonnement renouvele - POSapp";

  const text = `Bonjour,

Votre abonnement a ete renouvele.
Boutique: ${tenantName}
Plan: ${plan}
Cycle: ${cycleLabel}
Montant: $${price}
Fin de periode: ${endsAtLabel}

Acceder a l'application: ${appUrl}

L'equipe ${companyName}`;

  const html = buildEmailLayout({
    preheader: "Votre abonnement a bien ete renouvele.",
    eyebrow: "Abonnement renouvele",
    title: "Merci pour votre confiance",
    intro: `Votre abonnement pour la boutique <strong style="color:#143b37;">${escapeHtml(
      tenantName,
    )}</strong> a ete renouvele avec succes.`,
    contentHtml: `
      ${buildSummaryTable([
        { label: "Plan", value: plan },
        { label: "Cycle", value: cycleLabel },
        { label: "Montant", value: `$${price}` },
        { label: "Fin de periode", value: endsAtLabel },
      ])}
      <div style="height:18px; line-height:18px; font-size:0;">&nbsp;</div>
      ${buildButton({ href: appUrl, label: "Acceder a l'application", background: "#002e31" })}
    `,
  });

  return { subject, text, html };
};

const buildApprovalRequestEmail = ({
  recipientName,
  documentLabel,
  documentSummary = [],
  approveUrl,
  rejectUrl,
}) => {
  const { appUrl, companyName, supportEmail, supportPhone } = getBranding();
  const safeSummary = Array.isArray(documentSummary)
    ? documentSummary.filter((item) => item?.label && item?.value)
    : [];
  const subject = `Validation requise - ${documentLabel}`;

  const text = `Bonjour ${recipientName || ""},

Une validation est requise pour ${documentLabel}.
${safeSummary.map((item) => `${item.label}: ${item.value}`).join("\n")}

Valider: ${approveUrl}
Rejeter: ${rejectUrl}

Application: ${appUrl}
Support: ${supportEmail} / ${supportPhone}`;

  const html = buildEmailLayout({
    preheader: `Une validation vous attend pour ${documentLabel}.`,
    eyebrow: "Validation requise",
    title: "Une action de validation vous attend",
    greeting: `Bonjour ${recipientName || ""},`,
    intro: `Merci de traiter <strong style="color:#143b37;">${escapeHtml(
      documentLabel,
    )}</strong> des que possible.`,
    contentHtml: `
      ${buildSummaryTable(safeSummary)}
      <div style="height:20px; line-height:20px; font-size:0;">&nbsp;</div>
      ${buildDualButtons({
        primary: {
          href: approveUrl,
          label: "Valider",
          background: "#0f766e",
        },
        secondary: {
          href: rejectUrl,
          label: "Rejeter",
          background: "#b42318",
        },
      })}
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:19px; color:#667085; margin-top:6px;">
        Ces liens expirent automatiquement. Si besoin, vous pouvez aussi traiter cette demande dans l'application <span style="color:#143b37; font-weight:700;">${escapeHtml(
          companyName,
        )}</span>.
      </div>
      <div style="height:12px; line-height:12px; font-size:0;">&nbsp;</div>
      <div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:19px; color:#667085;">
        Lien application: <span style="color:#143b37; font-weight:700;">${escapeHtml(appUrl)}</span>
      </div>
    `,
    footerNote: `Si vous n'etes pas concerne par cette demande, ignorez cet email.`,
  });

  return { subject, text, html };
};

module.exports = {
  buildAccountCreationEmail,
  buildApprovalRequestEmail,
  buildSubscriptionCreatedEmail,
  buildSubscriptionExpiredEmail,
  buildSubscriptionPostExpiredEmail,
  buildSubscriptionWarningEmail,
  buildSubscriptionRenewedEmail,
};
