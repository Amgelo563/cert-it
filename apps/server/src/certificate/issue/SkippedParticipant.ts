import type { MissingGlyphs } from '../../template/glyph/TemplateGlyphChecker';
import type { ParticipantId } from '../../participant/Participant';

/** A participant whose certificate wasn't rendered, because the template's fonts can't draw some of their characters. */
export type SkippedParticipant = {
  readonly participantId: ParticipantId;
  readonly name: string;
  readonly missing: readonly MissingGlyphs[];
};
