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
