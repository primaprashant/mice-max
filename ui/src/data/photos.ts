/** Sapporo photos (from Unsplash, free license; sources in
   public/images/login/MANIFEST.md), served from /images/login as WebP.
   Each filename maps to a `login.photo<CamelName>` i18n key, so the credit
   string translates like every other string. Shared by the login page and
   the RoleSelector band. */
export const LOGIN_PHOTOS = [
  "odori-park-tv-tower-summer",
  "tv-tower-blue-sky",
  "tv-tower-skyline-dusk",
  "tv-tower-winter",
  "snowy-street-downtown",
  "odori-park-snow-night",
  "nikka-whisky-billboard-susukino",
  "moerenuma-park-glass-pyramid",
  "moine-mountains-ski-jump-city",
  "hokkaido-seafood-market",
  "hokkaido-shrine-snow",
  "sapporo-night-view-elevated",
  "sapporo-street-sunset-mountains",
  "sapporo-tram-street-day",
  "snowy-street-night-crowd",
  "susukino-snowy-storefront-night",
  "susukino-winter-illuminations",
  "tanukikoji-shopping-arcade-night",
  "tv-tower-panasonic-night-snow",
  "toyako-lake-winter-shore",
  "yokoshi-tomamu-flower-field",
];

/** The i18n key for a photo's credit line. */
export function creditKey(slug: string): string {
  const camel = slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `login.photo${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

/** A random photo slug, one pick per call. */
export function randomPhoto(): string {
  return LOGIN_PHOTOS[Math.floor(Math.random() * LOGIN_PHOTOS.length)]!;
}
