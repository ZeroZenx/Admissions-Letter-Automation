import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { defaultSettings } from "../lib/settings";

test("defaultSettings provides production email defaults", () => {
  assert.equal(defaultSettings.email.defaultSubject, "Your COSTAATT admissions letter");
  assert.match(defaultSettings.email.defaultBody, /admissions letter attached/);
  assert.equal(defaultSettings.email.stalePendingMinutes, 30);
  assert.equal(defaultSettings.pdf.converter, "libreoffice");
});

test("settings expose stale pending send timeout control", async () => {
  const settingsSource = await readFile("lib/settings.ts", "utf8");
  const routeSource = await readFile("app/api/settings/route.ts", "utf8");
  const clientSource = await readFile("components/app-client.tsx", "utf8");

  assert.match(settingsSource, /email\.stalePendingMinutes/);
  assert.match(routeSource, /stalePendingMinutes: z\.coerce\.number\(\)\.int\(\)\.min\(5\)\.max\(1440\)/);
  assert.match(routeSource, /email\.stalePendingMinutes/);
  assert.match(clientSource, /Stale pending send timeout minutes/);
  assert.match(clientSource, /stalePendingMinutes: Number\(event\.target\.value\)/);
});
