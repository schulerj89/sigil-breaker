import { parseLevel } from '../core/levelParser';
import type { LevelDefinition, ParsedLevel } from '../core/levelTypes';
import tutorial01 from './levels/tutorial-01.json';
import tutorial02 from './levels/tutorial-02.json';
import tutorial03 from './levels/tutorial-03.json';
import tutorial04 from './levels/tutorial-04.json';
import tutorial05 from './levels/tutorial-05.json';
import tutorial06 from './levels/tutorial-06.json';
import tutorial07 from './levels/tutorial-07.json';
import tutorial08 from './levels/tutorial-08.json';
import tutorial09 from './levels/tutorial-09.json';
import tutorial10 from './levels/tutorial-10.json';
import tutorial11 from './levels/tutorial-11.json';
import tutorial12 from './levels/tutorial-12.json';

export interface LevelCatalogEntry {
  order: number;
  id: string;
  title: string;
  lesson: string;
  level: ParsedLevel;
}

const definitions = [
  { definition: tutorial01, lesson: 'Move to the exit.' },
  { definition: tutorial02, lesson: 'Push a crate out of your path.' },
  { definition: tutorial03, lesson: 'Crates on red plates open red doors.' },
  { definition: tutorial04, lesson: 'Doors close again when plates are released.' },
  { definition: tutorial05, lesson: 'Plan around multiple crates.' },
  { definition: tutorial06, lesson: 'Choose the route before committing.' },
  { definition: tutorial07, lesson: 'Undo is part of solving.' },
  { definition: tutorial08, lesson: 'A compact test of the first rules.' },
  { definition: tutorial09, lesson: 'Sleepy golems chase after successful turns.' },
  { definition: tutorial10, lesson: 'Lure golems onto red plates.' },
  { definition: tutorial11, lesson: 'Trap golems with crates and walls.' },
  { definition: tutorial12, lesson: 'Combine crates and golems to open doors.' },
] satisfies Array<{ definition: LevelDefinition; lesson: string }>;

export const levelCatalog: LevelCatalogEntry[] = definitions.map(({ definition, lesson }, index) => {
  const level = parseLevel(definition);

  return {
    order: index + 1,
    id: level.id,
    title: level.name,
    lesson,
    level,
  };
});

export function getLevelEntry(index: number): LevelCatalogEntry {
  return levelCatalog[Math.max(0, Math.min(index, levelCatalog.length - 1))];
}
