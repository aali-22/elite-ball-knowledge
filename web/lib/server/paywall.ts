// Whether plans matter at all. PAYWALL=off (the default) is the beta: every feature is open to everyone. Read when
// a request arrives, not at build time, so turning it on needs a restart and no rebuild. No import here on purpose:
// the pricing page reads this and must not pull in the accounts code.
export const paywallOn = () => ["on", "1", "true"].includes((process.env.PAYWALL ?? "off").trim().toLowerCase());
