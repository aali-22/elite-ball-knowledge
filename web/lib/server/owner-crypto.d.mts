export type Sealed = { iv: string; tag: string; data: string };
export function signature(body: string, timestamp: string, secret: string): string;
export function authentic(body: string, timestamp: string | null, supplied: string | null, secret: string, now?: number): boolean;
export function seal(value: unknown, context: string, secret: string): Sealed;
export function unseal(value: Sealed, context: string, secret: string): unknown;
