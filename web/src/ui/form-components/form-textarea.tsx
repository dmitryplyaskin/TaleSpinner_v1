import { Group, Input, Textarea, type InputWrapperProps, type TextareaProps } from '@mantine/core';
import { useState } from 'react';
import { useController, type UseControllerProps, useFormContext } from 'react-hook-form';
import { LuExpand } from 'react-icons/lu';

import { InfoTip } from '@ui/info-tip';

import { IconButtonWithTooltip } from '../icon-button-with-tooltip';

import { TextareaFullscreenDialog } from './components/textarea-fullscreen-dialog';

type FormTextareaProps = {
	name: string;
	label: string;
	placeholder?: string;
	textareaProps?: TextareaProps;
	fieldProps?: Omit<InputWrapperProps, 'children'>;
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
		<Group gap={6} wrap="nowrap">
			{label}
			<IconButtonWithTooltip
				aria-label="Открыть в полном экране"
				icon={<LuExpand />}
				size="sm"
				variant="outline"
				tooltip="Открыть в полном экране"
				onClick={() => setIsFullscreenOpen(true)}
			/>
			{infoTip && <InfoTip content={infoTip} />}
		</Group>
	);

	return (
		<>
			<Input.Wrapper {...fieldProps} label={labelComponent} error={errorMessage || undefined}>
				<Textarea {...textareaProps} {...field} value={field.value ?? ''} placeholder={placeholder} />
			</Input.Wrapper>

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
