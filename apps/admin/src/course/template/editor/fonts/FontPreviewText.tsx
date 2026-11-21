import type { FontPreview } from '@cert-it/shared';
import { Text } from '@mantine/core';

type FontPreviewTextProps = {
  /** The drawn text, or null while it loads or if it can't be drawn. */
  preview: FontPreview | null | undefined;
  /** The same text, read by screen readers and shown until the drawing arrives. */
  label: string;
  /** Height of the line, in pixels. */
  height: number;
};

/** A line of text in a font, drawn from its outlines, so the font itself never loads. Follows the text color, light or dark. */
export function FontPreviewText({
  preview,
  label,
  height,
}: FontPreviewTextProps) {
  if (!preview) {
    return (
      <Text size="sm" lh={`${height}px`} truncate>
        {label}
      </Text>
    );
  }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={preview.viewBox}
      height={height}
      fill="currentColor"
      style={{ display: 'block', maxWidth: '100%' }}
      preserveAspectRatio="xMinYMid meet"
    >
      <path d={preview.path} />
    </svg>
  );
}
