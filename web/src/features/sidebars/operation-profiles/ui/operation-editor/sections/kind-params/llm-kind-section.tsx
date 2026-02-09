import React from 'react';
import { useTranslation } from 'react-i18next';

import { JsonKindParamsSection } from './json-kind-params-section';

type Props = {
	index: number;
};

const LLM_PLACEHOLDER = `{
  "model": "gpt-4.1",
  "temperature": 0.2,
  "maxTokens": 600
}`;

export const LlmKindSection: React.FC<Props> = ({ index }) => {
	const { t } = useTranslation();
	return (
		<JsonKindParamsSection
			index={index}
			kindLabel={t('operationProfiles.kind.llm')}
			description={t('operationProfiles.kindSection.llm.description')}
			placeholder={LLM_PLACEHOLDER}
		/>
	);
};
