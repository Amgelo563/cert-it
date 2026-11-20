/** Basic facts about a font file. */
export type FontInfo = {
  family: string;
  /** Style name, such as `Regular` or `Bold Italic`. */
  style: string;
  /** File extension matching the file's contents. */
  extension: 'ttf' | 'otf';
  /** Whether it has variation axes. A PDF library usually draws only its default instance. */
  variable: boolean;
};
