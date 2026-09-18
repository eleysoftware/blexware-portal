/** Client-safe rules shared by the Resources UI and its server functions. */

export const MAX_RESOURCE_TITLE = 120;
export const MAX_RESOURCE_DESCRIPTION = 250;
export const MAX_RESOURCE_BYTES = 50 * 1024 * 1024;

/** Allowed attachment types: documents, spreadsheets, slides, images, A/V. */
export const ALLOWED_RESOURCE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "application/zip",
  "text/plain",
  "text/csv",
  "text/markdown",
] as const;

const ALLOWED_PREFIXES = ["image/", "video/", "audio/"];

export function isAllowedResourceType(mime: string, name = ""): boolean {
  if (ALLOWED_RESOURCE_TYPES.includes(mime as (typeof ALLOWED_RESOURCE_TYPES)[number])) return true;
  if (ALLOWED_PREFIXES.some((prefix) => mime.startsWith(prefix))) return true;
  // Some browsers send an empty type — fall back to the extension.
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return [
    "pdf","doc","docx","xls","xlsx","ppt","pptx","csv","txt","md","rtf","zip",
    "png","jpg","jpeg","gif","webp","heic","svg","mp4","mov","webm","mp3","wav","m4a",
  ].includes(ext);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns a friendly problem message, or null when the file is acceptable. */
export function validateResourceFile(file: { name: string; size: number; type: string }): string | null {
  if (file.size === 0) return `${file.name} appears to be empty.`;
  if (file.size > MAX_RESOURCE_BYTES)
    return `${file.name} is ${formatBytes(file.size)} — the limit is 50 MB per file.`;
  if (!isAllowedResourceType(file.type, file.name))
    return `${file.name} isn't a file type we accept here. Try a document, spreadsheet, image, or video.`;
  return null;
}

/** Returns a friendly problem message, or null when the details are acceptable. */
export function validateResourceDetails(input: { title: string; description?: string }): string | null {
  const title = input.title?.trim() ?? "";
  if (!title) return "Give this resource a title.";
  if (title.length > MAX_RESOURCE_TITLE) return `Keep the title under ${MAX_RESOURCE_TITLE} characters.`;
  const description = input.description?.trim() ?? "";
  if (description.length > MAX_RESOURCE_DESCRIPTION)
    return `Keep the description under ${MAX_RESOURCE_DESCRIPTION} characters.`;
  return null;
}

export type ResourceRecord = {
  id: string;
  quote_id: string;
  title: string;
  description: string | null;
  storage_path: string | null;
  original_name: string | null;
  mime_type: string | null;
  byte_size: number | null;
  author_id: string | null;
  author_label: string | null;
  author_role: string;
  archived_at: string | null;
  created_at: string;
};

/** Can this viewer edit or delete the resource? */
export function canEditResource(
  resource: Pick<ResourceRecord, "author_id">,
  viewer: { userId: string | null; isAdmin: boolean },
): boolean {
  if (viewer.isAdmin) return true;
  return Boolean(viewer.userId) && resource.author_id === viewer.userId;
}
