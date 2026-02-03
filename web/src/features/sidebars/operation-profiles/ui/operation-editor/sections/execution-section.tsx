import { Group, Stack, Text } from '@mantine/core';
import React from 'react';
import { useWatch } from 'react-hook-form';

import { FormMultiSelect, FormNumberInput, FormSelect } from '@ui/form-components';

import { useOperationDepsOptions } from '../use-operation-deps-options';

const hookOptions = [
	{ value: 'before_main_llm', label: 'before_main_llm' },
	{ value: 'after_main_llm', label: 'after_main_llm' },
];

const triggerOptions = [
	{ value: 'generate', label: 'generate' },
	{ value: 'regenerate', label: 'regenerate' },
];

const DependsOnInfoTip =
	'Operation will not start until all dependsOn operations finish with status "done". If a dependency finishes as error/aborted/skipped, this operation cannot start.';

const OrderInfoTip =
	'Commit order: first dependencies, then smaller order first; tie-breaker is operationId. Even with concurrent execute, commit stays deterministic.';

type Props = {
	index: number;
};

export const ExecutionSection: React.FC<Props> = ({ index }) => {
	const depOptions = useOperationDepsOptions();
	const selfOpId = useWatch({ name: `operations.${index}.opId` }) as unknown;
	const selfId = typeof selfOpId === 'string' ? selfOpId : '';

	return (
		<Stack gap="xs">
			<Text fw={600}>Execution</Text>

			<Group grow wrap="wrap">
				<FormSelect
					name={`operations.${index}.config.hooks.0`}
					label="Hook"
					infoTip="before_main_llm runs before main LLM; after_main_llm runs after."
					selectProps={{
						options: hookOptions,
						comboboxProps: { withinPortal: false },
					}}
				/>
				<FormMultiSelect
					name={`operations.${index}.config.triggers`}
					label="Triggers"
					infoTip="generate — new turn; regenerate — new assistant variant for the current turn."
					multiSelectProps={{
						options: triggerOptions,
						comboboxProps: { withinPortal: false },
					}}
				/>
			</Group>

			<Group grow wrap="wrap">
				<FormNumberInput
					name={`operations.${index}.config.order`}
					label="Order"
					infoTip={OrderInfoTip}
					numberInputProps={{ min: 0 }}
				/>
				<FormMultiSelect
					name={`operations.${index}.config.dependsOn`}
					label="Depends on (dependsOn)"
					infoTip={DependsOnInfoTip}
					multiSelectProps={{
						options: depOptions.filter((o) => o.value !== selfId),
						comboboxProps: { withinPortal: false },
						placeholder: 'None',
						searchable: true,
					}}
				/>
			</Group>
		</Stack>
	);
};

