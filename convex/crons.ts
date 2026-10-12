import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "purge expired analytics attribution",
  "10 0 * * *",
  internal.analytics.purgeExpired,
  {},
);

crons.cron(
  "purge expired active carts",
  "20 0 * * *",
  internal.activeCarts.purgeExpired,
  {},
);

crons.cron(
  "purge expired abandoned carts",
  "30 0 * * *",
  internal.abandonedCartRecovery.purgeExpired,
  {},
);

crons.interval(
  "cancel stale pending orders",
  { minutes: 15 },
  internal.orders.cancelStalePending,
  {},
);

export default crons;
