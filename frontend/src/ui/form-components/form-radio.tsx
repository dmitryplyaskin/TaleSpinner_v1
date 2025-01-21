import { useController, UseControllerProps, useFormContext } from 'react-hook-form';
import { Field, FieldProps } from '../chakra-core-ui/field';
import { Radio, RadioGroup, RadioProps } from '../chakra-core-ui/radio';

type FormRadioProps = {
	name: string;
	label: string;
	options: Array<{ value: string; label: string }>;
	radioProps?: Omit<RadioProps, 'value'>;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
};

export const FormRadio: React.FC<FormRadioProps> = ({
	name,
	label,
	options,
	radioProps,
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
		<Field {...fieldProps} label={label} invalid={!!errors[name]} errorText={errorMessage}>
			<RadioGroup value={value} onChange={onChange}>
				{options.map((option) => (
					<Radio key={option.value} value={option.value} {...radioProps}>
						{option.label}
					</Radio>
				))}
			</RadioGroup>
		</Field>
	);
};
