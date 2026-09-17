import React from 'react';
import { PersonalCard } from '../PersonalCard';
import { SectionScreen } from '../SectionScreen';
import { useT } from '../../../i18n';

export function PersonalScreen() {
  const t = useT();
  return (
    <SectionScreen title={t('personal.title')}>
      <PersonalCard />
    </SectionScreen>
  );
}
