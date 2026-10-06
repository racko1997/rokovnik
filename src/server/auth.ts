import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { appUrl, vercelUrls } from "@/lib/app-url";
import { db } from "./db/client";
import * as schema from "./db/schema";
import { resetPasswordEmail, verifyEmailEmail } from "./emails/auth";
import { sendUserEmail } from "./notify";

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
    resetPasswordTokenExpiresIn: 60 * 60,
    // Nova lozinka odjavljuje sve ostale uređaje (ako je neko drugi znao staru)
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendUserEmail({ to: user.email, ...resetPasswordEmail(user.name, url) });
    },
  },
  // Blaga potvrda: nalog radi odmah, a u aplikaciji stoji podsjetnik dok se email ne potvrdi
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24 * 3,
    sendVerificationEmail: async ({ user, url }) => {
      await sendUserEmail({ to: user.email, ...verifyEmailEmail(user.name, url) });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // nextCookies mora biti posljednji — postavlja kolačiće iz server akcija
  plugins: [nextCookies()],
});
