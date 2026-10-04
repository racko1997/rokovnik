import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { appUrl, vercelUrls } from "@/lib/app-url";
import { db } from "./db/client";
import * as schema from "./db/schema";

export const auth = betterAuth({
  baseURL: appUrl() || undefined,
  // Vercel daje posebnu adresu za svaku probnu verziju — i tamo prijava mora raditi
  trustedOrigins: [appUrl(), ...vercelUrls()].filter(Boolean),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // nextCookies mora biti posljednji — postavlja kolačiće iz server akcija
  plugins: [nextCookies()],
});
