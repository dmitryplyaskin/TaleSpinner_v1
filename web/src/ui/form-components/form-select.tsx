import { Group, Input, Select, type InputWrapperProps, type SelectProps } from '@mantine/core';
import { useController, type UseControllerProps, useFormContext } from 'react-hook-form';

import { InfoTip } from '@ui/info-tip';

type SelectOption = { value: string; label: string };

type FormSelectInnerProps = Omit<SelectProps, 'data' | 'value' | 'onChange' | 'label' | 'error'> & {
	/**
	 * Legacy-совместимость с прежним API селекта (options + portal-настройки).
	 * Эти поля мы используем как источник данных, а не прокидываем напрямую в Mantine Select.
	 */
	options?: SelectOption[];
	/** Legacy no-op: оставлено, чтобы не ломать текущие вызовы. */
	menuPortalTarget?: HTMLElement | null;
	/** Legacy no-op: оставлено, чтобы не ломать текущие вызовы. */
	menuPlacement?: string;
};

type FormSelectProps = {
	name: string;
	label: string;
	selectProps?: FormSelectInnerProps;
	fieldProps?: Omit<InputWrapperProps, 'children'>;
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

	const errorMessage = typeof errors[name]?.message === 'string' ? errors[name]?.message : '';
	const labelComponent = (
		<Group gap={6} wrap="nowrap">
			{label}
			{infoTip && <InfoTip content={infoTip} />}
		</Group>
	);

	const { options = [], menuPortalTarget: _menuPortalTarget, menuPlacement: _menuPlacement, ...mantineSelectProps } =
		selectProps ?? {};
	const safeOptions = options.filter((o): o is SelectOption => typeof o?.value === 'string' && o.value.length > 0);

	return (
		<Input.Wrapper {...fieldProps} label={labelComponent} error={errorMessage || undefined}>
			<Select
				{...mantineSelectProps}
				data={safeOptions}
				value={value ?? null}
				onChange={(nextValue) => onChange(nextValue ?? '')}
			/>
		</Input.Wrapper>
	);
};
