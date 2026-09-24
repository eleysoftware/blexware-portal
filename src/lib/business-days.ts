/** Returns the UTC date reached after moving forward by weekdays only. */
export function addBusinessDays(value: string | Date, days: number): Date {
  const date = new Date(value);
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return date;
}

export function isBusinessDayDue(value: string | Date, days: number, now = new Date()): boolean {
  return addBusinessDays(value, days).getTime() <= now.getTime();
}