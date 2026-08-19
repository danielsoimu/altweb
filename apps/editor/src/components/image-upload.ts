/**
 * Local image upload: files are embedded as data URIs, nothing ever leaves
 * the page. Size is capped so the capsule stays within the core validator's
 * per-image limit (200k characters of data URI).
 */

import { createImageUpload } from 'novel';

// ~145 KB binary becomes ~193k base64 characters — under the core cap.
const MAX_IMAGE_BYTES = 145 * 1024;

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the image file'));
    reader.readAsDataURL(file);
  });
}

export const uploadFn = createImageUpload({
  onUpload: (file) => readAsDataUri(file),
  validateFn: (file) => {
    if (!file.type.startsWith('image/')) {
      window.alert('Only image files can be embedded.');
      return false;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert('Image is too large. Keep embedded images under 145 KB so the capsule stays portable.');
      return false;
    }
    return true;
  },
});
