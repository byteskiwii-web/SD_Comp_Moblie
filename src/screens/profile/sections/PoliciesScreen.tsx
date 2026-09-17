import React from 'react';
import type { Policy as PolicyType } from '../../../api/policies.api';
import { PolicyLibrary } from '../PolicyLibrary';
import { PolicyReaderSheet } from '../PolicyReaderSheet';
import { SectionScreen } from '../SectionScreen';
import { useT } from '../../../i18n';

/**
 * The policy library and its reader. The reader is a Modal, so it is mounted
 * through `overlay` — at the screen root, outside the scroll — for the
 * Android reason ProfileScreen documents.
 */
export function PoliciesScreen() {
  const t = useT();
  const [reading, setReading] = React.useState<PolicyType | null>(null);
  return (
    <SectionScreen
      title={t('profile.policies')}
      overlay={<PolicyReaderSheet policy={reading} onClose={() => setReading(null)} />}
    >
      <PolicyLibrary onOpen={setReading} />
    </SectionScreen>
  );
}
