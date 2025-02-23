import { useController, UseControllerProps, useFormContext } from 'react-hook-form';
import { Field, FieldProps } from '../chakra-core-ui/field';
import { Radio, RadioGroup, RadioProps } from '../chakra-core-ui/radio';
import { Box } from '@chakra-ui/react';
import { InfoTip } from '@ui/chakra-core-ui/toggle-tip';

type FormRadioProps = {
	name: string;
	label: string;
	options: Array<{ value: string; label: string }>;
	radioProps?: Omit<RadioProps, 'value'>;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
	infoTip?: React.ReactNode;
};

export const FormRadio: React.FC<FormRadioProps> = ({
	name,
	label,
	options,
	radioProps,
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
