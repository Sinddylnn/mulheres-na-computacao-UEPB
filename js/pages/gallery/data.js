import { projectHref } from '../../core/paths.js';
import { TIMELINE } from './paths.js';

export async function loadTimeline() {
  const response = await fetch(projectHref(TIMELINE), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Erro HTTP ${response.status} ao carregar a timeline`);

  const timeline = await response.json();
  if (!Array.isArray(timeline)) throw new TypeError('A timeline deve ser uma lista de eventos');
  return timeline;
}
