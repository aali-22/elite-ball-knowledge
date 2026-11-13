// "1st", "22nd", "113th". Its own plain module (no "use client") because both the browser's cards and the server's
// share image say ranks, and a function exported from a client module can't be called on the server.
export const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
