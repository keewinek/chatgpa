export type ChatRole = "system" | "user" | "assistant";

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  attachments?: ChatAttachment[];
}
