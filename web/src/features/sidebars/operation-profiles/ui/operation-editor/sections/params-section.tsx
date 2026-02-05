import React from 'react';

import { ComputeKindSection } from './kind-params/compute-kind-section';
import { LegacyKindSection } from './kind-params/legacy-kind-section';
import { LlmKindSection } from './kind-params/llm-kind-section';
import { RagKindSection } from './kind-params/rag-kind-section';
import { TemplateKindSection } from './kind-params/template-kind-section';
import { ToolKindSection } from './kind-params/tool-kind-section';
import { TransformKindSection } from './kind-params/transform-kind-section';

import type { OperationKind } from '@shared/types/operation-profiles';

type Props = {
	index: number;
	kind: OperationKind;
};

export const ParamsSection: React.FC<Props> = ({ index, kind }) => {
	switch (kind) {
		case 'template':
			return <TemplateKindSection index={index} />;
		case 'llm':
			return <LlmKindSection index={index} />;
		case 'rag':
			return <RagKindSection index={index} />;
		case 'tool':
			return <ToolKindSection index={index} />;
		case 'compute':
			return <ComputeKindSection index={index} />;
		case 'transform':
			return <TransformKindSection index={index} />;
		case 'legacy':
			return <LegacyKindSection index={index} />;
		default:
			return null;
	}
};

