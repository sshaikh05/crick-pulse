export const safeAppRedirect = (value: string | null | undefined, fallback = "/") => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return fallback;
  return value;
};
