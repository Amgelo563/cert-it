import { useMergedRef } from '@mantine/hooks';
import { type Ref, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/** Accessible names for the Designer's own controls, which pdfme leaves unlabeled. */
type DesignerControlLabels = {
  /** Label of the button that opens or closes the field list. */
  toggleFieldList: string;
  /** Label of a field type's button, from the type's name. */
  addFieldType: (name: string) => string;
  /** Name of the canvas, which scrolls when zoomed in. */
  canvas: string;
};

// the drag attributes dnd-kit puts on each field type's wrapper
const DragAttributes = ['aria-roledescription', 'aria-describedby'];

// how far one arrow key press scrolls the canvas
const ArrowScrollPx = 40;

const ArrowScroll: Readonly<Record<string, [number, number]>> = {
  ArrowUp: [0, -ArrowScrollPx],
  ArrowDown: [0, ArrowScrollPx],
  ArrowLeft: [-ArrowScrollPx, 0],
  ArrowRight: [ArrowScrollPx, 0],
};

// only writes what differs, so the observer doesn't see its own changes as new
function setAttribute(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function removeAttribute(element: Element, name: string): void {
  if (element.hasAttribute(name)) element.removeAttribute(name);
}

function applyLabels(root: HTMLElement, labels: DesignerControlLabels): void {
  const toggle = root.querySelector('.pdfme-designer-sidebar-toggle');
  if (toggle) setAttribute(toggle, 'aria-label', labels.toggleFieldList);

  // focusable, so it can be scrolled with the keyboard
  const canvas = root.querySelector('.pdfme-designer-canvas');
  if (canvas) {
    setAttribute(canvas, 'tabindex', '0');
    setAttribute(canvas, 'role', 'region');
    setAttribute(canvas, 'aria-label', labels.canvas);
  }

  // each field type is a draggable wrapper around a button; the button becomes the one control, and its keys still reach the wrapper's drag listeners
  for (const button of root.querySelectorAll(
    'button[class*="pdfme-designer-plugin-"]',
  )) {
    const wrapper = button.parentElement?.closest('[aria-roledescription]');
    const name = button.querySelector('[title]')?.getAttribute('title');
    if (!wrapper || !name) continue;
    setAttribute(button, 'aria-label', labels.addFieldType(name));
    for (const attribute of DragAttributes) {
      const value = wrapper.getAttribute(attribute);
      if (value !== null) setAttribute(button, attribute, value);
      removeAttribute(wrapper, attribute);
    }
    removeAttribute(wrapper, 'role');
    removeAttribute(wrapper, 'tabindex');
    removeAttribute(wrapper, 'aria-disabled');
  }
}

// pdfme takes the arrow keys page-wide to move selected fields, so the focused canvas scrolls by hand while none is selected
function scrollCanvasWithArrows(event: KeyboardEvent): void {
  const step = ArrowScroll[event.key];
  const canvas = event.target;
  if (
    !step
    || !(canvas instanceof HTMLElement)
    || !canvas.matches('.pdfme-designer-canvas')
  ) {
    return;
  }
  const selection = canvas.querySelector('.moveable-control-box');
  if (selection && getComputedStyle(selection).display !== 'none') return;
  canvas.scrollBy({ left: step[0], top: step[1] });
}

type DesignerContainerProps = {
  ref?: Ref<HTMLDivElement>;
  className?: string;
};

/** The element the pdfme Designer renders into, filling its accessibility gaps: names its controls, gives each field type one tab stop, and lets the canvas be focused and scrolled with the keyboard. */
export function DesignerContainer({ ref, className }: DesignerContainerProps) {
  const { t } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRef(root, ref);

  // pdfme renders its controls again at will, so they're fixed up on every change
  useEffect(() => {
    const element = root.current;
    if (!element) return;

    const labels: DesignerControlLabels = {
      toggleFieldList: t('template.toggleFieldList'),
      addFieldType: (name) => t('template.addFieldType', { name }),
      canvas: t('template.canvasLabel'),
    };
    applyLabels(element, labels);
    const observer = new MutationObserver(() => applyLabels(element, labels));
    // attributes too, since React puts the wrapper's role back when dnd-kit's change
    observer.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'tabindex', ...DragAttributes],
    });
    // listened to here, since the canvas is pdfme's and its keys bubble up
    element.addEventListener('keydown', scrollCanvasWithArrows);
    return () => {
      observer.disconnect();
      element.removeEventListener('keydown', scrollCanvasWithArrows);
    };
  }, [t]);

  return <div ref={mergedRef} className={className} />;
}
