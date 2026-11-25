/** Server-side helpers for the attendee view: sunset, the "moment" line, money. */
export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/** Sunset in Sapporo (43.06 N, 141.35 E) to the minute, for the demo's date range. */
export function sunsetSapporo(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  // Days since the March equinox drives the solar declination.
  const dayOfYear = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
  const lat = (43.06 * Math.PI) / 180;
  const decl = (0.409 * Math.sin(((2 * Math.PI) * (dayOfYear - 81)) / 365)) as number;
  const cosH = -Math.tan(lat) * Math.tan((decl * Math.PI) / 180);
  const hourAngle = (Math.acos(Math.max(-1, Math.min(1, cosH))) * 12) / Math.PI; // hours from noon
  // Equation of time (minutes), simple Spencer formula.
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364;
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  // Solar noon in Sapporo: 12:00 JST - (141.35 - 135) * 4 min + eot
  const solarNoon = 720 - (141.35 - 135) * 4 + eot;
  const sunsetMin = solarNoon + hourAngle * 60;
  const hh = Math.floor(sunsetMin / 60);
  const mm = Math.round(sunsetMin % 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function yen(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}
