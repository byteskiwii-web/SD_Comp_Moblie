import React from 'react';
import { LegalLinks } from '../../../components/LegalLinks';
import { DeleteAccountCard } from '../DeleteAccountCard';
import { SectionScreen } from '../SectionScreen';
import { useT } from '../../../i18n';

/**
 * Privacy policy, terms, and account deletion.
 *
 * Both stores require the deletion route to exist inside the app and the
 * privacy policy to be reachable from it; this is that place. Deliberately
 * one tap away from the hub rather than on it — nowhere near the controls
 * people use daily, which is where the long page also kept it.
 */
export function AccountScreen() {
  const t = useT();
  return (
    <SectionScreen title={t('profile.menu.account')}>
      <LegalLinks />
      <DeleteAccountCard />
    </SectionScreen>
  );
}
