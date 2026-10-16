/**
 * Time-of-day helpers in the household's own time zone.
 *
 * The rhythm of a day only makes sense in local time ("usually up by 7:15"),
 * so every calculation goes through an IANA zone name rather than the
 * server's clock. Daylight-saving changeover days can be off by up to an hour,
 * which is acceptable for a 30 minute bucketed rhythm.
 */

const formatters = new Map();

function formatter(tz) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

function parts(ts, tz) {
  const out = {};
  for (const p of formatter(tz).formatToParts(new Date(ts))) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
  };
}

/** Minutes since local midnight, 0 to 1439 (fractional part dropped). */
export function minutesOfDay(ts, tz) {
  const p = parts(ts, tz);
  return p.hour * 60 + p.minute;
}

/** Local calendar day as `YYYY-MM-DD`. */
export function dayKey(ts, tz) {
  const p = parts(ts, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Epoch milliseconds of local midnight at the start of the day containing `ts`. */
export function startOfDay(ts, tz) {
  const p = parts(ts, tz);
  const sinceMidnightMs = ((p.hour * 60 + p.minute) * 60 + p.second) * 1000 + (((ts % 1000) + 1000) % 1000);
  return ts - sinceMidnightMs;
}

/** Epoch ms for `minutes` after local midnight on the day containing `ts`. */
export function atMinute(ts, minutes, tz) {
  return startOfDay(ts, tz) + minutes * 60_000;
}

/** 435 -> "7:15 AM" */
export function formatMinutes(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const min = String(m % 60).padStart(2, '0');
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${min} ${suffix}`;
}

/** Epoch ms -> "7:15 AM" in the household zone. */
export function formatClock(ts, tz) {
  return formatMinutes(minutesOfDay(ts, tz));
}

/** 95 -> "1 h 35 min", 40 -> "40 min" */
export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}
