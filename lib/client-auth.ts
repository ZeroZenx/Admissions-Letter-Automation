"use client";

import {
  AccountInfo,
  InteractionRequiredAuthError,
  PublicClientApplication,
  type Configuration
} from "@azure/msal-browser";

export type ClientAuthState = {
  mode: "development" | "entra";
  status: "loading" | "authenticated" | "unauthenticated" | "misconfigured";
  accountName?: string;
  roles?: ClientUserRole[];
  error?: string;
};

export type ClientUserRole = "Admin" | "Admissions Supervisor" | "Counselor" | "Viewer";

const clientUserRoles: ClientUserRole[] = ["Admin", "Admissions Supervisor", "Counselor", "Viewer"];
let msalInstance: PublicClientApplication | null = null;

const authMode = (process.env.NEXT_PUBLIC_AUTH_MODE ?? "development") as "development" | "entra";
const clientId = process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID ?? "";
const tenantId = process.env.NEXT_PUBLIC_ENTRA_TENANT_ID ?? "";
const redirectUri = process.env.NEXT_PUBLIC_ENTRA_REDIRECT_URI ?? (typeof window === "undefined" ? "" : window.location.origin);
const apiScope = process.env.NEXT_PUBLIC_ENTRA_API_SCOPE || (clientId ? `api://${clientId}/access_as_user` : "");
const graphScopes = (process.env.NEXT_PUBLIC_GRAPH_SCOPES ?? "User.Read Mail.Send").split(/\s+/).filter(Boolean);

export async function getClientAuthState(): Promise<ClientAuthState> {
  if (authMode === "development") {
    return { mode: "development", status: "authenticated", accountName: "Development Admin", roles: ["Admin"] };
  }

  if (!clientId || !tenantId || !apiScope) {
    return {
      mode: "entra",
      status: "misconfigured",
      error: "NEXT_PUBLIC_ENTRA_CLIENT_ID, NEXT_PUBLIC_ENTRA_TENANT_ID, and NEXT_PUBLIC_ENTRA_API_SCOPE are required."
    };
  }

  const msal = await getMsal();
  const redirectResult = await msal.handleRedirectPromise();
  const account = redirectResult?.account ?? getActiveAccount(msal);
  if (account) {
    msal.setActiveAccount(account);
    return { mode: "entra", status: "authenticated", accountName: account.name ?? account.username, roles: parseClientRoles(account) };
  }

  return { mode: "entra", status: "unauthenticated" };
}

export async function login() {
  if (authMode === "development") {
    window.location.href = "/";
    return;
  }
  const msal = await getMsal();
  await msal.loginRedirect({ scopes: [apiScope, ...graphScopes] });
}

export async function logout() {
  if (authMode === "development") return;
  const msal = await getMsal();
  await msal.logoutRedirect({ postLogoutRedirectUri: redirectUri });
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (authMode === "development") {
    headers.set("x-dev-role", "Admin");
    return fetch(input, { ...init, headers });
  }

  const token = await acquireApiToken();
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export async function authenticatedGraphFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (authMode === "development") {
    headers.set("x-dev-role", "Admin");
    return fetch(input, { ...init, headers });
  }

  const [apiToken, graphToken] = await Promise.all([acquireApiToken(), acquireGraphToken()]);
  headers.set("Authorization", `Bearer ${apiToken}`);
  headers.set("x-graph-access-token", graphToken);
  return fetch(input, { ...init, headers });
}

async function acquireApiToken() {
  return acquireToken([apiScope]);
}

async function acquireGraphToken() {
  return acquireToken(graphScopes);
}

async function acquireToken(scopes: string[]) {
  const msal = await getMsal();
  const account = getActiveAccount(msal);
  if (!account) throw new Error("Sign in before continuing.");

  try {
    const result = await msal.acquireTokenSilent({ account, scopes });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({ account, scopes });
    }
    throw error;
  }
}

async function getMsal() {
  if (!msalInstance) {
    const config: Configuration = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri
      },
      cache: {
        cacheLocation: "sessionStorage"
      }
    };
    msalInstance = new PublicClientApplication(config);
    await msalInstance.initialize();
  }
  return msalInstance;
}

function getActiveAccount(msal: PublicClientApplication): AccountInfo | null {
  return msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
}

function parseClientRoles(account: AccountInfo): ClientUserRole[] {
  const claims = account.idTokenClaims as Record<string, unknown> | undefined;
  const claimValue = claims?.roles ?? claims?.role ?? claims?.groups;
  const values = Array.isArray(claimValue) ? claimValue : typeof claimValue === "string" ? [claimValue] : [];
  const parsed = values.filter((role): role is ClientUserRole => clientUserRoles.includes(role as ClientUserRole));
  return parsed.length ? parsed : ["Viewer"];
}
