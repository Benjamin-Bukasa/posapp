const buildAccountCreationEmail = ({
  tenantName,
  identifier,
  tempPassword,
}) => {
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const logoUrl =
    process.env.COMPANY_LOGO_URL ||
    "https://via.placeholder.com/160x44?text=POSapp";
  const bannerUrl = process.env.EMAIL_BANNER_URL || "";
  const companyName = process.env.COMPANY_NAME || "POSapp";
  const companyAddress = process.env.COMPANY_ADDRESS || "Kinshasa, RDC";
  const supportEmail = process.env.COMPANY_SUPPORT_EMAIL || "support@POSapp.com";
  const supportPhone = process.env.COMPANY_SUPPORT_PHONE || "+243 000 000 000";
  const year = new Date().getFullYear();

  const subject = "Création de compte POSapp";

  const text = `Bonjour,

Votre compte pour la pharmacie ${tenantName} est créé.
Identifiant: ${identifier}
Mot de passe temporaire: ${tempPassword}

Pour des raisons de sécurité, veuillez changer votre mot de passe dès la première connexion.
Accéder à l'application: ${appUrl}

Merci,
L'équipe ${companyName}`;

  const html = `
  <div style="font-family: 'Poppins', Arial, sans-serif; color: #111827; background: #f3f4f6; padding: 32px;">
    <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
      <div style="background: #1D473F; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between;">
        <img src="${logoUrl}" alt="${companyName}" style="height: 40px;" />
        <span style="color: #D8F274; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Compte créé</span>
      </div>
      <div style="height: 4px; background: #D8F274;"></div>
      ${
        bannerUrl
          ? `<img src="${bannerUrl}" alt="POSapp" style="width: 100%; display: block;" />`
          : ""
      }
      <div style="padding: 26px 28px;">
        <div style="color: #6b7280; font-size: 12px; margin-bottom: 8px;">Bonjour,</div>
        <h2 style="margin: 0 0 10px; font-size: 22px; color: #111827;">
          Bienvenue sur ${companyName}
        </h2>
        <p style="margin: 0 0 18px; line-height: 1.6; color: #374151;">
          Votre compte pour la pharmacie <strong style="color:#1D473F;">${tenantName}</strong> est maintenant actif.
        </p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px 18px; border-radius: 12px; margin-bottom: 18px;">
          <div style="display: flex; flex-wrap: wrap; gap: 12px;">
            <div style="min-width: 220px;">
              <div style="font-size: 12px; color: #6b7280;">Identifiant</div>
              <div style="font-weight: 600; color: #111827;">${identifier}</div>
            </div>
            <div style="min-width: 220px;">
              <div style="font-size: 12px; color: #6b7280;">Mot de passe temporaire</div>
              <div style="font-weight: 600; color: #111827;">${tempPassword}</div>
            </div>
          </div>
        </div>
        <p style="margin: 0 0 20px; line-height: 1.6; color: #374151;">
          Pour votre sécurité, veuillez modifier ce mot de passe lors de votre première connexion.
        </p>
        <a href="${appUrl}" style="display: inline-block; background: #002E31; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600;">
          Accéder à l'application
        </a>
        <p style="margin: 14px 0 0; font-size: 12px; color: #6b7280;">
          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
          <span style="color:#1D473F;">${appUrl}</span>
        </p>
      </div>
      <div style="padding: 18px 24px; background: #f3f4f6; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
          Besoin d'aide ? Contactez notre support : <span style="color:#1D473F;">${supportEmail}</span> • ${supportPhone}
        </div>
        <div style="font-size: 11px; color: #9ca3af; line-height: 1.5;">
          ${companyName}, ${companyAddress}. Tous droits réservés © ${year}.<br/>
          Ceci est un message automatique. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.
        </div>
      </div>
    </div>
  </div>
  `;

  return { subject, text, html };
};

const buildSubscriptionCreatedEmail = ({
  tenantName,
  plan,
  billingCycle,
  price,
  endsAt,
}) => {
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const logoUrl =
    process.env.COMPANY_LOGO_URL ||
    "https://via.placeholder.com/160x44?text=POSapp";
  const companyName = process.env.COMPANY_NAME || "POSapp";
  const companyAddress = process.env.COMPANY_ADDRESS || "Kinshasa, RDC";
  const supportEmail = process.env.COMPANY_SUPPORT_EMAIL || "support@POSapp.com";
  const supportPhone = process.env.COMPANY_SUPPORT_PHONE || "+243 000 000 000";
  const year = new Date().getFullYear();

  const subject = "Confirmation d'abonnement POSapp";
  const endsAtLabel = endsAt ? new Date(endsAt).toLocaleDateString("fr-FR") : "";
  const cycleLabel = billingCycle === "ANNUAL" ? "Annuel" : "Mensuel";

  const text = `Bonjour,

Votre abonnement POSapp est actif.
Pharmacie: ${tenantName}
Plan: ${plan}
Cycle: ${cycleLabel}
Montant: $${price}
Fin de période: ${endsAtLabel}

Accéder à l'application: ${appUrl}

Merci,
L'équipe ${companyName}`;

  const html = `
  <div style="font-family: 'Poppins', Arial, sans-serif; color: #111827; background: #f3f4f6; padding: 32px;">
    <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
      <div style="background: #1D473F; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between;">
        <img src="${logoUrl}" alt="${companyName}" style="height: 40px;" />
        <span style="color: #D8F274; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Abonnement actif</span>
      </div>
      <div style="height: 4px; background: #D8F274;"></div>
      <div style="padding: 26px 28px;">
        <div style="color: #6b7280; font-size: 12px; margin-bottom: 8px;">Bonjour,</div>
        <h2 style="margin: 0 0 10px; font-size: 22px; color: #111827;">
          Confirmation d'abonnement
        </h2>
        <p style="margin: 0 0 18px; line-height: 1.6; color: #374151;">
          Votre abonnement POSapp est actif pour la pharmacie <strong style="color:#1D473F;">${tenantName}</strong>.
        </p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px 18px; border-radius: 12px; margin-bottom: 18px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
            <div>
              <div style="font-size: 12px; color: #6b7280;">Plan</div>
              <div style="font-weight: 600; color: #111827;">${plan}</div>
            </div>
            <div>
              <div style="font-size: 12px; color: #6b7280;">Cycle</div>
              <div style="font-weight: 600; color: #111827;">${cycleLabel}</div>
            </div>
            <div>
              <div style="font-size: 12px; color: #6b7280;">Montant</div>
              <div style="font-weight: 600; color: #111827;">$${price}</div>
            </div>
            <div>
              <div style="font-size: 12px; color: #6b7280;">Fin de période</div>
              <div style="font-weight: 600; color: #111827;">${endsAtLabel}</div>
            </div>
          </div>
        </div>
        <a href="${appUrl}" style="display: inline-block; background: #002E31; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600;">
          Accéder à l'application
        </a>
      </div>
      <div style="padding: 18px 24px; background: #f3f4f6; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
          Support : <span style="color:#1D473F;">${supportEmail}</span> • ${supportPhone}
        </div>
        <div style="font-size: 11px; color: #9ca3af; line-height: 1.5;">
          ${companyName}, ${companyAddress}. Tous droits réservés © ${year}.
        </div>
      </div>
    </div>
  </div>
  `;

  return { subject, text, html };
};

const buildSubscriptionExpiredEmail = ({ tenantName, plan, endsAt }) => {
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const logoUrl =
    process.env.COMPANY_LOGO_URL ||
    "https://via.placeholder.com/160x44?text=POSapp";
  const companyName = process.env.COMPANY_NAME || "POSapp";
  const supportEmail = process.env.COMPANY_SUPPORT_EMAIL || "support@POSapp.com";
  const supportPhone = process.env.COMPANY_SUPPORT_PHONE || "+243 000 000 000";
  const year = new Date().getFullYear();
  const endsAtLabel = endsAt ? new Date(endsAt).toLocaleDateString("fr-FR") : "";

  const subject = "Abonnement expiré - POSapp";
  const text = `Bonjour,

Votre abonnement POSapp pour la pharmacie ${tenantName} a expiré le ${endsAtLabel}.
Plan: ${plan}

Veuillez renouveler votre abonnement pour réactiver vos utilisateurs.
Accéder à l'application: ${appUrl}

L'équipe ${companyName}`;

  const html = `
  <div style="font-family: 'Poppins', Arial, sans-serif; color: #111827; background: #f3f4f6; padding: 32px;">
    <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
      <div style="background: #1D473F; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between;">
        <img src="${logoUrl}" alt="${companyName}" style="height: 40px;" />
        <span style="color: #D8F274; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Action requise</span>
      </div>
      <div style="height: 4px; background: #D8F274;"></div>
      <div style="padding: 26px 28px;">
        <h2 style="margin: 0 0 10px; font-size: 22px; color: #111827;">
          Abonnement expiré
        </h2>
        <p style="margin: 0 0 18px; line-height: 1.6; color: #374151;">
          Votre abonnement pour la pharmacie <strong style="color:#1D473F;">${tenantName}</strong> a expiré le <strong>${endsAtLabel}</strong>.
        </p>
        <p style="margin: 0 0 18px; line-height: 1.6; color: #374151;">
          Pour réactiver l'accès de vos utilisateurs, merci de renouveler votre abonnement.
        </p>
        <a href="${appUrl}" style="display: inline-block; background: #002E31; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600;">
          Renouveler maintenant
        </a>
      </div>
      <div style="padding: 18px 24px; background: #f3f4f6; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
          Support : <span style="color:#1D473F;">${supportEmail}</span> • ${supportPhone}
        </div>
        <div style="font-size: 11px; color: #9ca3af; line-height: 1.5;">
          ${companyName}. Tous droits réservés © ${year}.
        </div>
      </div>
    </div>
  </div>
  `;

  return { subject, text, html };
};

const buildSubscriptionPostExpiredEmail = ({ tenantName, plan, endsAt }) => {
  const payload = buildSubscriptionExpiredEmail({ tenantName, plan, endsAt });
  return {
    ...payload,
    subject: "Rappel : abonnement expiré - POSapp",
  };
};

const buildSubscriptionWarningEmail = ({ tenantName, plan, endsAt, daysLeft }) => {
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const logoUrl =
    process.env.COMPANY_LOGO_URL ||
    "https://via.placeholder.com/160x44?text=POSapp";
  const companyName = process.env.COMPANY_NAME || "POSapp";
  const supportEmail = process.env.COMPANY_SUPPORT_EMAIL || "support@POSapp.com";
  const supportPhone = process.env.COMPANY_SUPPORT_PHONE || "+243 000 000 000";
  const year = new Date().getFullYear();
  const endsAtLabel = endsAt ? new Date(endsAt).toLocaleDateString("fr-FR") : "";

  const reminderLabel =
    daysLeft === 0
      ? "aujourd'hui"
      : `dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`;
  const subject =
    daysLeft === 0
      ? "Rappel : abonnement POSapp expire aujourd'hui"
      : `Rappel : abonnement POSapp expire ${reminderLabel}`;
  const text = `Bonjour,

Votre abonnement POSapp pour la pharmacie ${tenantName} expire ${reminderLabel} (le ${endsAtLabel}).
Plan: ${plan}

Pour éviter toute interruption, veuillez renouveler votre abonnement.
Accéder à l'application: ${appUrl}

L'équipe ${companyName}`;

  const html = `
  <div style="font-family: 'Poppins', Arial, sans-serif; color: #111827; background: #f3f4f6; padding: 32px;">
    <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
      <div style="background: #1D473F; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between;">
        <img src="${logoUrl}" alt="${companyName}" style="height: 40px;" />
        <span style="color: #D8F274; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Rappel</span>
      </div>
      <div style="height: 4px; background: #D8F274;"></div>
      <div style="padding: 26px 28px;">
        <h2 style="margin: 0 0 10px; font-size: 22px; color: #111827;">
          Votre abonnement expire bientôt
        </h2>
        <p style="margin: 0 0 18px; line-height: 1.6; color: #374151;">
          L'abonnement de la pharmacie <strong style="color:#1D473F;">${tenantName}</strong> expire
          <strong>${reminderLabel}</strong> (le ${endsAtLabel}).
        </p>
        <p style="margin: 0 0 18px; line-height: 1.6; color: #374151;">
          Plan actuel : <strong>${plan}</strong>. Pour éviter toute interruption, veuillez renouveler votre abonnement.
        </p>
        <a href="${appUrl}" style="display: inline-block; background: #002E31; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600;">
          Renouveler maintenant
        </a>
      </div>
      <div style="padding: 18px 24px; background: #f3f4f6; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
          Support : <span style="color:#1D473F;">${supportEmail}</span> • ${supportPhone}
        </div>
        <div style="font-size: 11px; color: #9ca3af; line-height: 1.5;">
          ${companyName}. Tous droits réservés © ${year}.
        </div>
      </div>
    </div>
  </div>
  `;

  return { subject, text, html };
};

const buildSubscriptionRenewedEmail = ({
  tenantName,
  plan,
  billingCycle,
  price,
  endsAt,
}) => {
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const logoUrl =
    process.env.COMPANY_LOGO_URL ||
    "https://via.placeholder.com/160x44?text=POSapp";
  const companyName = process.env.COMPANY_NAME || "POSapp";
  const supportEmail = process.env.COMPANY_SUPPORT_EMAIL || "support@POSapp.com";
  const supportPhone = process.env.COMPANY_SUPPORT_PHONE || "+243 000 000 000";
  const year = new Date().getFullYear();
  const endsAtLabel = endsAt ? new Date(endsAt).toLocaleDateString("fr-FR") : "";
  const cycleLabel = billingCycle === "ANNUAL" ? "Annuel" : "Mensuel";

  const subject = "Abonnement renouvelé - POSapp";
  const text = `Bonjour,

Votre abonnement a été renouvelé.
Pharmacie: ${tenantName}
Plan: ${plan}
Cycle: ${cycleLabel}
Montant: $${price}
Fin de période: ${endsAtLabel}

Accéder à l'application: ${appUrl}

L'équipe ${companyName}`;

  const html = `
  <div style="font-family: 'Poppins', Arial, sans-serif; color: #111827; background: #f3f4f6; padding: 32px;">
    <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
      <div style="background: #1D473F; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between;">
        <img src="${logoUrl}" alt="${companyName}" style="height: 40px;" />
        <span style="color: #D8F274; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Abonnement renouvelé</span>
      </div>
      <div style="height: 4px; background: #D8F274;"></div>
      <div style="padding: 26px 28px;">
        <h2 style="margin: 0 0 10px; font-size: 22px; color: #111827;">
          Merci pour votre confiance
        </h2>
        <p style="margin: 0 0 18px; line-height: 1.6; color: #374151;">
          Votre abonnement pour la pharmacie <strong style="color:#1D473F;">${tenantName}</strong> a été renouvelé.
        </p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px 18px; border-radius: 12px; margin-bottom: 18px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
            <div>
              <div style="font-size: 12px; color: #6b7280;">Plan</div>
              <div style="font-weight: 600; color: #111827;">${plan}</div>
            </div>
            <div>
              <div style="font-size: 12px; color: #6b7280;">Cycle</div>
              <div style="font-weight: 600; color: #111827;">${cycleLabel}</div>
            </div>
            <div>
              <div style="font-size: 12px; color: #6b7280;">Montant</div>
              <div style="font-weight: 600; color: #111827;">$${price}</div>
            </div>
            <div>
              <div style="font-size: 12px; color: #6b7280;">Fin de période</div>
              <div style="font-weight: 600; color: #111827;">${endsAtLabel}</div>
            </div>
          </div>
        </div>
        <a href="${appUrl}" style="display: inline-block; background: #002E31; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600;">
          Accéder à l'application
        </a>
      </div>
      <div style="padding: 18px 24px; background: #f3f4f6; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
          Support : <span style="color:#1D473F;">${supportEmail}</span> • ${supportPhone}
        </div>
        <div style="font-size: 11px; color: #9ca3af; line-height: 1.5;">
          ${companyName}. Tous droits réservés © ${year}.
        </div>
      </div>
    </div>
  </div>
  `;

  return { subject, text, html };
};

module.exports = {
  buildAccountCreationEmail,
  buildSubscriptionCreatedEmail,
  buildSubscriptionExpiredEmail,
  buildSubscriptionPostExpiredEmail,
  buildSubscriptionWarningEmail,
  buildSubscriptionRenewedEmail,
};
