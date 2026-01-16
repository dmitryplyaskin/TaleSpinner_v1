import { Select, Props } from 'chakra-react-select';
import { useController, UseControllerProps, useFormContext } from 'react-hook-form';
import { Field, FieldProps } from '../chakra-core-ui/field';
import { InfoTip } from '@ui/chakra-core-ui/toggle-tip';
import { Box } from '@chakra-ui/react';

type FormSelectProps = {
	name: string;
	label: string;
	selectProps?: Props<any, any, any>;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
	infoTip?: React.ReactNode;
};

export const FormSelect: React.FC<FormSelectProps> = ({
	name,
	label,
	selectProps,
	fieldProps,
	containerProps,
	infoTip,
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
	const labelComponent = (
		<Box display="flex" alignItems="center" gap="2">
			{label}
			{infoTip && <InfoTip content={infoTip} />}
		</Box>
	);

	return (
		<Field {...fieldProps} label={labelComponent} invalid={!!errors[name]} errorText={errorMessage}>
			<Select
				value={selectProps?.options?.find((option) => option.value === value)}
				onChange={(selected) => onChange(selected?.value)}
				// classNamePrefix="crs"
				{...selectProps}
			/>
		</Field>
	);
};
