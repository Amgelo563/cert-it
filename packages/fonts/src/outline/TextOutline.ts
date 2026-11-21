/** A line of text drawn as vector outlines, ready for an SVG `path`. */
export type TextOutline = {
  /** SVG `viewBox` the path fits in, in font units: from the left edge and the ascent, to the advance and the descent. */
  viewBox: string;
  /** SVG path data of every glyph, with y pointing down. */
  path: string;
};
