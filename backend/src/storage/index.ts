import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";
import { b2Configured, env } from "../env";

export interface ObjectStorage {
  readonly kind: "b2" | "local";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const name = (e as { name?: string }).name ?? "";
      // Do not retry client-side errors such as AccessDenied / NoSuchBucket.
      if (/AccessDenied|NoSuchBucket|InvalidAccessKeyId|SignatureDoesNotMatch/.test(name)) break;
      await sleep(200 * 2 ** i);
    }
  }
  throw last;
}

/** Backblaze B2 via its S3-compatible API. The bucket should be PRIVATE; reads go through /api/media. */
export class B2Storage implements ObjectStorage {
  readonly kind = "b2" as const;
  private client: S3Client;
  constructor(private bucket: string, endpoint: string, region: string, keyId: string, appKey: string) {
    this.client = new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId: keyId, secretAccessKey: appKey } });
  }
  async put(key: string, body: Buffer, contentType: string) {
    await retry(() => this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "private, max-age=0" })));
  }
  async get(key: string) {
    try {
      const res = await retry(() => this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key })));
      const bytes = await res.Body!.transformToByteArray();
      return { body: Buffer.from(bytes), contentType: res.ContentType ?? "application/octet-stream" };
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }
  async delete(key: string) {
    await retry(() => this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })));
  }
}

/** Development fallback used only when B2 credentials are absent. Never use in production. */
export class LocalStorage implements ObjectStorage {
  readonly kind = "local" as const;
  constructor(private root: string) {}
  private resolve(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return p;
  }
  async put(key: string, body: Buffer) {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
  }
  async get(key: string) {
    try {
      return { body: await fs.readFile(this.resolve(key)), contentType: "image/webp" };
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

let override: ObjectStorage | null = null;
let cached: ObjectStorage | null = null;

export function setStorageForTests(s: ObjectStorage | null) {
  override = s;
}

export function getStorage(): ObjectStorage {
  if (override) return override;
  if (cached) return cached;
  const e = env();
  if (b2Configured(e)) {
    const region = e.B2_REGION ?? /s3\.([^.]+)\.backblazeb2/.exec(e.B2_ENDPOINT!)?.[1] ?? "us-west-004";
    cached = new B2Storage(e.B2_BUCKET!, e.B2_ENDPOINT!, region, e.B2_KEY_ID!, e.B2_APPLICATION_KEY!);
  } else {
    cached = new LocalStorage(path.resolve(process.cwd(), e.LOCAL_UPLOAD_DIR));
  }
  return cached;
}
