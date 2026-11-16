import type { SVGProps } from "react";

/** Monochrome BorkForge mark for use on application surfaces. */
export function BorkForgeMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 310 310" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M76 30 123 64h64l47-34-12 56-17 17H105L88 86 76 30Z" />
      <path d="M4 130h302c-12 15-30 24-55 33-27 9-40 19-41 36-1 20 9 37 30 47h10v18h-45c0-28-22-48-50-48s-50 20-50 48H60v-18h10c21-10 31-27 30-47-1-17-14-27-41-36-25-9-43-18-55-33Z" />
    </svg>
  );
}
