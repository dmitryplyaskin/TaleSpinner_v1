import { Checkbox, Group, type CheckboxProps } from '@mantine/core';
import { useController, type UseControllerProps, useFormContext } from 'react-hook-form';

import { InfoTip } from '@ui/info-tip';

type FormCheckboxProps = {
	name: string;
	label: string;
	checkboxProps?: Omit<CheckboxProps, 'checked' | 'onChange' | 'label' | 'error'>;
	containerProps?: UseControllerProps;
	infoTip?: React.ReactNode;
};

export const FormCheckbox: React.FC<FormCheckboxProps> = ({
	name,
	label,
	checkboxProps,
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
	const labelComponent = label && (
		<Group gap={6} wrap="nowrap">
			{label}
			{infoTip && <InfoTip content={infoTip} />}
		</Group>
	);

	return (
		<Checkbox
			{...checkboxProps}
			{...field}
			checked={Boolean(value)}
			label={labelComponent}
			error={errorMessage || undefined}
			onChange={(e) => onChange(e.currentTarget.checked)}
		/>
	);
};
