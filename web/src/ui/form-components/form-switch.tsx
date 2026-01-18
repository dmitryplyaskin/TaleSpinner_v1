import { Group, Switch, type SwitchProps } from '@mantine/core';
import { useController, type UseControllerProps, useFormContext } from 'react-hook-form';

import { InfoTip } from '@ui/info-tip';

type FormSwitchProps = {
	name: string;
	label: string;
	switchProps?: Omit<SwitchProps, 'checked' | 'onChange' | 'label' | 'error'>;
	containerProps?: UseControllerProps;
	infoTip?: React.ReactNode;
};

export const FormSwitch: React.FC<FormSwitchProps> = ({
	name,
	label,
	switchProps,
	containerProps,
	infoTip,
}) => {
	const { control } = useFormContext();
	const {
		field: { value, onChange, ...field },
		formState: { errors },
	} = useController({
		name,
		control: control,
		...containerProps,
	});

	const errorMessage = typeof errors[name]?.message === 'string' ? errors[name]?.message : '';
	const labelComponent = (
		<Group gap={6} wrap="nowrap">
			{label}
			{infoTip && <InfoTip content={infoTip} />}
		</Group>
	);

	return (
		<Switch
			{...switchProps}
			{...field}
			checked={Boolean(value)}
			label={labelComponent}
			error={errorMessage || undefined}
			onChange={(e) => onChange(e.currentTarget.checked)}
		/>
	);
};
