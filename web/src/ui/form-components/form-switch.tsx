import { Box } from '@chakra-ui/react';
import { useController, type UseControllerProps, useFormContext } from 'react-hook-form';

import { InfoTip } from '@ui/chakra-core-ui/toggle-tip';

import { Field, type FieldProps } from '../chakra-core-ui/field';
import { Switch, type SwitchProps } from '../chakra-core-ui/switch';

type FormSwitchProps = {
	name: string;
	label: string;
	switchProps?: Omit<SwitchProps, 'checked'>;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
	infoTip?: React.ReactNode;
};

export const FormSwitch: React.FC<FormSwitchProps> = ({
	name,
	label,
	switchProps,
	fieldProps,
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

	const errorMessage = <>{errors[name]?.message || ''}</>;
	const labelComponent = (
		<Box display="flex" alignItems="center" gap="2">
			{label}
			{infoTip && <InfoTip content={infoTip} />}
		</Box>
	);

	return (
		<Field {...fieldProps} label={labelComponent} invalid={!!errors[name]} errorText={errorMessage}>
			<Switch {...switchProps} {...field} checked={value} onCheckedChange={({ checked }) => onChange(checked)}>
				{label}
			</Switch>
		</Field>
	);
};
