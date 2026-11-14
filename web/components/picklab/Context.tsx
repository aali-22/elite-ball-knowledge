"use client";

// What every PickLab page shares: who is looking (set once by the section's layout, on the server), the games they
// follow, and each analyst's record this season by sport. One provider per page, so a card never asks twice.
import { createContext, useContext, useMemo } from "react";
import { useFollowing } from "@/lib/following";
import { useSeasonRecords, type SeasonRecords } from "@/lib/public";

export type Viewer = { invited: boolean; owner: boolean };
const ViewerContext = createContext<Viewer>({ invited: false, owner: false });
export const ViewerProvider = ViewerContext.Provider;
export const useViewer = () => useContext(ViewerContext);

type Following = ReturnType<typeof useFollowing>;
type Lab = { following: Following; records: SeasonRecords };
const NONE: Lab = { following: { ids: new Set(), has: () => false, toggle: () => {}, ready: false }, records: new Map() };
const LabContext = createContext<Lab>(NONE);
export const useLab = () => useContext(LabContext);

/** `sports`: the leagues on the page, so only their records are asked for. */
export function LabProvider({ sports, children }: { sports: string[]; children: React.ReactNode }) {
  const following = useFollowing();
  const records = useSeasonRecords(sports);
  const value = useMemo(() => ({ following, records }), [following, records]);
  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}
