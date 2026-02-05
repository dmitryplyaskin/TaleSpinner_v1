import React from 'react';

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
	return (
		<JsonKindParamsSection
			index={index}
			kindLabel="RAG"
			description="Configure retrieval source and ranking parameters for context assembly."
			placeholder={RAG_PLACEHOLDER}
		/>
	);
};
