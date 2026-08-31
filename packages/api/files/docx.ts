/** Extract plain text from a .docx (ZIP + word/document.xml) without extra deps. */
export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const xmlBytes = await findZipEntry(bytes, "word/document.xml");
  if (!xmlBytes) return "";

  const xml = new TextDecoder("utf-8", { fatal: false }).decode(xmlBytes);
  const parts: string[] = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const chunk = match[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    if (chunk) parts.push(chunk);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function findZipEntry(data: Uint8Array, entryName: string): Promise<Uint8Array | null> {
  let i = 0;
  while (i < data.length - 30) {
    if (
      data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x03 && data[i + 3] === 0x04
    ) {
      const method = data[i + 8] | (data[i + 9] << 8);
      const compSize = data[i + 18] | (data[i + 19] << 8) | (data[i + 20] << 16) |
        (data[i + 21] << 24);
      const nameLen = data[i + 26] | (data[i + 27] << 8);
      const extraLen = data[i + 28] | (data[i + 29] << 8);
      const nameStart = i + 30;
      const name = new TextDecoder().decode(data.slice(nameStart, nameStart + nameLen));
      const offset = nameStart + nameLen + extraLen;
      if (name === entryName || name.endsWith(`/${entryName}`)) {
        const compressed = data.slice(offset, offset + compSize);
        if (method === 0) return Promise.resolve(compressed);
        if (method === 8) return inflateRaw(compressed);
      }
      i = offset + compSize;
    } else {
      i++;
    }
  }
  return Promise.resolve(null);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}
