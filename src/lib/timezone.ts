export const APP_TIME_ZONE = 'America/Bogota'; // GMT-5 without DST

export function getDatePartsInAppTimeZone(
  value: string | Date,
): { day: string; month: string; year: string } | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('es-CO', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);

  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;

  if (!day || !month || !year) {
    return null;
  }

  return { day, month, year };
}
