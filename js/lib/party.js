// « Voyageurs » : qui part pour ce voyage. Sert à adapter le guide de visite, l'assistant et les conseils.
import { ls } from '../core/config.js';

export const KINDS = [
  { id: 'adulte', label: 'Adulte', icon: 'person' },
  { id: 'enfant', label: 'Enfant', icon: 'child' },
  { id: 'bebe', label: 'Bébé', icon: 'baby' },
  { id: 'chien', label: 'Chien', icon: 'dog' },
  { id: 'chat', label: 'Autre animal', icon: 'paw' },
];
export const kindOf = (id) => KINDS.find((k) => k.id === id) || KINDS[0];

export const DEFAULT_PARTY = [
  { kind: 'adulte', name: 'Eymric' },
  { kind: 'adulte', name: 'Marie', pregnant: true },
  { kind: 'enfant', name: 'notre fille', age: 5 },
];

export const getParty = (trip) => (trip?.party?.length ? trip.party : ls.get('lastParty', null) || DEFAULT_PARTY);
export const rememberParty = (party) => ls.set('lastParty', party);

const ageTxt = (t) => (t.age != null && t.age !== '' ? ` (${t.age} an${Number(t.age) > 1 ? 's' : ''})` : '');

// Phrase décrivant le groupe, pour l'IA.
export function describeParty(party) {
  const parts = party.map((t) => {
    const n = t.name ? `${t.name}, ` : '';
    if (t.kind === 'adulte') return `${n}adulte${t.pregnant ? ' enceinte (rythme doux, pas de longue station debout, pauses et toilettes fréquentes)' : ''}${t.mobility ? ' à mobilité réduite' : ''}`;
    if (t.kind === 'enfant') return `${n}enfant${ageTxt(t)}`;
    if (t.kind === 'bebe') return `${n}bébé${t.age ? ` de ${t.age} mois` : ''} (poussette, change, allaitement/biberons)`;
    if (t.kind === 'chien') return `${n}chien${t.size ? ` (${t.size})` : ''} — vérifier où les chiens sont acceptés`;
    return `${n}animal de compagnie`;
  });
  const extra = ls.get('partyNotes', '');
  return `Le groupe : ${parts.join(' ; ')}.${extra ? ` Besoins particuliers : ${extra}.` : ''}`;
}

// Rubriques du guide adaptées au groupe.
export function guideSections(party) {
  const kids = party.filter((t) => t.kind === 'enfant');
  const babies = party.filter((t) => t.kind === 'bebe');
  const pregnant = party.filter((t) => t.pregnant);
  const pets = party.filter((t) => t.kind === 'chien' || t.kind === 'chat');
  const out = [];
  if (kids.length) out.push(`## Avec ${kids.length === 1 ? `${kids[0].name || 'votre enfant'}${ageTxt(kids[0])}` : 'les enfants'}`);
  if (babies.length) out.push('## Avec bébé\n(poussette, ascenseurs, table à langer, coin calme)');
  if (pregnant.length) out.push(`## Confort pour ${pregnant.map((p) => p.name).join(' et ')}\n(ascenseurs, assises, cafés, toilettes, zones calmes, ce qui est fatigant à éviter)`);
  if (pets.length) out.push('## Avec le chien\n(accepté ou non, parcs proches pour le promener, règles)');
  return out.join('\n');
}

export const partyKey = (party) =>
  party.map((t) => `${t.kind}${t.age ?? ''}${t.pregnant ? 'p' : ''}${t.mobility ? 'm' : ''}`).join('-') + (ls.get('partyNotes', '') ? '+n' : '');
