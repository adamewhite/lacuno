'use client';

import { usePathname } from 'next/navigation';

/**
 * Fades each route in as it arrives.
 *
 * The key is the pathname, so React discards the old subtree and mounts a new
 * one on every navigation — which is what restarts the CSS animation. Without
 * the key the class would be applied once, on first load, and never again.
 *
 * Enter-only. Animating an exit would mean holding the outgoing page on screen
 * while the next one loads, which requires intercepting every navigation and
 * delaying it by the length of the animation. That trades a real cost — the
 * page the player asked for arriving later — for a flourish they did not.
 *
 * `prefers-reduced-motion` drops the animation in globals.css rather than
 * here, so it sits with the rest of the motion it belongs to.
 */
export default function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="route-enter h-full">
      {children}
    </div>
  );
}
