import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// C10.4. The file storage budget is 1 GB for the whole team, shared with
// database backups, and an upload whose art:attach never ran is referenced by
// nothing, so only a sweep can find it. Daily is enough: the sweep ignores
// anything younger than 24 hours anyway, so a shorter interval would find the
// same set.
crons.daily("sweep orphaned art", { hourUTC: 3, minuteUTC: 20 }, internal.art.sweepOrphans, {});

export default crons;
