import { MonitorNotification } from "../types/monitor";

export async function fetchQueueNotifications(): Promise<MonitorNotification[]> {
  const res = await fetch("/api/notifications");
  if (!res.ok) throw new Error("Failed to fetch notifications from core server");
  return res.json();
}

export async function updateNotificationStatus(id: string, status: "Pending" | "Seen" | "Handled"): Promise<any> {
  const res = await fetch("/api/notifications/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status })
  });
  if (!res.ok) throw new Error("Failed to update ticket status on server");
  return res.json();
}

export async function deleteNotificationById(id: string): Promise<any> {
  const res = await fetch("/api/notifications/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error("Failed to delete notification logs");
  return res.json();
}

export async function fetchCredentials(): Promise<any> {
  const res = await fetch("/api/credentials");
  if (!res.ok) throw new Error("Failed to fetch active server credentials");
  return res.json();
}

export async function saveCredentials(creds: {
  instagram_token?: string;
  instagram_id?: string;
  whatsapp_token?: string;
  whatsapp_id?: string;
}): Promise<any> {
  const res = await fetch("/api/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds)
  });
  if (!res.ok) throw new Error("Failed to register configuration keys");
  return res.json();
}
