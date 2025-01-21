import { useController, UseControllerProps, useFormContext } from 'react-hook-form';
import { Field, FieldProps } from '../chakra-core-ui/field';
import { Switch, SwitchProps } from '../chakra-core-ui/switch';

type FormSwitchProps = {
	name: string;
	label: string;
	switchProps?: Omit<SwitchProps, 'checked'>;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
};

export const FormSwitch: React.FC<FormSwitchProps> = ({ name, label, switchProps, fieldProps, containerProps }) => {
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
		<Field {...fieldProps} label={label} invalid={!!errors[name]} errorText={errorMessage}>
			<Switch {...switchProps} {...field} checked={value} onCheckedChange={({ checked }) => onChange(checked)}>
				{label}
			</Switch>
		</Field>
	);
};
