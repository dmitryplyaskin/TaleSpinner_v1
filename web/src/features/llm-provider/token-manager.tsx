import { useUnit } from 'effector-react';
import { useMemo } from 'react';

import { llmProviderModel } from '@model/provider';

import { LlmTokenManagerDialog } from './llm-token-manager-dialog';

import type { LlmProviderId, LlmScope } from '@shared/types/llm';

type Props = {
	providerId: LlmProviderId;
	scope: LlmScope;
	scopeId: string;
};

export const TokenManager: React.FC<Props> = ({ providerId, scope, scopeId }) => {
	const [isOpen, setOpen, runtimeByKey] = useUnit([
		llmProviderModel.$isTokenManagerOpen,
		llmProviderModel.tokenManagerOpened,
		llmProviderModel.$runtimeByScopeKey,
	]);

	const activeTokenId = useMemo(() => {
		const runtime = runtimeByKey[`${scope}:${scopeId}`];
		return runtime?.activeTokenId ?? null;
	}, [runtimeByKey, scope, scopeId]);

	return (
		<LlmTokenManagerDialog
			open={isOpen}
			onOpenChange={setOpen}
			providerId={providerId}
			providerName={providerId}
			activeTokenId={activeTokenId}
			onTokenSelected={(tokenId) => llmProviderModel.tokenSelected({ scope, scopeId, tokenId })}
		/>
	);
};
