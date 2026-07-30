import type { LlmModel } from '@shared/types/llm';

export type ModelFilter = 'all' | 'free' | 'vision' | 'reasoning' | 'tools';

function searchableText(model: LlmModel): string {
	return `${model.name} ${model.id}`.toLocaleLowerCase();
}

export function filterModels(models: LlmModel[], query: string, filter: ModelFilter): LlmModel[] {
	const normalizedQuery = query.trim().toLocaleLowerCase();
	return models.filter((model) => {
		if (normalizedQuery && !searchableText(model).includes(normalizedQuery)) return false;
		if (filter === 'free') return model.id.endsWith(':free');
		if (filter === 'vision') return model.inputModalities?.includes('image') === true;
		if (filter === 'reasoning') return model.supportedParameters?.includes('reasoning') === true;
		if (filter === 'tools') return model.supportedParameters?.includes('tools') === true;
		return true;
	});
}

export function formatContextLength(value?: number): string | null {
	if (!value) return null;
	if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
	if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
	return String(value);
}

export function formatPricePerMillion(value?: string): string | null {
	if (!value) return null;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return null;
	const perMillion = parsed * 1_000_000;
	return `$${perMillion < 0.01 ? perMillion.toFixed(3) : perMillion.toFixed(2)}`;
}

export function getModelMetadata(model: LlmModel) {
	return {
		context: formatContextLength(model.contextLength),
		inputPrice: formatPricePerMillion(model.pricing?.prompt),
		outputPrice: formatPricePerMillion(model.pricing?.completion),
		vision: model.inputModalities?.includes('image') === true,
		reasoning: model.supportedParameters?.includes('reasoning') === true,
		tools: model.supportedParameters?.includes('tools') === true,
	};
}
