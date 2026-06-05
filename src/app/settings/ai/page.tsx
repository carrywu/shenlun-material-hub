import { redirect } from "next/navigation";

export default function AiSettingsRedirectPage() {
  redirect("/admin/settings/ai");
}
