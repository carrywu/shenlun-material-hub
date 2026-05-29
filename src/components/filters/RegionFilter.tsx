"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const regions = [
  { value: "all", label: "全部地区" },
  { value: "全国通用", label: "全国通用" },
  { value: "广东省考", label: "广东省考" },
  { value: "湖南省考", label: "湖南省考" },
] as const;

interface RegionFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function RegionFilter({ value, onChange }: RegionFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">地区:</span>
      <Select value={value} onValueChange={(v) => onChange(v ?? "all")}>
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {regions.map((region) => (
            <SelectItem key={region.value} value={region.value}>
              {region.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
