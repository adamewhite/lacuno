import Game from './Game';
import { DEFAULT_DIFFICULTY } from '../lib/procro/difficulty';

/**
 * The landing page plays the default level. Every level is also directly
 * reachable at /easiest, /easier, /medium and /hardest, which is how the
 * playtest links are shared.
 */
export default function Home() {
  return <Game difficulty={DEFAULT_DIFFICULTY} />;
}
