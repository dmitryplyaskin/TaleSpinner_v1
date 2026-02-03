import { Group, Input, MultiSelect, type InputWrapperProps, type MultiSelectProps } from '@mantine/core';
import { useController, type UseControllerProps, useFormContext } from 'react-hook-form';

import { InfoTip } from '@ui/info-tip';

type SelectOption = { value: string; label: string };

type FormMultiSelectInnerProps = Omit<MultiSelectProps, 'data' | 'value' | 'onChange' | 'label' | 'error'> & {
	options?: SelectOption[];
};

type FormMultiSelectProps = {
	name: string;
	label: string;
	multiSelectProps?: FormMultiSelectInnerProps;
	fieldProps?: Omit<InputWrapperProps, 'children'>;
	containerProps?: UseControllerProps;
	infoTip?: React.ReactNode;
};

export const FormMultiSelect: React.FC<FormMultiSelectProps> = ({
	name,
	label,
	multiSelectProps,
	fieldProps,
	containerProps,
	infoTip,
}) => {
	const { control } = useFormContext();
	const {
		field: { value, onChange, ...field },
		fieldState,
	} = useController({
		name,
		control: control,
		...containerProps,
	});

	const errorMessage = typeof fieldState.error?.message === 'string' ? fieldState.error.message : '';
	const labelComponent = (
		<Group gap={6} wrap="nowrap">
			{label}
			{infoTip && <InfoTip content={infoTip} />}
		</Group>
	);

	const { options = [], ...mantineProps } = multiSelectProps ?? {};
	const safeOptions = options.filter((o): o is SelectOption => typeof o?.value === 'string' && o.value.length > 0);
	const safeValue = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

	return (
		<Input.Wrapper {...fieldProps} label={labelComponent} error={errorMessage || undefined}>
			<MultiSelect
				{...mantineProps}
				{...field}
				data={safeOptions}
				value={safeValue}
				onChange={(next) => onChange(next)}
			/>
		</Input.Wrapper>
	);
};

