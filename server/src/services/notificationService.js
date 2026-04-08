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

const parseSender = () => {
  const explicitEmail = readEnv("BREVO_SENDER_EMAIL");
  const explicitName = readEnv("BREVO_SENDER_NAME");
  if (explicitEmail) {
    return {
      email: explicitEmail,
      name: explicitName || undefined,
    };
  }

  const from =
    readEnv("SMTP_FROM") ||
    readEnv("COMPANY_SUPPORT_EMAIL") ||
    "no-reply@POSapp.local";

  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return {
      name: match[1]?.trim() || undefined,
      email: match[2]?.trim(),
    };
  }

  return {
    email: from,
    name: undefined,
  };
};

const getEmailProvider = () => {
  if (readEnv("BREVO_API_KEY")) return "brevo";
  if (readEnv("SMTP_HOST")) return "smtp";
  return "none";
};

const isEmailConfigured = () => {
  if (getEmailProvider() === "brevo") {
    const sender = parseSender();
    return Boolean(sender.email);
  }

  const host = readEnv("SMTP_HOST");
  const port = Number(readEnv("SMTP_PORT", "587"));
  return Boolean(host) && !Number.isNaN(port);
};

const getEmailDebugInfo = () => ({
  provider: getEmailProvider(),
  host: readEnv("SMTP_HOST") || null,
  port: Number(readEnv("SMTP_PORT", "587")),
  secure: readEnv("SMTP_SECURE", "false").toLowerCase() === "true",
  user: readEnv("SMTP_USER") || null,
  from: readEnv("SMTP_FROM") || readEnv("COMPANY_SUPPORT_EMAIL") || null,
  brevoSenderEmail: parseSender().email || null,
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

const buildEmailPayload = ({ text, html, message }) => {
  const finalText = text || message || "";
  const finalHtml =
    html ||
    (message
      ? `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">${message}</div>`
      : undefined);

  return { finalText, finalHtml };
};

const sendViaBrevo = async ({ to, subject, text, html, message }) => {
  const apiKey = readEnv("BREVO_API_KEY");
  const sender = parseSender();

  if (!apiKey || !sender.email) {
    console.log("[EMAIL][SKIPPED] Missing Brevo config", {
      to,
      subject,
      sender: sender.email || null,
    });
    return { skipped: true };
  }

  const { finalText, finalHtml } = buildEmailPayload({ text, html, message });

  const payload = {
    sender,
    to: [{ email: to }],
    subject,
    ...(finalHtml ? { htmlContent: finalHtml } : {}),
    ...(finalText ? { textContent: finalText } : {}),
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.code || `Brevo API error (${response.status})`,
    );
    error.status = response.status;
    error.meta = data;
    throw error;
  }

  console.log("[EMAIL][SENT]", {
    provider: "brevo",
    to,
    subject,
    messageId: data?.messageId || null,
  });

  return data;
};

const sendViaSmtp = async ({ to, subject, text, html, message }) => {
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

  const { finalText, finalHtml } = buildEmailPayload({ text, html, message });

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text: finalText || undefined,
    html: finalHtml,
  });

  console.log("[EMAIL][SENT]", {
    provider: "smtp",
    to,
    subject,
    messageId: info?.messageId || null,
    response: info?.response || null,
  });

  return info;
};

const sendEmail = async ({ to, subject, text, html, message }) => {
  const provider = getEmailProvider();

  if (provider === "brevo") {
    return sendViaBrevo({ to, subject, text, html, message });
  }

  return sendViaSmtp({ to, subject, text, html, message });
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
