import React from 'react';
import { useTranslation } from 'react-i18next';

import { JsonKindParamsSection } from './json-kind-params-section';

type Props = {
	index: number;
};

const RAG_PLACEHOLDER = `{
  "source": "knowledge-base",
  "queryMode": "semantic",
  "topK": 5
}`;

export const RagKindSection: React.FC<Props> = ({ index }) => {
	const { t } = useTranslation();
	return (
		<JsonKindParamsSection
			index={index}
			kindLabel={t('operationProfiles.kind.rag')}
			description={t('operationProfiles.kindSection.rag.description')}
			placeholder={RAG_PLACEHOLDER}
		/>
	);
};
