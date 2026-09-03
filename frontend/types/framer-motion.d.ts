import * as React from 'react';

declare module 'framer-motion' {
  export interface HTMLMotionProps<TagName extends keyof React.ReactHTML> extends React.HTMLAttributes<HTMLElement> {
    className?: string;
  }
  export interface SVGNode<TagName extends keyof React.ReactSVG> extends React.SVGAttributes<SVGElement> {
    className?: string;
  }
  export interface MotionProps {
    className?: string;
  }
}
