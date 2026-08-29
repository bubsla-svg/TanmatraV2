/**
 * Turning a placement code into something you can actually put on a wall.
 *
 * The pure half lives here — the URL that gets encoded, and the physical
 * sizing — because both are silently breakable and neither needs a database.
 *
 * THE URL IS UPPERCASE AND THAT IS LOAD-BEARING, not a style choice. QR has an
 * alphanumeric mode whose charset is digits, uppercase A–Z and a few symbols;
 * lowercase forces byte mode, which packs fewer characters per module.
 * Measured on this exact URL shape with qrcode@1.5.4:
 *
 *     HTTPS://TANMATRA.FOOD/Q/BOX  → version 2, 25×25, Alphanumeric
 *     https://tanmatra.food/q/box  → version 3, 29×29, Byte
 *
 * 16% fewer modules per side means each module is 16% larger at the same
 * printed size, and scan range is a function of module size. That is the
 * difference between a poster that reads across a gym and one you walk up to.
 * `qrPrint.test.ts` asserts the mode, so a well-meant tidy-up to lowercase
 * fails the build instead of quietly shrinking every future print run's range.
 */

/** Where scans land. Uppercased at the point of encoding, not here, so the
 *  value stays readable in config and in error messages. */
export const SCAN_ORIGIN = "https://tanmatra.food";

/**
 * The exact string to encode. Uppercased whole — scheme, host and path — since
 * a single lowercase character anywhere in it drops the entire payload into
 * byte mode. Hosts are case-insensitive per RFC 3986 §3.2.2 and the `/q/` route
 * folds the path case itself, so nothing is lost by shouting.
 */
export function printedScanUrl(code: string, origin: string = SCAN_ORIGIN): string {
  return `${origin.replace(/\/+$/, "")}/q/${code}`.toUpperCase();
}

/** The human-readable line printed as TEXT under every code — a trust cue, and
 *  the fallback when a scan fails. Lowercase: this one is read, not scanned. */
export function printedFallbackText(origin: string = SCAN_ORIGIN): string {
  return origin.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/**
 * How wide to print a symbol that must scan from `metres` away.
 *
 * The working rule in the field is a 10:1 distance-to-width ratio — a 4 m read
 * needs roughly a 40 cm symbol. It is approximate by nature (it depends on the
 * scanner's camera and the light), so this rounds UP to the nearest centimetre:
 * a code printed slightly too large still scans, one printed slightly too small
 * does not, and the failure is invisible until the posters are already up.
 */
export function printWidthCm(metres: number): number {
  return Math.ceil(metres * 100 / 10);
}

/** The inverse, for a size that has already been decided by a layout. */
export function scanDistanceM(widthCm: number): number {
  return Math.round((widthCm * 10) / 100 * 10) / 10;
}
