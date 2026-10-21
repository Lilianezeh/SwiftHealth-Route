/** The direct photo upload from the browser to Cloudinary. Requirements: FR-32, US-10, NFR-06. Decision C8 in
 * specs/2026-10-20-staff-screens/requirements.md. The API signs the upload (`POST /uploads/sign`); the photo itself never passes
 * through our server. It is one POST of a multipart form to `https://api.cloudinary.com/v1_1/<cloud>/image/upload` with the file and
 * the signed fields. Only an `https://res.cloudinary.com/` address in the answer is accepted as the photo's address. Not tested
 * against a real account (the tests use a fake).
 */
import type { UploadSignature } from "@/types/staff";

export class PhotoUploadError extends Error {
  constructor() {
    super("The photo could not be uploaded.");
    this.name = "PhotoUploadError";
  }
}

const UPLOAD_TIMEOUT_MS = 60_000;

function isCloudinaryAddress(address: unknown): address is string {
  if (typeof address !== "string") return false;
  try {
    const url = new URL(address);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}

/** Uploads the file and returns its `https://res.cloudinary.com/...` address. Throws PhotoUploadError for any failure. */
export async function uploadPhoto(file: File, signature: UploadSignature): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  form.set("api_key", signature.api_key);
  form.set("timestamp", String(signature.timestamp));
  form.set("signature", signature.signature);
  form.set("folder", signature.folder);
  if (signature.upload_preset) form.set("upload_preset", signature.upload_preset);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloud_name)}/image/upload`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) throw new PhotoUploadError();
    const body = (await response.json()) as { secure_url?: unknown };
    if (!isCloudinaryAddress(body.secure_url)) throw new PhotoUploadError();
    return body.secure_url;
  } catch {
    throw new PhotoUploadError(); // no address, key or file name in the message
  } finally {
    clearTimeout(timer);
  }
}
