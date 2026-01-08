const BASE_URL = "https://www.studygkhub.com";

export function resolveImageUrl(image) {
  if (!image) return "";

  // already full URL
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  // ensure leading slash
  if (!image.startsWith("/")) {
    image = "/" + image;
  }

  return BASE_URL + image;
}
