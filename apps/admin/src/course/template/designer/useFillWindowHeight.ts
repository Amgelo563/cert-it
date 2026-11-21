import { type RefObject, useEffect } from 'react';

// the admin layout's content area, which holds the page
function contentOf(element: HTMLElement): Element | null {
  return element.closest('main')?.firstElementChild ?? null;
}

/** Sizes an element, the last block of its page, to fill the window down to the layout's padding, never below `minPx`. */
export function useFillWindowHeight(
  ref: RefObject<HTMLElement | null>,
  minPx: number,
): void {
  useEffect(() => {
    const element = ref.current;
    const content = element && contentOf(element);
    if (!element || !content) return;

    const fit = () => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      const below = parseFloat(getComputedStyle(content).paddingBottom) || 0;
      const height = window.innerHeight - top - below;
      element.style.height = `${Math.max(minPx, Math.floor(height))}px`;
    };
    fit();
    // the page, not the stretched content area, so alerts coming and going refit it
    const observer = new ResizeObserver(fit);
    observer.observe(content.firstElementChild ?? content);
    window.addEventListener('resize', fit);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [ref, minPx]);
}
