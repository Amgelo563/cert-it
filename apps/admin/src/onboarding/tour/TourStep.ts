import type { PracticeEvent } from '../practice/PracticeEventEnum';

/** One step of a tour: what it points at, where it happens and what moves it on. */
export type TourStep = {
  /** Key of its title and text under the tour's messages. */
  key: string;
  /** Selectors of the element to point at, the first one found winning; empty for a popover in the middle. */
  targets: readonly string[];
  /** Page to open before the step, if it isn't open yet. */
  path?: string;
  /** What the user must do to move on; without it or `until`, a Next button does. */
  waitFor?: (event: PracticeEvent) => boolean;
  /** Moves on once the page shows this is done, such as a font being loaded. */
  until?: () => boolean;
  /** Lets the page behind be used, such as the Designer's canvas, keeping it lit and focused. */
  interactive?: boolean;
  /** Side of the target the card goes on, such as above the editor to keep it clear. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Leaves the step out when it returns true, checked as it comes up. */
  skip?: () => boolean;
  /** Runs as the step comes up, such as to open what it points at. */
  onEnter?: () => void;
};
