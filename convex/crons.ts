import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "purge expired analytics attribution",
  { hourUTC: 0, minuteUTC: 10 },
  internal.analytics.purgeExpired,
  {},
);

export default crons;
