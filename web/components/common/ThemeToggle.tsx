"use client";

// One button that cycles System → Light → Dark. The default is System, so a first visit matches the device. (icon shows the current choice; the label says what's next).
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme";

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const NAME: Record<ThemeChoice, string> = { system: "System", light: "Light", dark: "Dark" };
const ICON = { system: Monitor, light: Sun, dark: Moon };

export function ThemeToggle() {
  const [choice, setChoice] = useTheme();
  const Icon = ICON[choice];
  const label = `Theme: ${NAME[choice]} (switch to ${NAME[NEXT[choice]]})`;
  return (
    <button type="button" onClick={() => setChoice(NEXT[choice])} title={label} aria-label={label} data-theme-choice={choice}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
      <Icon className="size-4" />
    </button>
  );
}
