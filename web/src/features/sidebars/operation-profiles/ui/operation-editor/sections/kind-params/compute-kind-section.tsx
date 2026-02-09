import React from 'react';
import { useTranslation } from 'react-i18next';

import { JsonKindParamsSection } from './json-kind-params-section';

type Props = {
	index: number;
};

const COMPUTE_PLACEHOLDER = `{
  "expression": "a + b",
  "inputs": {
    "a": 1,
    "b": 2
  }
}`;

export const ComputeKindSection: React.FC<Props> = ({ index }) => {
	const { t } = useTranslation();
	return (
		<JsonKindParamsSection
			index={index}
			kindLabel={t('operationProfiles.kind.compute')}
			description={t('operationProfiles.kindSection.compute.description')}
			placeholder={COMPUTE_PLACEHOLDER}
		/>
	);
};
