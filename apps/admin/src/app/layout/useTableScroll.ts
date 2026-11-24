import { useEffect, useRef, useState } from 'react';

const overflowsOf = (viewport: HTMLElement) =>
  viewport.scrollWidth > viewport.clientWidth;

/**
 * Props for a DataTable whose columns may overflow: an always visible scrollbar, and a viewport that can be focused and scrolled with the keyboard while it overflows.
 *
 * @param label Name of the scrollable region, such as the table's title.
 * @param rows The table's rows, whose change may change its width.
 */
export function useTableScroll(label: string, rows: readonly unknown[]) {
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const watched = useRef<{
    viewport: HTMLElement;
    observer: ResizeObserver;
  } | null>(null);

  // again with new rows, which change the width; the viewport may also mount late
  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (viewport !== (watched.current?.viewport ?? null)) {
      watched.current?.observer.disconnect();
      watched.current = null;
      if (viewport) {
        // the window resizes the viewport without a render
        const observer = new ResizeObserver(() =>
          setOverflows(overflowsOf(viewport)),
        );
        observer.observe(viewport);
        watched.current = { viewport, observer };
      }
    }
    if (viewport) setOverflows(overflowsOf(viewport));
  }, [rows]);

  useEffect(
    () => () => {
      watched.current?.observer.disconnect();
      watched.current = null;
    },
    [],
  );

  return {
    scrollViewportRef,
    scrollAreaProps: {
      type: 'auto' as const,
      // a tab stop only while there's something to scroll
      viewportProps: overflows
        ? { tabIndex: 0, role: 'region', 'aria-label': label }
        : {},
    },
  };
}
