import { Select, Props } from 'chakra-react-select';
import { useController, UseControllerProps, useFormContext } from 'react-hook-form';
import { Field, FieldProps } from '../chakra-core-ui/field';

type FormSelectProps = {
	name: string;
	label: string;
	selectProps?: Props<any, any, any>;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
};

export const FormSelect: React.FC<FormSelectProps> = ({ name, label, selectProps, fieldProps, containerProps }) => {
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
			<Select
				value={selectProps?.options?.find((option) => option.value === value)}
				onChange={(selected) => onChange(selected?.value)}
				// classNamePrefix="crs"
				{...selectProps}
			/>
		</Field>
	);
};
