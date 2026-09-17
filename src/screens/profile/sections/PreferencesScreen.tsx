import React from 'react';
import { PreferencesCard } from '../PreferencesCard';
import { SectionScreen } from '../SectionScreen';
import { useT } from '../../../i18n';

/** Language and clock format — the two things the app lets you set about itself. */
export function PreferencesScreen() {
  const t = useT();
  return (
    <SectionScreen title={t('profile.menu.prefs')}>
      <PreferencesCard />
    </SectionScreen>
  );
}
