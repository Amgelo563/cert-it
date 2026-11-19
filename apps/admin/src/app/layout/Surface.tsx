import { Box, type BoxProps } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './Surface.module.css';

type SurfaceProps = BoxProps & {
  children: ReactNode;
  /** Shadow (default) or border. */
  feel?: 'elevated' | 'bordered';
};

/** The card that holds each block of content on a page. */
export function Surface({
  children,
  feel = 'elevated',
  className,
  ...others
}: SurfaceProps) {
  return (
    <Box
      className={
        className ? `${classes.surface} ${className}` : classes.surface
      }
      data-feel={feel}
      {...others}
    >
      {children}
    </Box>
  );
}
