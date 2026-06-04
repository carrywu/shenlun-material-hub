"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const topics = [
  { value: "all", label: "全部主题" },
  { value: "基层治理", label: "基层治理" },
  { value: "乡村振兴", label: "乡村振兴" },
  { value: "科技创新", label: "科技创新" },
  { value: "经济发展", label: "经济发展" },
  { value: "民生保障", label: "民生保障" },
  { value: "生态文明", label: "生态文明" },
  { value: "文化建设", label: "文化建设" },
  { value: "法治建设", label: "法治建设" },
] as const;

interface TopicFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function TopicFilter({ value, onChange }: TopicFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">主题:</span>
      <Select value={value} onValueChange={(v) => onChange(v ?? "all")}>
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue>
            {topics.find(t => t.value === value)?.label ?? value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {topics.map((topic) => (
            <SelectItem key={topic.value} value={topic.value}>
              {topic.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
