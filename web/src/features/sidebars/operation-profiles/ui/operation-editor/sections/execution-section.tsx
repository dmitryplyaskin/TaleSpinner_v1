import { Group, Stack } from '@mantine/core';
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
	'Operation waits for all dependencies to finish as "done". Any failed or skipped dependency blocks start.';

const OrderInfoTip =
	'Commit ordering is deterministic: dependencies first, then lower order, then operation id tie-break.';

type Props = {
	index: number;
};

export const ExecutionSection: React.FC<Props> = ({ index }) => {
	const depOptions = useOperationDepsOptions();
	const selfOpId = useWatch({ name: `operations.${index}.opId` }) as unknown;
	const selfId = typeof selfOpId === 'string' ? selfOpId : '';

	return (
		<Stack gap="xs">
			<Group grow wrap="wrap">
				<FormSelect
					name={`operations.${index}.config.hooks.0`}
					label="Hook"
					infoTip="Choose whether the operation runs before or after the main LLM call."
					selectProps={{
						options: hookOptions,
						comboboxProps: { withinPortal: false },
					}}
				/>
				<FormMultiSelect
					name={`operations.${index}.config.triggers`}
					label="Triggers"
					infoTip="generate starts on a new turn; regenerate starts for a new assistant variant."
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
					label="Depends on"
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

