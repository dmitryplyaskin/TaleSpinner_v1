import React from 'react';

import { LlmRuntimeSelectorFields } from './runtime-selector-fields';

import type { LlmModel, LlmProviderDefinition, LlmProviderId, LlmScope, LlmTokenListItem } from '@shared/types/llm';

type Props = {
	scope: LlmScope;
	scopeId: string;
	providers: LlmProviderDefinition[];
	activeProviderId: LlmProviderId;
	tokens: LlmTokenListItem[];
	activeTokenId: string | null;
	models: LlmModel[];
	activeModel: string | null;
	onProviderSelect: (providerId: LlmProviderId) => void;
	onTokenSelect: (tokenId: string | null) => void;
	onModelSelect: (model: string | null) => void;
	onLoadModels: () => Promise<void>;
	onOpenTokenManager: (open: boolean) => void;
};

export const LlmRuntimeSelector: React.FC<Props> = ({
	scope,
	scopeId,
	providers,
	activeProviderId,
	tokens,
	activeTokenId,
	models,
	activeModel,
	onProviderSelect,
	onTokenSelect,
	onModelSelect,
	onLoadModels,
	onOpenTokenManager,
}) => {
	return (
		<LlmRuntimeSelectorFields
			providers={providers}
			activeProviderId={activeProviderId}
			tokens={tokens}
			activeTokenId={activeTokenId}
			models={models}
			activeModel={activeModel}
			onProviderSelect={onProviderSelect}
			onTokenSelect={onTokenSelect}
			onModelSelect={onModelSelect}
			onLoadModels={onLoadModels}
			allowTokenManager
			tokenManagerScope={scope}
			tokenManagerScopeId={scopeId}
			onOpenTokenManager={onOpenTokenManager}
		/>
	);
};
