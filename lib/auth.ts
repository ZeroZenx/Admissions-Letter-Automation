import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";

export const roles = ["Admin", "Admissions Supervisor", "Counselor", "Viewer"] as const;
export type UserRole = (typeof roles)[number];

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  roles: UserRole[];
  accessToken?: string;
};

const roleSchema = z.enum(roles);

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function requireAuth(request: Request, allowedRoles: UserRole[] = [...roles]) {
  const env = getServerEnv();
  if (env.AUTH_MODE === "development") {
    const role = roleSchema.catch("Admin").parse(request.headers.get("x-dev-role") ?? "Admin");
    if (!allowedRoles.includes(role)) {
      throw new HttpError(403, "You do not have permission to perform this action.");
    }
    return {
      id: "development-user",
      email: "admin@costaatt.edu.tt",
      displayName: "Development Admin",
      roles: [role],
      accessToken: request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    } satisfies AuthenticatedUser;
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "A Microsoft Entra bearer token is required.");
  }

  const accessToken = authorization.slice("Bearer ".length);
  const issuer = `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/discovery/v2.0/keys`));
  const verified = await jwtVerify(accessToken, jwks, {
    issuer,
    audience: env.ENTRA_CLIENT_ID
  });

  const claims = verified.payload;
  const userRoles = parseRoles(claims.roles ?? claims.groups ?? claims.role);
  if (!userRoles.some((role) => allowedRoles.includes(role))) {
    throw new HttpError(403, "You do not have permission to perform this action.");
  }

  return {
    id: String(claims.oid ?? claims.sub),
    email: String(claims.preferred_username ?? claims.email ?? ""),
    displayName: String(claims.name ?? "COSTAATT user"),
    roles: userRoles,
    accessToken
  } satisfies AuthenticatedUser;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

function parseRoles(value: unknown): UserRole[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const parsed = values.filter((value): value is UserRole => roles.includes(value as UserRole));
  return parsed.length ? parsed : ["Viewer"];
}
