export interface MonitorNotification {
  id: string;
  platform: "Instagram" | "WhatsApp";
  type: "DM" | "Message Request" | "Message";
  sender: string;
  message: string;
  time: string; // Formatted local time e.g., "16 Jun 2026 14:35:22"
  status: "Pending" | "Seen" | "Handled";
  timestamp: number;
}

export interface ConversationMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isIncoming: boolean;
}

export interface SenderConversation {
  senderName: string;
  platform: "Instagram" | "WhatsApp";
  messages: ConversationMessage[];
}
