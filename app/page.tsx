import Game from './Game';
import { DEFAULT_DIFFICULTY } from '../lib/lacuno/difficulty';

/**
 * The landing page plays the default level. Every level is also directly
 * reachable at /standard, /challenging, /difficult and /brutal, which is how
 * the playtest links are shared.
 */
export default function Home() {
  return <Game difficulty={DEFAULT_DIFFICULTY} />;
}
