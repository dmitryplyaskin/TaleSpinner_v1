import React from 'react';

import { JsonKindParamsSection } from './json-kind-params-section';

type Props = {
	index: number;
};

const LEGACY_PLACEHOLDER = `{
  "adapter": "legacy_v1",
  "payload": {}
}`;

export const LegacyKindSection: React.FC<Props> = ({ index }) => {
	return (
		<JsonKindParamsSection
			index={index}
			kindLabel="Legacy"
			description="Use this section for compatibility payloads required by legacy executors."
			placeholder={LEGACY_PLACEHOLDER}
		/>
	);
};
