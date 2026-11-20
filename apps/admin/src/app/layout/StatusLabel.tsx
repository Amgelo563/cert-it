import type { MantineColor } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './StatusLabel.module.css';

type StatusLabelProps = {
  /** Color of the dot; gray when it carries no meaning. */
  color?: MantineColor;
  children: ReactNode;
};

/** A small colored dot and plain text, for statuses and kinds in table rows. */
export function StatusLabel({ color = 'gray', children }: StatusLabelProps) {
  return (
    <span className={classes.label}>
      <span
        className={classes.dot}
        style={{ backgroundColor: `var(--mantine-color-${color}-filled)` }}
        aria-hidden
      />
      {children}
    </span>
  );
}
