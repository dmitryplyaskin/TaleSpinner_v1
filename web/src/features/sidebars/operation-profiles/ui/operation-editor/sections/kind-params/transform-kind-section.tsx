import React from 'react';

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
	return (
		<JsonKindParamsSection
			index={index}
			kindLabel="Transform"
			description="Describe post-processing steps for operation outputs."
			placeholder={TRANSFORM_PLACEHOLDER}
		/>
	);
};
