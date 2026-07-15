import test from "node:test";
import assert from "node:assert/strict";
import { getAuthEnv, getClientAuthEnv } from "../lib/env";

test("production server auth rejects an accidental development configuration", () => {
  const original = snapshotAuthEnvironment();
  try {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.AUTH_MODE = "development";
    process.env.ALLOW_INSECURE_DEVELOPMENT_AUTH = "false";

    assert.throws(() => getAuthEnv(), /Development authentication is disabled in production/);
  } finally {
    restoreAuthEnvironment(original);
  }
});

test("production browser auth rejects an accidental development configuration", () => {
  const original = snapshotAuthEnvironment();
  try {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.NEXT_PUBLIC_AUTH_MODE = "development";
    process.env.ALLOW_INSECURE_DEVELOPMENT_AUTH = "false";

    assert.throws(() => getClientAuthEnv(), /Development authentication is disabled in production/);
  } finally {
    restoreAuthEnvironment(original);
  }
});

test("isolated production-like tests can deliberately enable development auth", () => {
  const original = snapshotAuthEnvironment();
  try {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.AUTH_MODE = "development";
    process.env.NEXT_PUBLIC_AUTH_MODE = "development";
    process.env.ALLOW_INSECURE_DEVELOPMENT_AUTH = "true";

    assert.equal(getAuthEnv().AUTH_MODE, "development");
    assert.equal(getClientAuthEnv().NEXT_PUBLIC_AUTH_MODE, "development");
  } finally {
    restoreAuthEnvironment(original);
  }
});

function snapshotAuthEnvironment() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_MODE: process.env.AUTH_MODE,
    NEXT_PUBLIC_AUTH_MODE: process.env.NEXT_PUBLIC_AUTH_MODE,
    ALLOW_INSECURE_DEVELOPMENT_AUTH: process.env.ALLOW_INSECURE_DEVELOPMENT_AUTH
  };
}

function restoreAuthEnvironment(values: ReturnType<typeof snapshotAuthEnvironment>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
