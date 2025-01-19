'use client';

import type { CollectionItem } from '@chakra-ui/react';
import { Select as ChakraSelect, Portal } from '@chakra-ui/react';
import { CloseButton } from './close-button';
import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { LuChevronDown } from 'react-icons/lu';

interface SelectTriggerProps extends ChakraSelect.ControlProps {
	clearable?: boolean;
	isOpen: boolean;
	onOpen: () => void;
}

const CustomSelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(function SelectTrigger(props, ref) {
	const { children, clearable, isOpen, onOpen, ...rest } = props;
	return (
		<ChakraSelect.Control {...rest}>
			<ChakraSelect.Trigger ref={ref} onClick={onOpen}>
				{children}
			</ChakraSelect.Trigger>
			<ChakraSelect.IndicatorGroup>
				{clearable && isOpen && <SelectClearTrigger />}
				<ChakraSelect.Indicator>
					<LuChevronDown />
				</ChakraSelect.Indicator>
			</ChakraSelect.IndicatorGroup>
		</ChakraSelect.Control>
	);
});

const SelectClearTrigger = React.forwardRef<HTMLButtonElement, ChakraSelect.ClearTriggerProps>(
	function SelectClearTrigger(props, ref) {
		const { onClick } = props;
		return (
			<ChakraSelect.ClearTrigger
				asChild
				{...props}
				ref={ref}
				onClick={(event) => {
					onClick?.(event);
				}}
			>
				<CloseButton size="xs" variant="plain" focusVisibleRing="inside" focusRingWidth="2px" pointerEvents="auto" />
			</ChakraSelect.ClearTrigger>
		);
	},
);

interface SelectContentProps extends ChakraSelect.ContentProps {
	portalled?: boolean;
	portalRef?: React.RefObject<HTMLElement>;
}

const CustomSelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(function SelectContent(props, ref) {
	const { portalled = true, portalRef, ...rest } = props;
	return (
		<Portal disabled={!portalled} container={portalRef}>
			<ChakraSelect.Positioner>
				<ChakraSelect.Content {...rest} ref={ref} onPointerDown={(e) => e.stopPropagation()} />
			</ChakraSelect.Positioner>
		</Portal>
	);
});

const CustomSelectItem = React.forwardRef<HTMLDivElement, ChakraSelect.ItemProps>(function SelectItem(props, ref) {
	const { item, children, ...rest } = props;
	return (
		<ChakraSelect.Item key={item.value} item={item} {...rest} ref={ref}>
			{children}
			<ChakraSelect.ItemIndicator />
		</ChakraSelect.Item>
	);
});

interface SelectValueTextProps extends Omit<ChakraSelect.ValueTextProps, 'children'> {
	children?: React.ReactNode;
}

const CustomSelectValueText = React.forwardRef<HTMLSpanElement, SelectValueTextProps>(function SelectValueText(
	props,
	ref,
) {
	const { children, ...rest } = props;
	return (
		<ChakraSelect.ValueText {...rest} ref={ref}>
			<ChakraSelect.Context>
				{(select) => {
					const items = select.selectedItems;
					if (items.length === 0) return props.placeholder;
					if (children) return children;
					if (items.length === 1) return select.collection.stringifyItem(items[0]);
					return `${items.length} selected`;
				}}
			</ChakraSelect.Context>
		</ChakraSelect.ValueText>
	);
});

const CustomSelectRoot = React.forwardRef<HTMLDivElement, ChakraSelect.RootProps>(function SelectRoot(props, ref) {
	return (
		<ChakraSelect.Root {...props} ref={ref} positioning={{ sameWidth: true, ...props.positioning }}>
			{props.asChild ? (
				props.children
			) : (
				<>
					<ChakraSelect.HiddenSelect />
					{props.children}
				</>
			)}
		</ChakraSelect.Root>
	);
}) as ChakraSelect.RootComponent;

interface SelectItemGroupProps extends ChakraSelect.ItemGroupProps {
	label: React.ReactNode;
}

const CustomSelectItemGroup = React.forwardRef<HTMLDivElement, SelectItemGroupProps>(function SelectItemGroup(
	props,
	ref,
) {
	const { children, label, ...rest } = props;
	return (
		<ChakraSelect.ItemGroup {...rest} ref={ref}>
			<ChakraSelect.ItemGroupLabel>{label}</ChakraSelect.ItemGroupLabel>
			{children}
		</ChakraSelect.ItemGroup>
	);
});

const CustomSelectLabel = ChakraSelect.Label;
const CustomSelectItemText = ChakraSelect.ItemText;

// SearchInput component
const SearchInput = React.memo(({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
	<input
		type="text"
		placeholder="Поиск..."
		value={value}
		onChange={(e) => onChange(e.target.value)}
		onPointerDown={(e) => e.stopPropagation()}
		style={{
			padding: '0.5rem',
			borderBottom: '1px solid #e2e8f0',
			outline: 'none',
			width: '100%',
			background: 'var(--chakra-colors-chakra-body-bg)',
		}}
		autoFocus
	/>
));

// OptionsList component
const OptionsList = React.memo(
	({ options, onSelect }: { options: Array<{ value: string; label: string }>; onSelect: (value: string) => void }) => {
		if (options.length === 0) {
			return <div style={{ padding: '0.5rem', textAlign: 'center' }}>Нет совпадений</div>;
		}

		return (
			<>
				{options.map((option) => (
					<CustomSelectItem key={option.value} item={option} onSelect={() => onSelect(option.value)}>
						<CustomSelectItemText>{option.label}</CustomSelectItemText>
					</CustomSelectItem>
				))}
			</>
		);
	},
);

interface SelectProps<T extends { value: string; label: string }> {
	name: string;
	label?: string;
	placeholder?: string;
	options: T[];
	isClearable?: boolean;
	isDisabled?: boolean;
	isMulti?: boolean;
	rules?: any;
	[x: string]: any;
}

export const Select = <T extends { value: string; label: string }>({
	name,
	label,
	placeholder,
	options: initialOptions,
	isClearable,
	isDisabled,
	isMulti,
	rules,
	...rest
}: SelectProps<T>) => {
	const {
		control,
		formState: { errors },
		setValue,
		trigger,
	} = useFormContext();

	const [isOpen, setIsOpen] = React.useState(false);
	const [searchTerm, setSearchTerm] = React.useState('');
	const triggerRef = React.useRef<HTMLButtonElement>(null);
	const contentRef = React.useRef<HTMLDivElement>(null);

	const filteredOptions = React.useMemo(() => {
		if (!searchTerm) return initialOptions;
		const lowerSearchTerm = searchTerm.toLowerCase();
		return initialOptions.filter((option) => option.label.toLowerCase().includes(lowerSearchTerm));
	}, [searchTerm, initialOptions]);

	const handleOpen = () => {
		if (isDisabled) return;
		setIsOpen(true);
	};

	const handleClose = React.useCallback(() => {
		setIsOpen(false);
		setSearchTerm('');
	}, []);

	const handleClear = React.useCallback(
		async (onChange: (value: any) => void, event?: React.MouseEvent) => {
			event?.stopPropagation();
			const newValue = isMulti ? [] : null;
			onChange(newValue);
			setValue(name, newValue, { shouldValidate: true, shouldDirty: true });
			await trigger(name);
			setSearchTerm('');
		},
		[isMulti, name, setValue, trigger],
	);

	const handleSelect = React.useCallback(
		async (onChange: (value: any) => void, currentValue: any, selectedValue: string) => {
			let newValue;
			if (isMulti) {
				const valueArray = Array.isArray(currentValue) ? currentValue : [];
				const valueIndex = valueArray.indexOf(selectedValue);
				
				if (valueIndex === -1) {
					newValue = [...valueArray, selectedValue];
				} else {
					newValue = valueArray.filter((v) => v !== selectedValue);
				}
			} else {
				newValue = selectedValue;
				handleClose();
			}

			onChange(newValue);
			setValue(name, newValue, { shouldValidate: true, shouldDirty: true });
			await trigger(name);
		},
		[handleClose, isMulti, name, setValue, trigger],
	);

	const getDisplayValue = React.useCallback(
		(value: any) => {
			if (!value) return placeholder;
			
			if (isMulti && Array.isArray(value)) {
				if (value.length === 0) return placeholder;
				const selectedLabels = value
					.map((v) => initialOptions.find((opt) => opt.value === v)?.label)
					.filter(Boolean);
				return selectedLabels.join(', ');
			}
			
			return initialOptions.find((opt) => opt.value === value)?.label || placeholder;
		},
		[initialOptions, placeholder, isMulti],
	);

	const hasValue = React.useCallback(
		(value: any) => {
			if (isMulti) {
				return Array.isArray(value) && value.length > 0;
			}
			return value != null;
		},
		[isMulti],
	);

	React.useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				isOpen &&
				contentRef.current &&
				!contentRef.current.contains(event.target as Node) &&
				triggerRef.current &&
				!triggerRef.current.contains(event.target as Node)
			) {
				handleClose();
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen, handleClose]);

	return (
		<Controller
			name={name}
			control={control}
			rules={rules}
			render={({ field, fieldState }) => (
				<CustomSelectRoot 
					{...rest} 
					isDisabled={isDisabled}
					data-invalid={!!fieldState.error}
					onBlur={field.onBlur}
				>
					{label && <CustomSelectLabel htmlFor={name}>{label}</CustomSelectLabel>}
					<CustomSelectTrigger
						ref={triggerRef}
						clearable={isClearable && hasValue(field.value)}
						isOpen={isOpen}
						onOpen={handleOpen}
						aria-haspopup="listbox"
						aria-expanded={isOpen}
						isDisabled={isDisabled}
						data-invalid={!!fieldState.error}
					>
						<CustomSelectValueText placeholder={placeholder}>
							{getDisplayValue(field.value)}
						</CustomSelectValueText>
						<ChakraSelect.IndicatorGroup>
							{isClearable && hasValue(field.value) && (
								<ChakraSelect.ClearTrigger onClick={(e) => handleClear(field.onChange, e)}>
									<CloseButton
										size="xs"
										variant="plain"
										focusVisibleRing="inside"
										focusRingWidth="2px"
										pointerEvents="auto"
									/>
								</ChakraSelect.ClearTrigger>
							)}
							<ChakraSelect.Indicator>
								<LuChevronDown />
							</ChakraSelect.Indicator>
						</ChakraSelect.IndicatorGroup>
					</CustomSelectTrigger>
					{isOpen && (
						<CustomSelectContent ref={contentRef} zIndex={1500}>
							<SearchInput value={searchTerm} onChange={setSearchTerm} />
							<div onPointerDown={(e) => e.stopPropagation()}>
								<OptionsList
									options={filteredOptions}
									onSelect={(value) => handleSelect(field.onChange, field.value, value)}
								/>
							</div>
						</CustomSelectContent>
					)}
					{fieldState.error && (
						<div style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
							{fieldState.error.message}
						</div>
					)}
				</CustomSelectRoot>
			)}
		/>
	);
};
