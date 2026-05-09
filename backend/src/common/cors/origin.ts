const DEFAULT_ALLOWED_ORIGINS = [
  'https://espace.md',
  'https://www.espace.md',
  'http://localhost:3000',
  'http://localhost:3001',
];

const VERCEL_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

function splitOriginList(value: string | undefined) {
  return (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getAllowedCorsOrigins() {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
  ].flatMap(splitOriginList);

  return [...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins].filter(
    (origin, index, origins) => origins.indexOf(origin) === index,
  );
}

export function assertProductionCorsIsSafe() {
  if (process.env.NODE_ENV !== 'production') return;
  if (getAllowedCorsOrigins().some((origin) => origin === '*')) {
    throw new Error('CORS wildcard is not allowed in production');
  }
}

export function isCorsOriginAllowed(origin?: string | null) {
  if (!origin) return true;
  if (getAllowedCorsOrigins().includes(origin)) return true;

  const allowVercelPreviews =
    (process.env.CORS_ALLOW_VERCEL_PREVIEWS ?? 'false').toLowerCase() ===
    'true';
  return allowVercelPreviews && VERCEL_PREVIEW_PATTERN.test(origin);
}

export function corsOriginCallback(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) {
  if (isCorsOriginAllowed(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error('Not allowed by CORS'));
}
