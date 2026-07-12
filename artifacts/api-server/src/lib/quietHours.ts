import { logger } from "./logger";

/**
 * Checks if the current time in Indian Standard Time (IST, UTC+5:30) is between
 * 21:30 and 08:00. If so, returns the timestamp for 08:00 IST of the next morning
 * (converted back to UTC). Otherwise, returns null.
 */
export function shouldDeferMessage(now: Date): Date | null {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();

  const isQuietHours =
    hours > 21 ||
    (hours === 21 && minutes >= 30) ||
    hours < 8;

  if (!isQuietHours) {
    return null;
  }

  const targetIst = new Date(istTime);
  targetIst.setUTCHours(8, 0, 0, 0);

  // If it is late night (21:30 - 23:59), the next 08:00 IST is tomorrow.
  // If it is early morning (00:00 - 07:59), the next 08:00 IST is today.
  if (hours > 21 || (hours === 21 && minutes >= 30)) {
    targetIst.setUTCDate(targetIst.getUTCDate() + 1);
  }

  const deferTime = new Date(targetIst.getTime() - istOffsetMs);
  logger.info(
    {
      now: now.toISOString(),
      istHours: hours,
      istMinutes: minutes,
      deferUntil: deferTime.toISOString(),
    },
    "quietHours: message deferred"
  );
  return deferTime;
}
