import type { ChatAttachment } from "@chatgpa/core";
import Icon from "./Icon.tsx";

interface MessageAttachmentsProps {
  attachments: ChatAttachment[];
}

function fileUrl(id: string): string {
  return `/api/files/${id}`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export default function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  if (attachments.length === 0) return null;

  return (
    <div class="bubble-attachments">
      {attachments.map((att) => (
        <div key={att.id} class="attachment-card">
          {isImage(att.mimeType)
            ? (
              <a
                class="attachment-image-link"
                href={fileUrl(att.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  class="attachment-image"
                  src={fileUrl(att.id)}
                  alt={att.name}
                  loading="lazy"
                />
              </a>
            )
            : (
              <a
                class="attachment-file"
                href={fileUrl(att.id)}
                target="_blank"
                rel="noopener noreferrer"
                download={att.name}
              >
                <span class="attachment-file-icon">
                  <Icon name="file" />
                </span>
                <span class="attachment-file-name">{att.name}</span>
                {att.size !== undefined && (
                  <span class="attachment-file-size">{formatSize(att.size)}</span>
                )}
              </a>
            )}
        </div>
      ))}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
