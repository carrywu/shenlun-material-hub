"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type ConfigType = "ai" | "weweRss" | "role";

interface MissingConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configType: ConfigType;
}

const CONFIG_MESSAGES: Record<ConfigType, {
  title: string;
  description: string;
  action: string;
  actionPath: string;
}> = {
  ai: {
    title: "AI 服务未配置",
    description:
      "当前功能需要先配置 AI 服务。\n\n你尚未配置 AI Key 或模型参数，暂时无法使用该功能。\n是否前往配置页面完成设置？",
    action: "前往配置",
    actionPath: "/settings/ai",
  },
  weweRss: {
    title: "WeWeRSS 服务未配置",
    description:
      "当前功能需要先配置 WeWeRSS 服务。\n\n系统未检测到可用的 WeWeRSS 地址，无法同步公众号数据。\n是否前往配置页面？",
    action: "前往配置",
    actionPath: "/settings/integrations",
  },
  role: {
    title: "权限不足",
    description:
      "当前功能仅认证用户可用。\n\n你可以在设置页面输入邀请码升级为认证用户。",
    action: "去设置",
    actionPath: "/settings/account",
  },
};

export function MissingConfigDialog({
  open,
  onOpenChange,
  configType,
}: MissingConfigDialogProps) {
  const router = useRouter();
  const { title, description, action, actionPath } = CONFIG_MESSAGES[configType];

  function handleAction() {
    onOpenChange(false);
    router.push(actionPath);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleAction}>{action}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
