import { useController, UseControllerProps, useFormContext } from 'react-hook-form';
import { Field, FieldProps } from '../chakra-core-ui/field';
import { Checkbox, CheckboxProps } from '../chakra-core-ui/checkbox';

type FormCheckboxProps = {
	name: string;
	label: string;
	checkboxProps?: Omit<CheckboxProps, 'checked'>;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
};

export const FormCheckbox: React.FC<FormCheckboxProps> = ({
	name,
	label,
	checkboxProps,
	fieldProps,
	containerProps,
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

	return (
		<Field {...fieldProps} invalid={!!errors[name]} errorText={errorMessage}>
			<Checkbox {...checkboxProps} {...field} checked={value} onCheckedChange={({ checked }) => onChange(checked)}>
				{label}
			</Checkbox>
		</Field>
	);
};
