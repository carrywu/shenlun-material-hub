"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const sources = [
  { value: "all", label: "全部来源" },
  { value: "人民日报", label: "人民日报" },
  { value: "人民网观点", label: "人民网观点" },
  { value: "半月谈", label: "半月谈" },
  { value: "中国政府网", label: "中国政府网" },
  { value: "新华社", label: "新华社" },
  { value: "光明日报", label: "光明日报" },
  { value: "经济日报", label: "经济日报" },
] as const;

interface SourceFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function SourceFilter({ value, onChange }: SourceFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">来源:</span>
      <Select value={value} onValueChange={(v) => onChange(v ?? "all")}>
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue>
            {sources.find(s => s.value === value)?.label ?? value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {sources.map((source) => (
            <SelectItem key={source.value} value={source.value}>
              {source.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
