import { Badge, Collapse, Group, Loader, Paper, Stack, Text, UnstyledButton } from '@mantine/core';
import { useUnit } from 'effector-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronRight, LuCircleCheck, LuCircleMinus, LuCircleX } from 'react-icons/lu';

import { $lastRunTrace } from '@model/operation-run-trace';

import { describeDestination, describeOperationSummary, runStatusColor } from './run-trace-summary';

import type { RunTrace, TraceOperation } from '@model/operation-run-trace';

const HOOK_ORDER = ['before_main_llm', 'after_main_llm'];

const StatusIcon: React.FC<{ status: TraceOperation['status'] }> = ({ status }) => {
	if (status === 'running') return <Loader size={14} />;
	if (status === 'done') return <LuCircleCheck size={15} color="var(--mantine-color-teal-6)" />;
	if (status === 'skipped') return <LuCircleMinus size={15} color="var(--mantine-color-yellow-7)" />;
	return <LuCircleX size={15} color="var(--mantine-color-red-6)" />;
};

const OperationRow: React.FC<{ trace: RunTrace; op: TraceOperation }> = ({ trace, op }) => {
	const { t } = useTranslation();
	const [opened, setOpened] = React.useState(false);
	const summary = describeOperationSummary(t, trace, op);
	const hasCommitIssue = op.commits.some((commit) => commit.status === 'error');
	const hasDetails = op.effects.length > 0 || op.commits.length > 0 || Boolean(op.errorMessage);

	return (
		<Paper withBorder p="xs">
			<UnstyledButton
				onClick={() => hasDetails && setOpened((prev) => !prev)}
				style={{ width: '100%', cursor: hasDetails ? 'pointer' : 'default' }}
				aria-expanded={opened}
			>
				<Group gap="xs" wrap="nowrap" align="flex-start">
					<span style={{ marginTop: 2, flexShrink: 0 }}>
						<StatusIcon status={op.status} />
					</span>
					<Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
						<Group gap={6} wrap="nowrap">
							<Text size="sm" fw={500} truncate>
								{op.name}
							</Text>
							{hasCommitIssue && (
								<Badge size="xs" color="red" variant="light">
									{t('operationProfiles.runTrace.details.commitError')}
								</Badge>
							)}
						</Group>
						<Text size="xs" c="dimmed" style={{ wordBreak: 'break-word' }}>
							{summary}
						</Text>
					</Stack>
					{hasDetails && (
						<span style={{ marginTop: 2, flexShrink: 0, color: 'var(--mantine-color-dimmed)' }}>
							{opened ? <LuChevronDown size={14} /> : <LuChevronRight size={14} />}
						</span>
					)}
				</Group>
			</UnstyledButton>

			<Collapse in={opened}>
				<Stack gap="xs" mt="xs" pl={23}>
					{op.errorMessage && (
						<Text size="xs" c="red">
							{op.errorMessage}
						</Text>
					)}
					{op.effects.map((effect, index) => (
						<Stack key={index} gap={2}>
							<Group gap={6}>
								<Badge size="xs" variant="light">
									{describeDestination(t, effect)}
								</Badge>
								<Text size="xs" c="dimmed">
									{t('operationProfiles.runTrace.chars', { count: effect.valueChars })}
								</Text>
							</Group>
							<Text
								size="xs"
								c="dimmed"
								style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--mantine-font-family-monospace)' }}
							>
								{effect.valuePreview || t('operationProfiles.runTrace.details.valueEmpty')}
							</Text>
						</Stack>
					))}
					{op.commits.some((commit) => commit.status !== 'applied') && (
						<Stack gap={2}>
							{op.commits
								.filter((commit) => commit.status !== 'applied')
								.map((commit, index) => (
									<Text key={index} size="xs" c={commit.status === 'error' ? 'red' : 'dimmed'}>
										{commit.effectType}: {t(`operationProfiles.runTrace.details.commitStatus.${commit.status}`)}
										{commit.message ? ` — ${commit.message}` : ''}
									</Text>
								))}
						</Stack>
					)}
				</Stack>
			</Collapse>
		</Paper>
	);
};

export const RunTracePanel: React.FC = () => {
	const { t } = useTranslation();
	const trace = useUnit($lastRunTrace);

	if (!trace) {
		return (
			<Text size="sm" c="dimmed">
				{t('operationProfiles.runTrace.empty')}
			</Text>
		);
	}

	const durationSeconds = trace.finishedAtTs ? Math.max(0, (trace.finishedAtTs - trace.startedAtTs) / 1000) : null;
	const hooksInOrder = [
		...HOOK_ORDER.filter((hook) => trace.operations.some((op) => op.hook === hook)),
		...Array.from(new Set(trace.operations.map((op) => op.hook))).filter((hook) => !HOOK_ORDER.includes(hook)),
	];

	return (
		<Stack gap="sm">
			<Group gap="xs" wrap="wrap">
				<Badge color={runStatusColor(trace.status)} variant="light">
					{t(`operationProfiles.runTrace.runStatus.${trace.status}`)}
				</Badge>
				{trace.trigger && (
					<Text size="xs" c="dimmed">
						{t(`operationProfiles.runTrace.trigger.${trace.trigger}`, trace.trigger)}
					</Text>
				)}
				{durationSeconds !== null && (
					<Text size="xs" c="dimmed">
						{t('operationProfiles.runTrace.duration', { seconds: durationSeconds.toFixed(1) })}
					</Text>
				)}
				{trace.mainLlm?.model && (
					<Text size="xs" c="dimmed" truncate style={{ maxWidth: 220 }}>
						{trace.mainLlm.model}
					</Text>
				)}
			</Group>

			{trace.errorMessage && (
				<Text size="sm" c="red">
					{trace.errorMessage}
				</Text>
			)}

			{trace.operations.length === 0 && (
				<Text size="sm" c="dimmed">
					{t('operationProfiles.runTrace.noOperations')}
				</Text>
			)}

			{hooksInOrder.map((hook) => (
				<Stack key={hook} gap="xs">
					<Text size="xs" fw={500} c="dimmed" tt="uppercase">
						{t(`operationProfiles.runTrace.hook.${hook}`, hook)}
					</Text>
					{trace.operations
						.filter((op) => op.hook === hook)
						.map((op) => (
							<OperationRow key={op.key} trace={trace} op={op} />
						))}
				</Stack>
			))}
		</Stack>
	);
};
