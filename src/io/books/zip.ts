export interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  data: () => Promise<Uint8Array>;
  text: () => Promise<string>;
}

/**
 * Robust, zero-dependency ZIP archive reader using Web standard APIs.
 * Supports standard stored (method 0) and deflated (method 8) entries.
 */
export async function readZip(buffer: ArrayBuffer | Uint8Array): Promise<ZipEntry[]> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Locate End of Central Directory (EOCD) from the end of the file.
  // EOCD signature is 0x06054b50, minimum 22 bytes.
  let eocdOffset = -1;
  const maxSearch = Math.min(bytes.length, 65536 + 22);
  for (let i = bytes.length - 22; i >= bytes.length - maxSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Invalid ZIP file: End of Central Directory not found");
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  const entries: ZipEntry[] = [];
  let cursor = cdOffset;
  const textDecoder = new TextDecoder("utf-8");

  for (let i = 0; i < totalEntries; i++) {
    if (cursor + 46 > bytes.length) break;
    const sig = view.getUint32(cursor, true);
    if (sig !== 0x02014b50) break; // Central Directory file header signature

    const compressionMethod = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);

    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLen);
    const name = textDecoder.decode(nameBytes);

    cursor += 46 + nameLen + extraLen + commentLen;

    // Local header parsing to get the exact data start
    const localSig = view.getUint32(localHeaderOffset, true);
    if (localSig !== 0x04034b50) {
      continue;
    }
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedData = bytes.subarray(dataStart, dataStart + compressedSize);

    const getData = async (): Promise<Uint8Array> => {
      if (compressionMethod === 0) {
        return compressedData;
      }
      if (compressionMethod === 8) {
        if (typeof DecompressionStream !== "undefined") {
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          // Write chunk and close stream
          const chunk = compressedData.slice();
          await writer.write(chunk);
          await writer.close();
          const decompressed = await new Response(ds.readable).arrayBuffer();
          return new Uint8Array(decompressed);
        }
        throw new Error("DecompressionStream is not supported in this environment");
      }
      throw new Error(`Unsupported compression method: ${compressionMethod}`);
    };

    const getText = async (): Promise<string> => {
      const data = await getData();
      return textDecoder.decode(data);
    };

    entries.push({
      name,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      data: getData,
      text: getText,
    });
  }

  return entries;
}
