import { useController, UseControllerProps, useFormContext } from 'react-hook-form';
import { Field, FieldProps } from '../chakra-core-ui/field';
import { Autocomplete, AutocompleteProps } from '../chakra-core-ui/autocomplete';

type FormAutocompleteProps = Omit<AutocompleteProps, 'value' | 'onChange'> & {
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
		field: { value, onChange },
		formState: { errors },
	} = useController({
		name,
		control: control,
		...containerProps,
	});

	const errorMessage = <>{errors[name]?.message || ''}</>;

	return (
		<Field {...fieldProps} label={label} invalid={!!errors[name]} errorText={errorMessage}>
			<Autocomplete {...autocompleteProps} value={value} onChange={onChange} />
		</Field>
	);
};
