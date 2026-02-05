import React from 'react';

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
	return (
		<JsonKindParamsSection
			index={index}
			kindLabel="Compute"
			description="Configure deterministic computations or transformations over structured inputs."
			placeholder={COMPUTE_PLACEHOLDER}
		/>
	);
};
