// Tests of the receipt photo rules (UC-02 step 3): format by magic bytes, storage key and storage settings.
import { readStorageSettings } from './receipt-image-store.js';
import {
  buildImageKey,
  contentTypeOf,
  detectImageFormat,
} from './receipt-image-rules.js';

const JPEG_START = [0xff, 0xd8, 0xff, 0xe0];
const PNG_START = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF_START = [0x25, 0x50, 0x44, 0x46];

describe('detectImageFormat', () => {
  it('recognises a JPEG by its first bytes', () => {
    const bytes = Buffer.from(JPEG_START);

    const format = detectImageFormat(bytes);

    expect(format).toBe('jpeg');
  });

  it('recognises a PNG by its first bytes', () => {
    const bytes = Buffer.from(PNG_START);

    const format = detectImageFormat(bytes);

    expect(format).toBe('png');
  });

  it('rejects a PDF even if the client called it an image', () => {
    const bytes = Buffer.from(PDF_START);

    const format = detectImageFormat(bytes);

    expect(format).toBeNull();
  });

  it('rejects an empty file', () => {
    const format = detectImageFormat(Buffer.alloc(0));

    expect(format).toBeNull();
  });
});

describe('buildImageKey', () => {
  it('puts the photo in the folder of its expense report with the format extension', () => {
    const key = buildImageKey(7, 'png');

    expect(key).toMatch(/^receipts\/7\/[0-9a-f-]{36}\.png$/);
  });

  it('never repeats a key', () => {
    const first = buildImageKey(7, 'jpeg');
    const second = buildImageKey(7, 'jpeg');

    expect(first).not.toBe(second);
  });
});

describe('contentTypeOf', () => {
  it('gives the media type stored with the photo', () => {
    expect(contentTypeOf('jpeg')).toBe('image/jpeg');
  });
});

describe('readStorageSettings', () => {
  const COMPLETE_ENVIRONMENT = {
    S3_ACCESS_KEY: 'amr-dev',
    S3_SECRET_KEY: 'clave-sintetica',
    S3_BUCKET: 'comprobantes',
  };

  it('defaults the endpoint to the local SeaweedFS port', () => {
    const settings = readStorageSettings(COMPLETE_ENVIRONMENT);

    expect(settings.endpoint).toBe('http://localhost:8333');
  });

  it('names the missing variable', () => {
    const { S3_BUCKET: _omitted, ...withoutBucket } = COMPLETE_ENVIRONMENT;

    expect(() => readStorageSettings(withoutBucket)).toThrow(/S3_BUCKET/);
  });
});
