/** Returns the URL of a course's field image, given its stored file name. */
export function fieldImageUrl(courseId: number, fileName: string): string {
  return new URL(
    `../api/courses/${courseId}/images/${encodeURIComponent(fileName)}`,
    document.baseURI,
  ).href;
}
