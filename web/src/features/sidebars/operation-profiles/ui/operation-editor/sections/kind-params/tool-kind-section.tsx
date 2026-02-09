import React from 'react';
import { useTranslation } from 'react-i18next';

import { JsonKindParamsSection } from './json-kind-params-section';

type Props = {
	index: number;
};

const TOOL_PLACEHOLDER = `{
  "toolName": "search_web",
  "timeoutMs": 15000,
  "args": {}
}`;

export const ToolKindSection: React.FC<Props> = ({ index }) => {
	const { t } = useTranslation();
	return (
		<JsonKindParamsSection
			index={index}
			kindLabel={t('operationProfiles.kind.tool')}
			description={t('operationProfiles.kindSection.tool.description')}
			placeholder={TOOL_PLACEHOLDER}
		/>
	);
};
