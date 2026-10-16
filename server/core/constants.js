/** Shared tuning values for the rhythm engine. Minutes are since local midnight. */

export const BUCKET_MINUTES = 30;
export const BUCKETS_PER_DAY = (24 * 60) / BUCKET_MINUTES;

/** Activity before 04:00 is treated as night-time movement, not "getting up". */
export const WAKE_FLOOR = 4 * 60;

/** The window in which long silences are meaningful. */
export const WAKING_START = 7 * 60;
export const WAKING_END = 21 * 60;

/** Night-time movement window for the "restless night" note. */
export const NIGHT_START = 1 * 60;
export const NIGHT_END = 4 * 60;

/** How many recent days teach the usual rhythm, and how many are needed before we judge. */
export const BASELINE_DAYS = 14;
export const MIN_BASELINE_DAYS = 5;

/** A day needs at least this many events to count as a representative day. */
export const MIN_EVENTS_PER_DAY = 3;

/** Floors so that a very regular routine never produces a hair-trigger alert. */
export const MIN_MORNING_TOLERANCE = 60;
export const MIN_GAP_THRESHOLD = 90;

/** A device that has been offline this long means "we cannot see", not "all is quiet". */
export const OFFLINE_GRACE_MINUTES = 30;

/** A doorway visit this recent explains a quiet spell. */
export const VISIT_CONTEXT_MINUTES = 90;
