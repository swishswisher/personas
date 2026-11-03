import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { authDatabase, authTransaction } from "./auth-database";
import { queueMail } from "./outbox";
import { googleReady } from "./config";
export const auth = betterAuth({
  appName: "Personas",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: googleReady()
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          accessType: "online",
          includeGrantedScopes: false,
          prompt: "select_account",
        },
      }
    : {},
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      requireLocalEmailVerified: true,
      allowDifferentEmails: false,
    },
  },
  database: prismaAdapter(authDatabase, {
    provider: "postgresql",
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) =>
      queueMail(
        user.email,
        "Reset your Personas password",
        "Reset your password using this private link:\n" + url,
        undefined,
        authTransaction.getStore(),
      ),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) =>
      queueMail(
        user.email,
        "Verify your Personas email",
        "Welcome to Personas. Verify your email using this private link:\n" +
          url,
        undefined,
        authTransaction.getStore(),
      ),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 12,
    cookieCache: { enabled: false },
  },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
  advanced: {
    disableOriginCheck: false,
    disableCSRFCheck: false,
    database: { generateId: () => crypto.randomUUID() },
  },
  plugins: [nextCookies()],
});
export async function requestActor(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.emailVerified) return null;
  return session.user;
}
