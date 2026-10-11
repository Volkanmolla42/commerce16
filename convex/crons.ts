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

export default crons;
