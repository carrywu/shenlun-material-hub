"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { CollectDialog } from "@/components/CollectDialog";
import { useAuth } from "@/lib/auth-context";
import { useMissingConfigDialog } from "@/hooks/use-missing-config-dialog";

interface CollectButtonProps {
  onComplete?: () => void;
}

export function CollectButton({ onComplete }: CollectButtonProps) {
  const [open, setOpen] = useState(false);
  const { isAdmin, user } = useAuth();
  const isVerifiedUser = isAdmin || user?.role === "VERIFIED_USER";
  const { dialogElement, showRoleDialog } = useMissingConfigDialog();

  if (!isVerifiedUser) {
    return (
      <>
        {dialogElement}
        <Button size="sm" variant="outline" onClick={showRoleDialog}>
          <Play className="mr-1.5 h-4 w-4" />
          开始采集
        </Button>
      </>
    );
  }

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
