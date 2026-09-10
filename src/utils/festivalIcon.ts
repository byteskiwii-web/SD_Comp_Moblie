import type Ionicons from '@expo/vector-icons/Ionicons';

/**
 * An icon for a festival, matched on its name.
 *
 * Every glyph here was checked against the Ionicons glyph map before being
 * used — an invalid name does not throw, it renders a blank box, so a typo
 * survives review and ships.
 *
 * A COLOUR RIDES WITH EACH ONE, because Ionicons is a monochrome line set and
 * roughly forty festivals would otherwise be forty grey outlines. The hue is
 * what makes Diwali and Holi distinguishable at a glance; the glyph alone is
 * not enough at 18px.
 *
 * Matching is by SUBSTRING, in order, because the calendar feed does not use
 * canonical names: "Diwali/Deepavali", "Chhat Puja (Pratihar Sashthi/Surya
 * Sashthi)", "Janmashtami (Smarta)". An exact-match table would miss most
 * real rows.
 *
 * ORDER MATTERS. Specific before general — "Holika Dahana" must be tested
 * before "Holi" or the bonfire the night before takes the colour-throwing
 * icon, and "Christmas Eve" before "Christmas".
 */

export type FestivalGlyph = {
  name: keyof typeof Ionicons.glyphMap;
  /** Literal hex, not a theme token: these are the festival's own colours and
   *  they must read the same in light and dark. Each is picked to stay legible
   *  on both grounds rather than to match the app's palette. */
  tint: string;
};

type Rule = [test: string, glyph: FestivalGlyph];

const AMBER = '#D97706';
const ROSE = '#DB2777';
const GREEN = '#059669';
const BLUE = '#2563EB';
const VIOLET = '#7C3AED';
const TEAL = '#0D9488';
const RED = '#DC2626';
const SLATE = '#64748B';

const RULES: Rule[] = [
  // Lights and colour
  ['holika', { name: 'bonfire', tint: AMBER }],
  ['holi', { name: 'color-palette', tint: ROSE }],
  ['diwali', { name: 'flame', tint: AMBER }],
  ['deepavali', { name: 'flame', tint: AMBER }],
  ['naraka chaturdasi', { name: 'flame', tint: AMBER }],
  ['govardhan', { name: 'leaf', tint: GREEN }],
  ['bhai duj', { name: 'ribbon', tint: ROSE }],

  // Harvest and new year
  ['pongal', { name: 'leaf', tint: GREEN }],
  ['makar sankranti', { name: 'sunny', tint: AMBER }],
  ['ugadi', { name: 'leaf', tint: GREEN }],
  ['gudi padwa', { name: 'leaf', tint: GREEN }],
  ['bihu', { name: 'leaf', tint: GREEN }],
  ['vaisakhi', { name: 'leaf', tint: GREEN }],
  ['baisakhi', { name: 'leaf', tint: GREEN }],
  ['mesadi', { name: 'leaf', tint: GREEN }],
  ['onam', { name: 'boat', tint: TEAL }],
  ['new year', { name: 'sparkles', tint: VIOLET }],

  // Deities and observances
  ['ganesh', { name: 'flower', tint: ROSE }],
  ['janmashtami', { name: 'musical-notes', tint: VIOLET }],
  ['rama navami', { name: 'star', tint: AMBER }],
  ['hanuman', { name: 'shield', tint: AMBER }],
  ['shivaratri', { name: 'moon', tint: VIOLET }],
  ['navratri', { name: 'flower', tint: ROSE }],
  ['durga', { name: 'flower', tint: ROSE }],
  ['saptami', { name: 'flower', tint: ROSE }],
  ['ashtami', { name: 'flower', tint: ROSE }],
  ['dussehra', { name: 'trophy', tint: AMBER }],
  ['dasara', { name: 'trophy', tint: AMBER }],
  ['vasant panchami', { name: 'book', tint: BLUE }],
  ['saraswati', { name: 'book', tint: BLUE }],
  ['rath yatra', { name: 'star', tint: AMBER }],
  ['chhat', { name: 'sunny', tint: AMBER }],
  ['karaka chaturthi', { name: 'moon', tint: VIOLET }],
  ['karva chauth', { name: 'moon', tint: VIOLET }],
  ['raksha bandhan', { name: 'ribbon', tint: ROSE }],
  ['rakhi', { name: 'ribbon', tint: ROSE }],

  // Faiths
  ['ramadan', { name: 'moon', tint: TEAL }],
  ['ramzan', { name: 'moon', tint: TEAL }],
  ['jamat ul-vida', { name: 'moon', tint: TEAL }],
  ['bakrid', { name: 'moon', tint: TEAL }],
  ['eid', { name: 'moon', tint: TEAL }],
  ['muharram', { name: 'moon', tint: TEAL }],
  ['milad', { name: 'moon', tint: TEAL }],
  ['hazarat ali', { name: 'moon', tint: TEAL }],
  ['good friday', { name: 'heart', tint: RED }],
  ['easter', { name: 'flower', tint: ROSE }],
  ['christmas eve', { name: 'star', tint: AMBER }],
  ['christmas', { name: 'gift', tint: RED }],
  ['buddha', { name: 'flower', tint: AMBER }],
  ['mahavir', { name: 'flower', tint: AMBER }],
  ['guru nanak', { name: 'book', tint: AMBER }],
  ['guru ravidas', { name: 'book', tint: AMBER }],
  ['guru tegh', { name: 'book', tint: AMBER }],
  ['guru gobind', { name: 'book', tint: AMBER }],

  // The state
  ['republic day', { name: 'flag', tint: GREEN }],
  ['independence day', { name: 'flag', tint: GREEN }],
  ['gandhi', { name: 'people', tint: SLATE }],
  ['ambedkar', { name: 'library', tint: BLUE }],
  ['shivaji', { name: 'shield', tint: AMBER }],
  ['valmiki', { name: 'book', tint: BLUE }],
  ['rabindranath', { name: 'book', tint: BLUE }],
  ['dayanand', { name: 'book', tint: BLUE }],
];

const DEFAULT: FestivalGlyph = { name: 'calendar', tint: SLATE };

/**
 * Falls back to a calendar rather than to nothing.
 *
 * A missing icon would make rows jump horizontally as the list scrolls past an
 * unmatched name, and the feed carries regional festivals this table will
 * never fully cover.
 */
export function festivalIcon(name: string): FestivalGlyph {
  const n = String(name || '').toLowerCase();
  for (const [test, glyph] of RULES) {
    if (n.includes(test)) return glyph;
  }
  return DEFAULT;
}
