import React from 'react';
import { useTranslation } from 'react-i18next';

import { JsonKindParamsSection } from './json-kind-params-section';

type Props = {
	index: number;
};

const LEGACY_PLACEHOLDER = `{
  "adapter": "legacy_v1",
  "payload": {}
}`;

export const LegacyKindSection: React.FC<Props> = ({ index }) => {
	const { t } = useTranslation();
	return (
		<JsonKindParamsSection
			index={index}
			kindLabel={t('operationProfiles.kind.legacy')}
			description={t('operationProfiles.kindSection.legacy.description')}
			placeholder={LEGACY_PLACEHOLDER}
		/>
	);
};
