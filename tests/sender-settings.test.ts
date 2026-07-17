import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decryptSecret, encryptSecret } from "../lib/secret-crypto";

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
  assert.match(bulkSource, /settings\?\.email\.provider === "graph"/);
});

test("SMTP transport disables file and URL access and enforces TLS certificates", async () => {
  const source = await readFile("lib/smtp-mail.ts", "utf8");
  assert.match(source, /disableFileAccess: true/);
  assert.match(source, /disableUrlAccess: true/);
  assert.match(source, /rejectUnauthorized: true/);
});
