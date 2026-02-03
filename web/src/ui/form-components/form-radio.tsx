import { Group, Radio, type RadioGroupProps } from '@mantine/core';
import { useController, type UseControllerProps, useFormContext } from 'react-hook-form';

import { InfoTip } from '@ui/info-tip';

type FormRadioProps = {
	name: string;
	label: string;
	options: Array<{ value: string; label: string }>;
	radioProps?: Omit<RadioGroupProps, 'value' | 'onChange' | 'label' | 'error' | 'children'>;
	containerProps?: UseControllerProps;
	infoTip?: React.ReactNode;
};

export const FormRadio: React.FC<FormRadioProps> = ({
	name,
	label,
	options,
	radioProps,
	containerProps,
	infoTip,
}) => {
	const { control } = useFormContext();
	const {
		field: { value, onChange },
		fieldState,
	} = useController({
		name,
		control: control,
		...containerProps,
	});

	const errorMessage = typeof fieldState.error?.message === 'string' ? fieldState.error.message : '';
	const labelComponent = (
		<Group gap={6} wrap="nowrap">
			{label}
			{infoTip && <InfoTip content={infoTip} />}
		</Group>
	);

	return (
		<Radio.Group
			{...radioProps}
			label={labelComponent}
			value={value ?? ''}
			error={errorMessage || undefined}
			onChange={onChange}
		>
			<Group mt={6} gap="md">
				{options.map((option) => (
					<Radio key={option.value} value={option.value} label={option.label} />
				))}
			</Group>
		</Radio.Group>
	);
};
