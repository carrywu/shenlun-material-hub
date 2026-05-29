"use client";

import { Button } from "@/components/ui/button";

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const presets = [
  { label: "今天", days: 0 },
  { label: "最近7天", days: 7 },
  { label: "最近30天", days: 30 },
  { label: "最近90天", days: 90 },
] as const;

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  function handlePreset(days: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onChange({ from: formatDate(from), to: formatDate(to) });
  }

  function handleClear() {
    onChange({ from: "", to: "" });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">日期:</span>
      {presets.map((preset) => (
        <Button
          key={preset.days}
          variant="outline"
          size="xs"
          onClick={() => handlePreset(preset.days)}
        >
          {preset.label}
        </Button>
      ))}
      <input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="h-7 rounded-md border border-input bg-background px-2 text-sm"
      />
      <span className="text-sm text-muted-foreground">至</span>
      <input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="h-7 rounded-md border border-input bg-background px-2 text-sm"
      />
      {(value.from || value.to) && (
        <Button variant="ghost" size="xs" onClick={handleClear}>
          清除
        </Button>
      )}
    </div>
  );
}
