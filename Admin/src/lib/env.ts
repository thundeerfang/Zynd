export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "ZYND Admin",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379/0",
} as const;
