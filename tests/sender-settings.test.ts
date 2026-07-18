import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import test from "node:test";
import { decryptSecret, encryptSecret } from "../lib/secret-crypto";
import { sendSmtpMail, sendSmtpTestMail, smtpDiagnosticMessage } from "../lib/smtp-mail";

test("stored sender passwords are authenticated-encrypted and round trip", () => {
  const previous = process.env.APP_ENCRYPTION_KEY;
  process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const encrypted = encryptSecret("not-plain-text");
    assert.notEqual(encrypted, "not-plain-text");
    assert.match(encrypted, /^v1:/);
    assert.equal(decryptSecret(encrypted), "not-plain-text");
    assert.throws(() => decryptSecret(`${encrypted.slice(0, -2)}aa`));
  } finally {
    if (previous === undefined) delete process.env.APP_ENCRYPTION_KEY;
    else process.env.APP_ENCRYPTION_KEY = previous;
  }
});
test("sender settings never return the stored password to the browser", async () => {
  const settingsSource = await readFile("lib/settings.ts", "utf8");
  const routeSource = await readFile("app/api/settings/route.ts", "utf8");
  assert.match(settingsSource, /passwordConfigured: Boolean\(sender\?\.password_encrypted\)/);
  assert.doesNotMatch(routeSource, /password_encrypted/);
  assert.match(settingsSource, /encryptSecret\(settings\.email\.password\)/);
});

test("email sending selects Graph or SMTP from managed settings", async () => {
  const sendSource = await readFile("app/api/send-email/route.ts", "utf8");
  const bulkSource = await readFile("app/api/generate-bulk/route.ts", "utf8");
  assert.match(sendSource, /settings\.email\.provider === "smtp"/);
  assert.match(sendSource, /sendSmtpMail\(await getStoredSmtpConfiguration\(\), mail\)/);
  assert.match(sendSource, /sendGraphMail\(\{ accessToken: graphAccessToken, \.\.\.mail \}\)/);
  assert.doesNotMatch(sendSource, /AUTH_MODE|development/);
  assert.doesNotMatch(bulkSource, /sendSmtpMail|sendGraphMail|send-email/);
});

test("SMTP transport disables file and URL access and enforces TLS certificates", async () => {
  const source = await readFile("lib/smtp-mail.ts", "utf8");
  assert.match(source, /disableFileAccess: true/);
  assert.match(source, /disableUrlAccess: true/);
  assert.match(source, /rejectUnauthorized: true/);
});

test("SMTP sender authenticates and delivers a PDF attachment", async () => {
  const fixture = await startSmtpFixture("smtp-user", "smtp-password");
  try {
    await sendSmtpMail(
      {
        host: "127.0.0.1",
        port: fixture.port,
        secure: false,
        username: "smtp-user",
        password: "smtp-password",
        senderEmail: "admissions@costaatt.edu.tt"
      },
      {
        recipient: "applicant@example.com",
        subject: "COSTAATT admission decision",
        body: "<p>Your admissions letter is attached.</p>",
        attachmentName: "20260001-UOFFER.pdf",
        attachmentContent: Buffer.from("%PDF-1.7\nvalidated attachment")
      }
    );

    assert.equal(fixture.authenticated(), true);
    assert.match(fixture.message(), /From: admissions@costaatt\.edu\.tt/i);
    assert.match(fixture.message(), /To: applicant@example\.com/i);
    assert.match(fixture.message(), /Subject: COSTAATT admission decision/i);
    assert.match(fixture.message(), /Your admissions letter is attached/);
    assert.match(fixture.message(), /filename=20260001-UOFFER\.pdf/i);
    assert.match(fixture.message(), /JVBERi0xLjc/);
  } finally {
    await fixture.close();
  }
});

test("SMTP test sends a real message back to the configured sender", async () => {
  const fixture = await startSmtpFixture("admissions@costaatt.edu.tt", "smtp-password");
  try {
    await sendSmtpTestMail({
      host: "127.0.0.1",
      port: fixture.port,
      secure: false,
      username: "admissions@costaatt.edu.tt",
      password: "smtp-password",
      senderEmail: "admissions@costaatt.edu.tt"
    });

    assert.equal(fixture.authenticated(), true);
    assert.match(fixture.message(), /To: admissions@costaatt\.edu\.tt/i);
    assert.match(fixture.message(), /COSTAATT Admissions Automation email test/i);
  } finally {
    await fixture.close();
  }
});

test("SMTP authentication failures return actionable guidance without server details", () => {
  const message = smtpDiagnosticMessage({ code: "EAUTH", responseCode: 535, response: "internal server detail" });
  assert.match(message, /full email address/i);
  assert.match(message, /SMTP AUTH/i);
  assert.doesNotMatch(message, /internal server detail/i);
});

test("SMTP sender rejects invalid credentials without delivering a message", async () => {
  const fixture = await startSmtpFixture("smtp-user", "correct-password");
  try {
    await assert.rejects(
      sendSmtpMail(
        {
          host: "127.0.0.1",
          port: fixture.port,
          secure: false,
          username: "smtp-user",
          password: "wrong-password",
          senderEmail: "admissions@costaatt.edu.tt"
        },
        {
          recipient: "applicant@example.com",
          subject: "COSTAATT admission decision",
          body: "<p>Not delivered.</p>",
          attachmentName: "letter.pdf",
          attachmentContent: Buffer.from("%PDF-1.7")
        }
      ),
      /Invalid login|invalid credentials/i
    );
    assert.equal(fixture.authenticated(), false);
    assert.equal(fixture.message(), "");
  } finally {
    await fixture.close();
  }
});

async function startSmtpFixture(expectedUsername: string, expectedPassword: string) {
  let authenticated = false;
  let message = "";
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.setEncoding("utf8");
    socket.write("220 localhost ESMTP test server\r\n");
    let buffer = "";
    let receivingData = false;

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      let lineEnd = buffer.indexOf("\r\n");
      while (lineEnd >= 0) {
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        if (receivingData) {
          if (line === ".") {
            receivingData = false;
            socket.write("250 2.0.0 accepted\r\n");
          } else {
            message += `${line}\r\n`;
          }
        } else if (/^EHLO /i.test(line)) {
          socket.write("250-localhost\r\n250-AUTH PLAIN\r\n250 SIZE 10485760\r\n");
        } else if (/^AUTH PLAIN /i.test(line)) {
          const decoded = Buffer.from(line.slice("AUTH PLAIN ".length), "base64").toString("utf8");
          authenticated = decoded === `\0${expectedUsername}\0${expectedPassword}`;
          socket.write(authenticated ? "235 2.7.0 authenticated\r\n" : "535 5.7.8 invalid credentials\r\n");
        } else if (/^(MAIL FROM|RCPT TO):/i.test(line)) {
          socket.write("250 2.1.0 accepted\r\n");
        } else if (line === "DATA") {
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
          receivingData = true;
        } else if (line === "QUIT") {
          socket.end("221 2.0.0 bye\r\n");
        } else {
          socket.write("250 2.0.0 ok\r\n");
        }
        lineEnd = buffer.indexOf("\r\n");
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("SMTP fixture did not bind to a TCP port.");

  return {
    port: address.port,
    authenticated: () => authenticated,
    message: () => message,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  };
}
