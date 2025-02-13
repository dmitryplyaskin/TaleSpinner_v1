import { Textarea, TextareaProps } from '@chakra-ui/react';
import { Field, FieldProps } from '../chakra-core-ui/field';
import { useController, UseControllerProps, useFormContext } from 'react-hook-form';
import { IconButtonWithTooltip } from '../icon-button-with-tooltip';
import { LuExpand } from 'react-icons/lu';
import { Box } from '@chakra-ui/react';
import { useState } from 'react';
import { TextareaFullscreenDialog } from './components/textarea-fullscreen-dialog';

type FormTextareaProps = {
	name: string;
	label: string;
	placeholder?: string;
	textareaProps?: TextareaProps;
	fieldProps?: FieldProps;
	containerProps?: UseControllerProps;
};

export const FormTextarea: React.FC<FormTextareaProps> = ({
	name,
	label,
	placeholder,
	textareaProps,
	fieldProps,
	containerProps,
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

	const errorMessage = errors[name]?.message || '';
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
		</Box>
	);

	return (
		<>
			<Field {...fieldProps} label={labelComponent} invalid={!!errors[name]} errorText={errorMessage}>
				<Textarea {...textareaProps} {...field} placeholder={placeholder} />
			</Field>

			<TextareaFullscreenDialog
				isOpen={isFullscreenOpen}
				onModalChange={setIsFullscreenOpen}
				value={field.value}
				onChange={field.onChange}
				textareaProps={textareaProps}
			/>
		</>
	);
};
