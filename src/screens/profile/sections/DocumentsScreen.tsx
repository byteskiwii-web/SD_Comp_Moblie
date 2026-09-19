import React from 'react';
import { DocumentsCard } from '../DocumentsCard';
import { SectionScreen } from '../SectionScreen';
import { useT } from '../../../i18n';

/** Upload, view, replace: the onboarding documents HR reviews. */
export function DocumentsScreen() {
  const t = useT();
  return (
    <SectionScreen title={t('docs.statusTitle')}>
      <DocumentsCard />
    </SectionScreen>
  );
}
