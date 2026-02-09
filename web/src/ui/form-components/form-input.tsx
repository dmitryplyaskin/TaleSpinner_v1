import { Group, Input, TextInput, type InputWrapperProps, type TextInputProps } from '@mantine/core';
import { useController, type UseControllerProps, useFormContext } from 'react-hook-form';

import { InfoTip } from '@ui/info-tip';

type FormInputProps = {
	name: string;
	label: string;
	placeholder?: string;
	inputProps?: Omit<TextInputProps, 'value' | 'defaultValue'>;
	fieldProps?: Omit<InputWrapperProps, 'children'>;
	containerProps?: UseControllerProps;
	infoTip?: React.ReactNode;
};

export const FormInput: React.FC<FormInputProps> = ({
	name,
	label,
	placeholder,
	inputProps,
	fieldProps,
	containerProps,
	infoTip,
}) => {
	const { control } = useFormContext();
	const {
		field,
		fieldState,
	} = useController({
		name,
		control: control,
		...containerProps,
	});

	const errorMessage = typeof fieldState.error?.message === 'string' ? fieldState.error.message : '';

	const labelComponent = (
		<Group gap={6} wrap="nowrap" align="center" style={{ marginBottom: 2 }}>
			{label}
			{infoTip && <InfoTip content={infoTip} />}
		</Group>
	);

	return (
		<Input.Wrapper {...fieldProps} label={labelComponent} error={errorMessage || undefined}>
			<TextInput {...inputProps} {...field} value={field.value ?? ''} placeholder={placeholder} />
		</Input.Wrapper>
	);
};
