import { Textarea, TextareaProps } from '@chakra-ui/react';
import { Field, FieldProps } from '../chakra-core-ui/field';
import { useController, UseControllerProps, useFormContext } from 'react-hook-form';

type FormTextareaProps = {
	name: string;
	label: string;
	placeholder?: string;
	textareaProps?: TextareaProps;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
};

export const FormTextarea: React.FC<FormTextareaProps> = ({
	name,
	label,
	placeholder,
	textareaProps,
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
			<Textarea {...textareaProps} {...field} placeholder={placeholder} />
		</Field>
	);
};
