import { Input, InputProps } from '@chakra-ui/react';
import { Field, FieldProps } from '../chakra-core-ui/field';
import { useController, UseControllerProps, useFormContext } from 'react-hook-form';

type FormInputProps = {
	name: string;
	label: string;
	placeholder?: string;
	inputProps?: InputProps;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
};

export const FormInput: React.FC<FormInputProps> = ({
	name,
	label,
	placeholder,
	inputProps,
	fieldProps,
	containerProps,
}) => {
	const { control } = useFormContext();
	const {
		field,
		formState: { errors },
	} = useController({
		name,
		control: control,
		...containerProps,
	});

	const errorMessage = <>{errors[name]?.message || ''}</>;

	return (
		<Field {...fieldProps} label={label} invalid={!!errors[name]} errorText={errorMessage}>
			<Input {...inputProps} {...field} placeholder={placeholder} />
		</Field>
	);
};
