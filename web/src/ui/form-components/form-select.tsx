import { Box } from '@chakra-ui/react';
import { Select, type Props } from 'chakra-react-select';
import { useController, type UseControllerProps, useFormContext } from 'react-hook-form';

import { InfoTip } from '@ui/chakra-core-ui/toggle-tip';

import { Field, type FieldProps } from '../chakra-core-ui/field';

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
