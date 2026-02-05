import React from 'react';

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
	return (
		<JsonKindParamsSection
			index={index}
			kindLabel="LLM"
			description="Configure direct model-call options for this operation."
			placeholder={LLM_PLACEHOLDER}
		/>
	);
};
