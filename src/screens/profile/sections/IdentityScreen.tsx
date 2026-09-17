import React from 'react';
import { KycCard } from '../KycCard';
import { SectionScreen } from '../SectionScreen';
import { useT } from '../../../i18n';

/** PAN, Aadhaar, the link between them, and the bank account. */
export function IdentityScreen() {
  const t = useT();
  return (
    <SectionScreen title={t('kyc.title')}>
      <KycCard />
    </SectionScreen>
  );
}
