import { Field, FieldProps } from '../chakra-core-ui/field';
import { useController, UseControllerProps, useFormContext } from 'react-hook-form';
import { CustomAutocomplete, CustomAutocompleteProps } from '../custom-autocomplete';

type FormAutocompleteProps = Omit<CustomAutocompleteProps, 'value' | 'onChange' | 'defaultValue'> & {
	name: string;
	label: string;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
};

export const FormAutocomplete: React.FC<FormAutocompleteProps> = ({
	name,
	label,
	fieldProps,
	containerProps,
	...autocompleteProps
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
			<CustomAutocomplete
				{...autocompleteProps}
				value={field.value || []}
				onChange={(value) => {
					field.onChange(value);
				}}
			/>
		</Field>
	);
};
