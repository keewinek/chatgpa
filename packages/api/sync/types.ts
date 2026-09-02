export type SyncEntity =
  | "profile"
  | "chat_threads"
  | "chat_messages"
  | "memory_entries"
  | "tasks"
  | "file_nodes";

export type SyncOperation = "upsert" | "delete";

export type SyncChange = {
  entity: SyncEntity;
  op: SyncOperation;
  data?: Record<string, unknown>;
  id?: string;
  updatedAt?: string;
};

export type SyncPullResponse = {
  cursor: string;
  changes: Record<SyncEntity, Record<string, unknown>[]>;
};

export type SyncPushBody = {
  changes: SyncChange[];
};

export type SyncPushResult = {
  applied: number;
  skipped: number;
  errors: { index: number; message: string }[];
};

export const SYNC_ENTITIES: SyncEntity[] = [
  "profile",
  "chat_threads",
  "chat_messages",
  "memory_entries",
  "tasks",
  "file_nodes",
];
