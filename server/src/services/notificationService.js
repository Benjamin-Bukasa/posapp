const nodemailer = require("nodemailer");

let cachedTransporter = null;

const readEnv = (name, fallback = "") => {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }

  const trimmed = String(raw).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
};

const isEmailConfigured = () => {
  const host = readEnv("SMTP_HOST");
  const port = Number(readEnv("SMTP_PORT", "587"));
  return Boolean(host) && !Number.isNaN(port);
};

const getEmailDebugInfo = () => ({
  host: readEnv("SMTP_HOST") || null,
  port: Number(readEnv("SMTP_PORT", "587")),
  secure: readEnv("SMTP_SECURE", "false").toLowerCase() === "true",
  user: readEnv("SMTP_USER") || null,
  from: readEnv("SMTP_FROM") || readEnv("COMPANY_SUPPORT_EMAIL") || null,
  configured: isEmailConfigured(),
});

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const host = readEnv("SMTP_HOST");
  const port = Number(readEnv("SMTP_PORT", "587"));
  const secureEnv = readEnv("SMTP_SECURE");
  const secure =
    typeof secureEnv === "string"
      ? secureEnv.toLowerCase() === "true"
      : port === 465;

  if (!host || Number.isNaN(port)) {
    return null;
  }

  const user = readEnv("SMTP_USER");
  const pass = readEnv("SMTP_PASS");
  const auth = user && pass ? { user, pass } : undefined;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
  });

  return cachedTransporter;
};

const sendEmail = async ({ to, subject, text, html, message }) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.log("[EMAIL][SKIPPED] Missing SMTP config", { to, subject });
    if (message || text || html) {
      console.log("[EMAIL][CONTENT]", { message, text, html });
    }
    return { skipped: true };
  }

  const from =
    readEnv("SMTP_FROM") ||
    readEnv("COMPANY_SUPPORT_EMAIL") ||
    "no-reply@POSapp.local";

  const finalText = text || message || "";
  const finalHtml =
    html ||
    (message
      ? `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">${message}</div>`
      : undefined);

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text: finalText || undefined,
    html: finalHtml,
  });

  console.log("[EMAIL][SENT]", {
    to,
    subject,
    messageId: info?.messageId || null,
    response: info?.response || null,
  });

  return info;
};

const sendSms = async ({ to, message }) => {
  console.log("[SMS]", { to, message });
};

module.exports = {
  sendEmail,
  sendSms,
  isEmailConfigured,
  getEmailDebugInfo,
};
