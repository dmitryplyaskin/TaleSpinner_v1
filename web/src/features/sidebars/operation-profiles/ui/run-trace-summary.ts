import type { RunTrace, TraceEffect, TraceOperation } from '@model/operation-run-trace';

export type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

export function resolveOpName(trace: RunTrace, opId: string): string {
	const found = trace.operations.find((op) => op.opId === opId);
	return found?.name ?? opId;
}

export function describeDestination(t: TranslateFn, effect: TraceEffect): string {
	if (effect.type === 'prompt.system_update') {
		const mode = effect.mode ? t(`operationProfiles.runTrace.modeLabel.${effect.mode}`) : '';
		return t('operationProfiles.runTrace.dest.systemPrompt', { mode });
	}
	if (effect.type === 'prompt.append_after_last_user') return t('operationProfiles.runTrace.dest.promptAfterUser');
	if (effect.type === 'prompt.insert_at_depth') {
		return t('operationProfiles.runTrace.dest.promptDepth', { depth: effect.depthFromEnd ?? 0 });
	}
	if (effect.type === 'turn.user.replace_text') return t('operationProfiles.runTrace.dest.rewriteUser');
	if (effect.type === 'turn.assistant.replace_text') return t('operationProfiles.runTrace.dest.rewriteAssistant');
	if (effect.type === 'ui.inline') return t('operationProfiles.runTrace.dest.uiCard');
	return t('operationProfiles.runTrace.dest.state', { tag: effect.artifactId ?? '?' });
}

function describeDoneSummary(t: TranslateFn, op: TraceOperation): string {
	const exposureEffects = op.effects.filter((effect) => effect.type !== 'artifact.upsert');
	const artifactEffect = op.effects.find((effect) => effect.type === 'artifact.upsert');
	const destinations = (exposureEffects.length > 0 ? exposureEffects : op.effects.slice(0, 1)).map((effect) =>
		describeDestination(t, effect),
	);
	const chars = artifactEffect?.valueChars ?? exposureEffects[0]?.valueChars ?? null;
	const charsLabel = chars !== null ? t('operationProfiles.runTrace.chars', { count: chars }) : null;
	if (destinations.length === 0) return charsLabel ?? '';
	const target = destinations.join(' · ');
	return charsLabel ? `${charsLabel} → ${target}` : target;
}

function describeSkipSummary(t: TranslateFn, trace: RunTrace, op: TraceOperation): string {
	if (op.skipReason === 'activation_not_reached') {
		if (op.activation?.everyNTurns) {
			return t('operationProfiles.runTrace.skip.activationTurns', {
				current: op.activation.turnsCounter,
				target: op.activation.everyNTurns,
			});
		}
		if (op.activation?.everyNContextTokens) {
			return t('operationProfiles.runTrace.skip.activationTokens', {
				current: op.activation.tokensCounter,
				target: op.activation.everyNContextTokens,
			});
		}
		return t('operationProfiles.runTrace.skip.activation');
	}
	if (op.skipReason === 'guard_not_matched') {
		if (!op.guard) return t('operationProfiles.runTrace.skip.guardUnknown');
		return t('operationProfiles.runTrace.skip.guard', {
			name: resolveOpName(trace, op.guard.sourceOpId),
			key: op.guard.outputKey,
			actual:
				op.guard.actual === null
					? '—'
					: op.guard.actual
						? t('operationProfiles.runTrace.actualYes')
						: t('operationProfiles.runTrace.actualNo'),
		});
	}
	if (op.skipReason === 'dependency_not_done' || op.skipReason === 'dependency_missing') {
		const names = op.blockedByOpIds.map((opId) => resolveOpName(trace, opId));
		return names.length > 0
			? t('operationProfiles.runTrace.skip.dependency', { names: names.join(', ') })
			: t('operationProfiles.runTrace.opStatus.skipped');
	}
	const known = ['disabled', 'unsupported_kind', 'orchestrator_aborted', 'filtered_out'];
	if (op.skipReason && known.includes(op.skipReason)) {
		return t(`operationProfiles.runTrace.skip.${op.skipReason}`);
	}
	return t('operationProfiles.runTrace.opStatus.skipped');
}

export function describeOperationSummary(t: TranslateFn, trace: RunTrace, op: TraceOperation): string {
	if (op.status === 'running') return t('operationProfiles.runTrace.opStatus.running');
	if (op.status === 'done') return describeDoneSummary(t, op);
	if (op.status === 'skipped') return describeSkipSummary(t, trace, op);
	if (op.status === 'aborted') return t('operationProfiles.runTrace.opStatus.aborted');
	return op.errorMessage ?? t('operationProfiles.runTrace.opStatus.error');
}

export function runStatusColor(status: RunTrace['status']): string {
	if (status === 'done') return 'teal';
	if (status === 'running') return 'blue';
	if (status === 'aborted') return 'yellow';
	return 'red';
}
