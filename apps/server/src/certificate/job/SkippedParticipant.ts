import type { MissingGlyphs } from '../../template/glyph/TemplateGlyphChecker';
import type { ParticipantId } from '../../participant/Participant';

/** A participant whose certificate wasn't rendered, because the template's fonts can't draw some of their characters, or required fields have no value. */
export type SkippedParticipant = {
  readonly participantId: ParticipantId;
  readonly name: string;
  readonly missing: readonly MissingGlyphs[];
  /** Labels of the required fields without a value. */
  readonly missingFields?: readonly string[];
};
