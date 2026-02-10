import { LlmProviderPanel } from './llm-provider-panel';

import type { LlmScope } from '@shared/types/llm';

type Props = {
	scope: LlmScope;
	scopeId: string;
};

export const ProviderPicker: React.FC<Props> = ({ scope, scopeId }) => {
	return <LlmProviderPanel scope={scope} scopeId={scopeId} showRuntime showConfig showPresets />;
};
