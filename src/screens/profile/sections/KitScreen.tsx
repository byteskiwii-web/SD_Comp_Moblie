import React from 'react';
import { KitCard } from '../KitCard';
import { SectionScreen } from '../SectionScreen';
import { useT } from '../../../i18n';

export function KitScreen() {
  const t = useT();
  return (
    <SectionScreen title={t('kit.title')}>
      <KitCard />
    </SectionScreen>
  );
}
