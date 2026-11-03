export function appUrl() {
  return (
    process.env.APP_URL ||
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_BRANCH_URL
      ? "https://" + process.env.VERCEL_BRANCH_URL
      : process.env.VERCEL_URL
        ? "https://" + process.env.VERCEL_URL
        : "http://localhost:3100")
  );
}
export function localEmailCapture() {
  try {
    return (
      process.env.LOCAL_EMAIL_CAPTURE === "true" &&
      ["localhost", "127.0.0.1"].includes(new URL(appUrl()).hostname)
    );
  } catch {
    return false;
  }
}
export function emailReady() {
  return (
    !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) ||
    localEmailCapture()
  );
}
export function googleReady() {
  return !!(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}
