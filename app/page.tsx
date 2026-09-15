import TodayGame from './TodayGame';
import { DEFAULT_DIFFICULTY } from '../lib/lacuno/difficulty';

/**
 * The landing page plays today's daily game at the default level. Every level
 * is also directly reachable at /standard, /challenging, /difficult and
 * /brutal, which is how the playtest links are shared. Past days live under
 * /archive.
 */
export default function Home() {
  return <TodayGame difficulty={DEFAULT_DIFFICULTY} />;
}
