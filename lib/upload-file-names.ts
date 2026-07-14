import { HttpError } from "@/lib/auth";

const uploadFileNamePattern = /^[^\u0000-\u001F\u007F\\/]{1,255}$/;

export function parseUploadFileName(
  value: string,
  options: { allowedExtensions: string[]; label: string; extensionError: string }
) {
  const fileName = value.trim();
  if (!uploadFileNamePattern.test(fileName)) {
    throw new HttpError(
      400,
      `${options.label} file name must be 255 characters or fewer and cannot contain path separators or control characters.`
    );
  }
  if (!options.allowedExtensions.some((extension) => fileName.toLowerCase().endsWith(extension.toLowerCase()))) {
    throw new HttpError(400, options.extensionError);
  }
  return fileName;
}
