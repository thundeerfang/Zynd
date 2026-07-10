export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "server";

  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];

  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `zynd-${Math.abs(hash)}`;
}
