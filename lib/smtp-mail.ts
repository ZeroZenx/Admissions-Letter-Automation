import nodemailer from "nodemailer";

export type SmtpConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  senderEmail: string;
};

type SmtpMailInput = {
  recipient: string;
  subject: string;
  body: string;
  attachmentName: string;
  attachmentContent: Buffer;
};

export async function verifySmtp(configuration: SmtpConfiguration) {
  await createTransport(configuration).verify();
}

export async function sendSmtpTestMail(configuration: SmtpConfiguration) {
  await createTransport(configuration).sendMail({
    from: configuration.senderEmail,
    to: configuration.senderEmail,
    subject: "COSTAATT Admissions Automation email test",
    html: "<p>This test confirms that COSTAATT Admissions Letter Automation can send email from this mailbox.</p>",
    disableFileAccess: true,
    disableUrlAccess: true
  });
}

export function smtpDiagnosticMessage(error: unknown) {
  const code = smtpErrorValue(error, "code");
  const responseCode = smtpErrorValue(error, "responseCode");
  if (code === "EAUTH" || responseCode === "535") {
    return "Microsoft 365 rejected the sign-in. Use the full email address as the SMTP username, then verify the password and that SMTP AUTH is enabled for the mailbox.";
  }
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED"].includes(code)) {
    return "The SMTP server could not be reached. Check the server, port, TLS setting, firewall, and internet connection.";
  }
  return "The test email could not be sent. Check the SMTP mailbox settings and try again.";
}

export async function sendSmtpMail(configuration: SmtpConfiguration, input: SmtpMailInput) {
  await createTransport(configuration).sendMail({
    from: configuration.senderEmail,
    to: input.recipient,
    subject: input.subject,
    html: input.body,
    attachments: [{ filename: input.attachmentName, content: input.attachmentContent }],
    disableFileAccess: true,
    disableUrlAccess: true
  });
}

function createTransport(configuration: SmtpConfiguration) {
  return nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    auth: { user: configuration.username, pass: configuration.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    tls: { rejectUnauthorized: true }
  });
}

function smtpErrorValue(error: unknown, key: "code" | "responseCode") {
  if (typeof error !== "object" || error === null || !(key in error)) return "";
  return String((error as Record<string, unknown>)[key]);
}
