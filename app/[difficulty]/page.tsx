import { notFound } from 'next/navigation';

import Game from '../Game';
import { DIFFICULTIES, type Difficulty } from '../../lib/lacuno/difficulty';

/** One static route per level, so each is directly linkable for playtesting. */
export function generateStaticParams() {
  return DIFFICULTIES.map((difficulty) => ({ difficulty }));
}

export default async function DifficultyPage({
  params,
}: {
  params: Promise<{ difficulty: string }>;
}) {
  const { difficulty } = await params;
  if (!DIFFICULTIES.includes(difficulty as Difficulty)) notFound();
  return <Game difficulty={difficulty as Difficulty} />;
}
