import { type Driver, driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { PracticeEvent } from '../practice/PracticeEventEnum';
import classes from './Tour.module.css';
import type { TourStep } from './TourStep';

/** What the popover of the current step shows, for the panel to draw. */
export type TourView = {
  /** The element to draw the popover's content into. */
  container: HTMLElement;
  step: TourStep;
  /** Position among the steps shown, starting at 1. */
  current: number;
  total: number;
  canGoBack: boolean;
};

type TourRunnerOptions = {
  steps: readonly TourStep[];
  /** Opens a page of the panel. */
  navigate: (path: string) => void;
  /** Returns the path of the page open now. */
  currentPath: () => string;
  /** Adds a listener for what's done in practice, returning a function that removes it. */
  subscribe: (listener: (event: PracticeEvent) => void) => () => void;
  /** Called with each step to draw, or null while the popover is hidden. */
  onView: (view: TourView | null) => void;
  /** Called once the last step is passed. */
  onFinish: () => void;
};

/** Walks through a tour's steps with driver.js, waiting for pages, modals and what the user does. */
export class TourRunner {
  // how often the page is checked for the target and for open modals
  protected static readonly WatchMs = 250;

  // how long a step waits for its target before showing in the middle
  protected static readonly TargetWaitMs = 8000;

  protected static readonly ModalSelector = '.mantine-Modal-content';

  protected static readonly CardAttribute = 'data-tour-card';

  protected static readonly OverlayOpacity = 0.5;

  // light, so what's being worked on stays readable
  protected static readonly InteractiveOverlayOpacity = 0.3;

  // how long the card takes to glide to the next step
  protected static readonly MoveMs = 250;

  protected static readonly MoveEasing = 'cubic-bezier(0.2, 0, 0, 1)';

  protected static readonly ReducedMotionQuery =
    '(prefers-reduced-motion: reduce)';

  protected readonly steps: readonly TourStep[];

  protected readonly navigate: (path: string) => void;

  protected readonly currentPath: () => string;

  protected readonly subscribe: TourRunnerOptions['subscribe'];

  protected readonly onView: (view: TourView | null) => void;

  protected readonly onFinish: () => void;

  protected readonly driver: Driver;

  protected index = -1;

  /** Indexes of the steps shown, to go back past skipped ones. */
  protected readonly history: number[] = [];

  /** Index of the step on screen, or null while hidden. */
  protected shownIndex: number | null = null;

  /** Position in its step's targets of the element on screen, lower being preferred. */
  protected shownRank = 0;

  /** Where the card was before the step changed, to glide it from. */
  protected glideFrom: DOMRect | null = null;

  protected waitingSince = 0;

  protected timer: ReturnType<typeof setInterval> | null = null;

  protected unsubscribe: (() => void) | null = null;

  constructor(options: TourRunnerOptions) {
    this.steps = options.steps;
    this.navigate = options.navigate;
    this.currentPath = options.currentPath;
    this.subscribe = options.subscribe;
    this.onView = options.onView;
    this.onFinish = options.onFinish;
    this.driver = driver({
      // the spotlight jumps; only the card moves, which is easier to follow
      animate: false,
      allowClose: false,
      allowKeyboardControl: false,
      overlayColor: '#000',
      overlayOpacity: TourRunner.OverlayOpacity,
      stagePadding: 6,
      stageRadius: 12,
      popoverClass: classes.popover,
      showButtons: [],
    });
  }

  /** Shows the first step and starts following the page. */
  public start(): void {
    this.unsubscribe = this.subscribe((event) => this.handle(event));
    this.timer = setInterval(() => this.watch(), TourRunner.WatchMs);
    this.goTo(0);
  }

  /** Hides the tour and stops following the page. */
  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.hide();
  }

  /** Moves to the next step, or finishes after the last. */
  public next(): void {
    this.goTo(this.index + 1);
  }

  /** Moves back to the step shown before this one. */
  public back(): void {
    this.history.pop();
    const previous = this.history.pop();
    if (previous !== undefined) this.goTo(previous);
  }

  protected goTo(index: number): void {
    let next = index;
    while (this.steps[next]?.skip?.()) next++;
    const step = this.steps[next];
    if (!step) {
      this.stop();
      this.onFinish();
      return;
    }

    // the previous step stays up, so the spotlight can move from it
    this.index = next;
    this.history.push(next);
    this.waitingSince = Date.now();
    if (step.path && this.currentPath() !== step.path) this.navigate(step.path);
    step.onEnter?.();
    this.watch();
  }

  // shows the step once its target is there and no other modal covers it, hides it while one does
  protected watch(): void {
    const step = this.steps[this.index];
    if (!step) return;
    if (step.until?.()) {
      this.next();
      return;
    }
    const found = this.findTarget(step);
    const target = found?.element ?? null;
    if (this.isCovered(target)) {
      this.hide();
      return;
    }

    if (this.shownIndex === this.index) {
      if (!found) {
        if (step.targets.length > 0) this.hide();
      } else if (
        // a better target showed up, such as the font picker once a field is selected
        found.rank < this.shownRank
        // or the page drew the target again, which the editor does on every click
        || !this.driver.getActiveElement()?.isConnected
      ) {
        this.show(step, found.element, found.rank);
      }
      return;
    }
    const timedOut = Date.now() - this.waitingSince > TourRunner.TargetWaitMs;
    if (target || step.targets.length === 0 || timedOut) {
      this.show(step, target, found?.rank ?? 0);
    } else if (!this.driver.getActiveElement()?.isConnected) {
      // the previous target left with its page, so there's nothing to move from
      this.hide();
    }
  }

  // while a step is up, its card glides from there to the new one
  protected show(step: TourStep, target: Element | null, rank: number): void {
    const moving = this.shownIndex !== null;
    this.shownRank = rank;
    this.glideFrom = moving
      ? (document.querySelector('.driver-popover')?.getBoundingClientRect()
        ?? null)
      : null;
    this.shownIndex = this.index;
    this.driver.setConfig({
      ...this.driver.getConfig(),
      allowPageInteraction: step.interactive ?? false,
      // steps done in the page leave it lit and focused, so it can be used
      overlayOpacity: step.interactive
        ? TourRunner.InteractiveOverlayOpacity
        : TourRunner.OverlayOpacity,
      focus: step.interactive ? 'none' : 'popover',
      onPopoverRender: (popover) => this.render(step, popover.wrapper),
      onPopoverPositioned: (popover) => this.glide(popover.wrapper),
    });
    this.driver.highlight({
      element: target ?? undefined,
      popover: { title: ' ', description: ' ', side: step.side },
    });
  }

  // driver's own title and buttons give way to the panel's content
  protected render(step: TourStep, wrapper: HTMLElement): void {
    for (const child of wrapper.children) {
      (child as HTMLElement).hidden = true;
    }
    // driver keeps its popover between steps, so the last step's content goes
    wrapper.querySelector(`[${TourRunner.CardAttribute}]`)?.remove();
    const container = document.createElement('div');
    container.setAttribute(TourRunner.CardAttribute, '');
    wrapper.append(container);

    const shown = this.steps.filter((candidate) => !candidate.skip?.());
    this.onView({
      container,
      step,
      current: shown.indexOf(step) + 1,
      total: shown.length,
      canGoBack: this.history.length > 1,
    });
  }

  // slides the card from where the last step had it, once driver has placed it
  protected glide(wrapper: HTMLElement): void {
    const from = this.glideFrom;
    this.glideFrom = null;
    if (!from || window.matchMedia(TourRunner.ReducedMotionQuery).matches) {
      return;
    }
    const to = wrapper.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (dx === 0 && dy === 0) return;

    wrapper.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration: TourRunner.MoveMs, easing: TourRunner.MoveEasing },
    );
  }

  protected hide(): void {
    if (this.shownIndex === null) return;
    this.shownIndex = null;
    this.driver.destroy();
    this.onView(null);
  }

  protected handle(event: PracticeEvent): void {
    if (this.steps[this.index]?.waitFor?.(event)) this.next();
  }

  // the first target shown, with its position among the step's targets
  protected findTarget(
    step: TourStep,
  ): { element: Element; rank: number } | null {
    for (const [rank, selector] of step.targets.entries()) {
      const element = document.querySelector(selector);
      // a collapsed panel is in the page but has no size
      const box = element?.getBoundingClientRect();
      if (element && box && box.width > 0 && box.height > 0) {
        return { element, rank };
      }
    }
    return null;
  }

  // a modal over the page covers the target, unless the target is inside it
  protected isCovered(target: Element | null): boolean {
    const modals = document.querySelectorAll(TourRunner.ModalSelector);
    if (modals.length === 0) return false;
    return ![...modals].some((modal) => target && modal.contains(target));
  }
}
