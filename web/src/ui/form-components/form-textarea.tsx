import { Group, Input, Textarea, type InputWrapperProps, type TextareaProps } from '@mantine/core';
import { useState } from 'react';
import { useController, type UseControllerProps, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
	const { t } = useTranslation();
	const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
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
		<Group gap={6} wrap="nowrap">
			{label}
			<IconButtonWithTooltip
				aria-label={t('dialogs.textarea.openFullscreen')}
				icon={<LuExpand />}
				size="sm"
				variant="outline"
				tooltip={t('dialogs.textarea.openFullscreen')}
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
