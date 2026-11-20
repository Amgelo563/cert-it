import { Text } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './MonoFigure.module.css';

type MonoFigureProps = {
  children: ReactNode;
};

/** A date, count or id set like a ledger entry: muted, monospaced, tabular. */
export function MonoFigure({ children }: MonoFigureProps) {
  return (
    <Text component="span" className={classes.figure}>
      {children}
    </Text>
  );
}
