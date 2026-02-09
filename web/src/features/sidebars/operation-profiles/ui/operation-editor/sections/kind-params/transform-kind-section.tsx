import React from 'react';
import { useTranslation } from 'react-i18next';

import { JsonKindParamsSection } from './json-kind-params-section';

type Props = {
	index: number;
};

const TRANSFORM_PLACEHOLDER = `{
  "pipeline": [
    { "type": "trim" },
    { "type": "normalize_whitespace" }
  ]
}`;

export const TransformKindSection: React.FC<Props> = ({ index }) => {
	const { t } = useTranslation();
	return (
		<JsonKindParamsSection
			index={index}
			kindLabel={t('operationProfiles.kind.transform')}
			description={t('operationProfiles.kindSection.transform.description')}
			placeholder={TRANSFORM_PLACEHOLDER}
		/>
	);
};
