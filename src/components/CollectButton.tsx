"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { CollectDialog } from "@/components/CollectDialog";

interface CollectButtonProps {
  onComplete?: () => void;
}

export function CollectButton({ onComplete }: CollectButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Play className="mr-1.5 h-4 w-4" />
        开始采集
      </Button>
      <CollectDialog
        open={open}
        onOpenChange={setOpen}
        onComplete={onComplete}
      />
    </>
  );
}
