import { redirect } from "next/navigation";

export default function SyncRecordsRedirectPage() {
  redirect("/admin/sync-records");
}
