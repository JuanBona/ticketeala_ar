// Rules for the receipt photo the employee uploads (UC-02 step 3): accepted formats, size limit and storage key.
import { randomUUID } from 'node:crypto';

/** Largest photo accepted: a phone camera photo of a receipt fits well under this. */
export const MAXIMUM_IMAGE_BYTES = 10 * 1024 * 1024;

export type ImageFormat = 'jpeg' | 'png';

interface ImageFormatSpec {
  contentType: string;
  extension: string;
  /** First bytes of every file of this format ("magic number"). */
  signature: number[];
}

const IMAGE_FORMATS: Record<ImageFormat, ImageFormatSpec> = {
  jpeg: {
    contentType: 'image/jpeg',
    extension: 'jpg',
    signature: [0xff, 0xd8, 0xff],
  },
  png: {
    contentType: 'image/png',
    extension: 'png',
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
};

/**
 * Reads the format from the file's own first bytes, never from the name or content type the
 * client declares (the client can claim anything). Null when it is not a JPEG or PNG.
 */
export function detectImageFormat(bytes: Buffer): ImageFormat | null {
  for (const [format, spec] of Object.entries(IMAGE_FORMATS)) {
    const matches = spec.signature.every(
      (byte, index) => bytes[index] === byte,
    );
    if (matches) {
      return format as ImageFormat;
    }
  }
  return null;
}

export function contentTypeOf(format: ImageFormat): string {
  return IMAGE_FORMATS[format].contentType;
}

/** D17: unique key of the photo inside the private bucket; one folder per expense report. */
export function buildImageKey(
  expenseReportId: number,
  format: ImageFormat,
): string {
  return `receipts/${expenseReportId}/${randomUUID()}.${IMAGE_FORMATS[format].extension}`;
}
