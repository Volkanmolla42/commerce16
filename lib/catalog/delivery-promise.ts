const istanbulClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Istanbul",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const weekdayIndexes: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getSameDayDispatchCountdown(
  now: number,
  cutoffMinutes: number | null,
  shippingDays: number[],
) {
  if (cutoffMinutes === null || !Number.isFinite(now)) return null;

  const parts = Object.fromEntries(
    istanbulClock.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const weekday = weekdayIndexes[parts.weekday];
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  if (weekday === undefined || !shippingDays.includes(weekday)) return null;

  const secondsLeft = cutoffMinutes * 60 - (hour * 3600 + minute * 60 + second);
  if (secondsLeft <= 0) return null;

  const minutesLeft = Math.ceil(secondsLeft / 60);
  return {
    hours: Math.floor(minutesLeft / 60),
    minutes: minutesLeft % 60,
  };
}
