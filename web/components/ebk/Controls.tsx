"use client";

// Small controls shared by the public pages, drawn with the component library so they behave the same everywhere
// (keyboard, focus ring, sliding selection).
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { SPORT } from "@/lib/ebk";

/** One sport or all of them. `value` null = all. */
export function SportPicker({ sports, value, onChange, all = true, label = "Sport" }: {
  sports: string[]; value: string | null; onChange: (s: string | null) => void; all?: boolean; label?: string;
}) {
  if (sports.length < 2 && all) return null;
  return (
    <SegmentedControl label={label} size="sm" value={value ?? "all"} onChange={(v) => onChange(v === "all" ? null : v)}>
      {all && <SegmentedControlItem value="all" label="All" />}
      {sports.map((s) => <SegmentedControlItem key={s} value={s} label={SPORT[s] ?? s} />)}
    </SegmentedControl>
  );
}

export function Picker<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <SegmentedControl label={label} size="sm" value={value} onChange={(v) => onChange(v as T)}>
      {options.map((o) => <SegmentedControlItem key={o.value} value={o.value} label={o.label} />)}
    </SegmentedControl>
  );
}
