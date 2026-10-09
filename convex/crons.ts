import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "purge expired analytics attribution",
  { hourUTC: 0, minuteUTC: 10 },
  internal.analytics.purgeExpired,
  {},
);

crons.daily(
  "purge expired active carts",
  { hourUTC: 0, minuteUTC: 20 },
  internal.activeCarts.purgeExpired,
  {},
);

export default crons;
