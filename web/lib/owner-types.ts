export const SECTIONS = ['research', 'models', 'ledger', 'strategies', 'analysis'] as const;
export type Section = typeof SECTIONS[number];
export type OwnerRecord = { id: string; kind: string; title: string; sport: string; source: string; date: string; data: Record<string, unknown> };
export type OwnerManifest = { version: 1; generation: string; updated: string; sections: Record<Section, { count: number; parts: string[]; sources: Record<string, number>; sports: Record<string, number> }> };
export type OwnerPage = { records: OwnerRecord[]; total: number; page: number; pages: number; updated: string };
