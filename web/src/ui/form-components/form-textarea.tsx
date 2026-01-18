import { Textarea, type TextareaProps, Box } from '@chakra-ui/react';
import { useState } from 'react';
import { useController, type UseControllerProps, useFormContext } from 'react-hook-form';
import { LuExpand } from 'react-icons/lu';

import { InfoTip } from '@ui/chakra-core-ui/toggle-tip';

import { Field, type FieldProps } from '../chakra-core-ui/field';
import { IconButtonWithTooltip } from '../icon-button-with-tooltip';

import { TextareaFullscreenDialog } from './components/textarea-fullscreen-dialog';

type FormTextareaProps = {
	name: string;
	label: string;
	placeholder?: string;
	textareaProps?: TextareaProps;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
	infoTip?: React.ReactNode;
};

export const FormTextarea: React.FC<FormTextareaProps> = ({
	name,
	label,
	placeholder,
	textareaProps,
	fieldProps,
	containerProps,
	infoTip,
}) => {
	const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
	const { control } = useFormContext();
	const {
		field,
		formState: { errors },
	} = useController({
		name,
		control: control,
		...containerProps,
	});

	const errorMessage = typeof errors[name]?.message === 'string' ? errors[name]?.message : '';
	const labelComponent = (
		<Box display="flex" alignItems="center" gap="2">
			{label}
			<IconButtonWithTooltip
				aria-label="Открыть в полном экране"
				icon={<LuExpand />}
				size="xs"
				variant="outline"
				tooltip="Открыть в полном экране"
				onClick={() => setIsFullscreenOpen(true)}
			/>
			{infoTip && <InfoTip content={infoTip} />}
		</Box>
	);

	return (
		<>
			<Field {...fieldProps} label={labelComponent} invalid={!!errors[name]} errorText={errorMessage}>
				<Textarea {...textareaProps} {...field} placeholder={placeholder} />
			</Field>

			<TextareaFullscreenDialog
				open={isFullscreenOpen}
				onOpenChange={setIsFullscreenOpen}
				value={field.value}
				onChange={field.onChange}
				textareaProps={textareaProps}
			/>
		</>
	);
};
