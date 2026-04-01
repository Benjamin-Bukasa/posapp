const nodemailer = require("nodemailer");

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secureEnv = process.env.SMTP_SECURE;
  const secure =
    typeof secureEnv === "string"
      ? secureEnv.toLowerCase() === "true"
      : port === 465;

  if (!host || Number.isNaN(port)) {
    return null;
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
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
    process.env.SMTP_FROM ||
    process.env.COMPANY_SUPPORT_EMAIL ||
<<<<<<< HEAD
    "no-reply@POSapp.local";
=======
    "no-reply@neopharma.local";
>>>>>>> aed4c876093dd2e186d658b809f50bca4071b79d

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

  return info;
};

const sendSms = async ({ to, message }) => {
  console.log("[SMS]", { to, message });
};

module.exports = {
  sendEmail,
  sendSms,
};
