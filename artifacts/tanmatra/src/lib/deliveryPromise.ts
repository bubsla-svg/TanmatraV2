/**
 * THE single marketing delivery ETA for à-la-carte orders. Every surface
 * that promises a door-to-door time must render this constant — hardcoded
 * copies are how the storefront ended up advertising "25–40 minutes" on
 * some screens and "40–45" on others for the same kitchen.
 *
 * Subscriptions never promise an ETA at all: they deliver into the
 * customer's chosen delivery window, so subscription surfaces should talk
 * about windows, not minutes.
 */
export const DELIVERY_ETA_TEXT = "40–45 min";
