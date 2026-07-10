export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "ZYND",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api/v1",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379/0",
} as const;
