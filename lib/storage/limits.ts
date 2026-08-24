/**
 * Upload limits shared by the browser and the upload route.
 *
 * Deliberately dependency-free: the API route and client components both
 * import this, so it must not drag the Supabase client into the browser
 * bundle. Keep it that way.
 *
 * The ceiling is enforced in two places on purpose. The browser check gives
 * an instant, specific message instead of a slow round trip, and the server
 * check is the one that actually protects the route — a request can always
 * arrive without going through our form.
 */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Human-facing size cap, e.g. for helper text and error messages. */
export const MAX_UPLOAD_LABEL = "4 MB";

export const ALLOWED_UPLOAD_EXTENSIONS = [".png", ".jpeg", ".jpg", ".pdf", ".xlsx"];

/** Extensions an <input type="file"> should offer for a profile picture. */
export const IMAGE_ACCEPT = ".png,.jpg,.jpeg";

/** 1536 -> "1.5 MB". Used to tell the user how far over they actually are. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns a user-facing reason the file can't be uploaded, or null if it's
 * fine. Shared so the browser and the route reject on identical grounds.
 */
export function describeUploadProblem(file: {
  name: string;
  size: number;
}): string | null {
  const dot = file.name.lastIndexOf(".");
  const ext = dot === -1 ? "" : file.name.slice(dot).toLowerCase();

  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return `"${file.name}" is a ${ext || "unknown"} file. Allowed types: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)}. The limit is ${MAX_UPLOAD_LABEL} — please resize or compress it and try again.`;
  }
  return null;
}
