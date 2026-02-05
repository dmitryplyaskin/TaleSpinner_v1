import React from 'react';

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
	return (
		<JsonKindParamsSection
			index={index}
			kindLabel="Tool"
			description="Define tool call name, arguments, and runtime limits."
			placeholder={TOOL_PLACEHOLDER}
		/>
	);
};
