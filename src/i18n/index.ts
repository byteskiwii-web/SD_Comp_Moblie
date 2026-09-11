import { useEffect, useState } from 'react';
import { usePreferencesStore, type LanguageCode } from '../stores/preferencesStore';
import { en } from './locales/en';
import { hi } from './locales/hi';
import { ta } from './locales/ta';
import { te } from './locales/te';
import { kn } from './locales/kn';
import { ml } from './locales/ml';
import { bn } from './locales/bn';
import { mr } from './locales/mr';
import { gu } from './locales/gu';
import { pa } from './locales/pa';

/**
 * Translation, hand-rolled and dependency-free.
 *
 * WHY NOT i18next: this needs a lookup, an interpolation and a two-form
 * plural. i18next brings a plugin system, a backend loader, a detector chain
 * and an interpolation engine, none of which are wanted here, and every
 * dependency added to an Expo Go app is another thing that can throw at
 * module-evaluation time on a device we cannot debug. Forty lines is cheaper
 * than that risk.
 *
 * WHY NOT Intl: Hermes already renders the noon hour as AM, which is why
 * datetime.ts formats by hand. A formatter that is wrong twice a day is not
 * something to build month names on top of, so the names live in the
 * catalogues too.
 *
 * The catalogues are typed COMPLETE, not partial. A partial type would let a
 * missing Tamil string compile and then show English on somebody's screen --
 * the exact failure this layer exists to remove.
 */
export type Catalogue = Record<keyof typeof en, string>;
export type TKey = keyof typeof en;

const CATALOGUES: Record<LanguageCode, Catalogue> = { en, hi, ta, te, kn, ml, bn, mr, gu, pa };

type Vars = Record<string, string | number>;

/**
 * Resolve one key.
 *
 * The fallback chain is: the asked-for language, then English, then the key
 * itself. The key is deliberately the last resort rather than an empty string
 * -- a screen showing `leave.withdraw` is obviously broken and reportable,
 * where a blank button is just baffling.
 */
export function translate(key: TKey, vars?: Vars, lang?: LanguageCode): string {
  const code = lang ?? currentLang();
  const table = CATALOGUES[code] ?? en;

  let lookup: string = key;
  if (vars && typeof vars.count === 'number') {
    // A plural key is stored as a pair. Fall back to the bare key so a string
    // that merely happens to carry a count does not have to be pluralised.
    const variant = (key + (vars.count === 1 ? '_one' : '_other')) as TKey;
    if (variant in table || variant in en) lookup = variant;
  }

  const raw = (table as Record<string, string>)[lookup] ?? (en as Record<string, string>)[lookup];
  if (raw === undefined) {
    if (__DEV__) console.warn('[i18n] missing key: ' + String(key) + ' (' + code + ')');
    return String(key);
  }
  return vars ? interpolate(raw, vars) : raw;
}

/** `{name}` only. A catalogue is data; nothing in it is evaluated. */
function interpolate(text: string, vars: Vars): string {
  return text.replace(/\{(\w+)\}/g, (whole, name) =>
    name in vars ? String(vars[name]) : whole
  );
}

function currentLang(): LanguageCode {
  try {
    return usePreferencesStore.getState().language;
  } catch {
    return 'en';
  }
}

/**
 * Translate from outside React.
 *
 * For alerts, thrown messages, notification bodies and headless tasks -- the
 * places with no component to subscribe. Anything RENDERED should use useT so
 * that changing the language repaints it.
 */
export const t = (key: TKey, vars?: Vars): string => translate(key, vars);

/**
 * Translate inside a component, and re-render when the language changes.
 *
 * The returned function is recreated whenever the language does, which is what
 * makes a screen holding it in a `useMemo` recompute rather than keep the old
 * language's strings.
 */
export function useT(): (key: TKey, vars?: Vars) => string {
  const lang = usePreferencesStore((s) => s.language);
  return (key, vars) => translate(key, vars, lang);
}

/** The active language, for a component that needs to branch on it. */
export function useLanguage(): LanguageCode {
  return usePreferencesStore((s) => s.language);
}

/**
 * Wait for the persisted language before painting.
 *
 * zustand/persist hydrates asynchronously from AsyncStorage, so the very first
 * frame after a cold start has the DEFAULT language, not the chosen one. The
 * app used to be English-only and never noticed. Now it would flash English at
 * somebody who set Hindi, on every launch.
 */
export function useI18nReady(): boolean {
  const [ready, setReady] = useState(() => usePreferencesStore.persist.hasHydrated());
  useEffect(() => {
    if (ready) return;
    return usePreferencesStore.persist.onFinishHydration(() => setReady(true));
  }, [ready]);
  return ready;
}
