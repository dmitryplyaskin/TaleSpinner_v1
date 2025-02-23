import { useController, UseControllerProps, useFormContext } from 'react-hook-form';
import { Field, FieldProps } from '../chakra-core-ui/field';
import { Checkbox, CheckboxProps } from '../chakra-core-ui/checkbox';
import { InfoTip } from '@ui/chakra-core-ui/toggle-tip';
import { Box } from '@chakra-ui/react';

type FormCheckboxProps = {
	name: string;
	label: string;
	checkboxProps?: Omit<CheckboxProps, 'checked'>;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
	infoTip?: React.ReactNode;
};

export const FormCheckbox: React.FC<FormCheckboxProps> = ({
	name,
	label,
	checkboxProps,
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
	const labelComponent = label && (
		<Box display="flex" alignItems="center" gap="2">
			{label}
			{infoTip && <InfoTip content={infoTip} />}
		</Box>
	);

	return (
		<Field {...fieldProps} invalid={!!errors[name]} errorText={errorMessage}>
			<Checkbox {...checkboxProps} {...field} checked={value} onCheckedChange={({ checked }) => onChange(checked)}>
				{labelComponent}
			</Checkbox>
		</Field>
	);
};
