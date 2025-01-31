import { useState, useCallback, useMemo } from 'react';
import { Input, Box, Text, Flex, InputProps } from '@chakra-ui/react';
import { PopoverRoot, PopoverBody, PopoverContent, PopoverTrigger } from './chakra-core-ui/popover';
import { LuX, LuChevronDown } from 'react-icons/lu';
import { Tag } from './chakra-core-ui/tag';

export interface AutocompleteOption {
	label: string;
	value: string;
	[key: string]: any;
}

export interface CustomAutocompleteProps {
	// Основные пропсы
	options: AutocompleteOption[];
	onSelect?: (option: AutocompleteOption) => void;
	onChange?: (value: string[]) => void;
	value?: string[];
	defaultValue?: string[];

	// Кастомизация внешнего вида
	maxHeight?: number | string;
	width?: number | string;
	placeholder?: string;
	noResultsMessage?: string;

	// Кастомизация поведения
	filterFunction?: (option: AutocompleteOption, inputValue: string) => boolean;
	minCharsToShow?: number;
	closeOnSelect?: boolean;

	// Кастомные рендереры
	renderOption?: (option: AutocompleteOption, isSelected: boolean) => React.ReactNode;
	renderInput?: (props: InputProps) => React.ReactNode;

	// Стили
	inputProps?: Partial<InputProps>;
	optionStyles?: {
		normal?: Record<string, any>;
		hover?: Record<string, any>;
		selected?: Record<string, any>;
	};

	// Дополнительные пропсы
	isDisabled?: boolean;
	autoFocus?: boolean;
	isLoading?: boolean;
	isMulti?: boolean;

	// Отключение фильтрации опций
	disableFilterOptions?: boolean;
}

export const CustomAutocomplete: React.FC<CustomAutocompleteProps> = ({
	options,
	onSelect,
	onChange,
	value: controlledValue,
	defaultValue = [],
	maxHeight = '500px',
	width = '100%',
	placeholder = 'Search...',
	noResultsMessage = 'No results found',
	filterFunction,
	minCharsToShow = 0,
	closeOnSelect = true,
	renderOption,
	renderInput,
	inputProps = {},
	optionStyles = {},
	isDisabled = false,
	autoFocus = false,
	isLoading = false,
	isMulti = false,
	disableFilterOptions = false,
}) => {
	const [internalValue, setInternalValue] = useState<string[]>(defaultValue);
	const [inputText, setInputText] = useState('');
	const [open, setOpen] = useState(false);

	const value = controlledValue !== undefined ? controlledValue : internalValue;

	const defaultFilterFunction = useCallback(
		(option: AutocompleteOption, input: string) =>
			option.label.toLowerCase().includes(input.toLowerCase()) && !value.includes(option.value),
		[value],
	);

	const filteredOptions = useMemo(() => {
		if (value[0] && disableFilterOptions) return options;
		const filterFn = filterFunction || defaultFilterFunction;
		return options.filter((option) => filterFn(option, inputText));
	}, [options, inputText, filterFunction, defaultFilterFunction]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		setInputText(newValue);

		if (newValue.length >= minCharsToShow) {
			if (!open) setOpen(true);
		} else {
			setOpen(false);
		}
	};

	const handleSelect = (option: AutocompleteOption) => {
		const newValue = isMulti ? [...value, option.value] : [option.value];

		if (!controlledValue) {
			setInternalValue(newValue);
		}

		setInputText(isMulti ? '' : option.label);
		onChange?.(newValue);
		onSelect?.(option);

		if (closeOnSelect && !isMulti) {
			setOpen(false);
		}
	};

	const handleRemoveTag = (valueToRemove: string) => {
		const newValue = value.filter((v) => v !== valueToRemove);
		if (!controlledValue) {
			setInternalValue(newValue);
		}
		onChange?.(newValue);
	};

	const selectedOptions = options.filter((opt) => value.includes(opt.value));

	const defaultRenderOption = (option: AutocompleteOption, isSelected: boolean) => (
		<Text
			px={4}
			py={2}
			cursor="pointer"
			{...optionStyles.normal}
			_hover={optionStyles.hover || { bg: 'gray.100' }}
			{...(isSelected ? optionStyles.selected : {})}
		>
			{option.label}
		</Text>
	);

	const defaultRenderInput = (inputProps: InputProps) => (
		<Flex position="relative" flexDirection="column" gap={2}>
			<Flex position="relative" alignItems="center">
				<Input {...inputProps} pr="60px" value={isMulti ? inputText : selectedOptions[0]?.label || inputText} />
				<Flex position="absolute" right="2" gap="2" alignItems="center">
					{((isMulti && inputText) || (!isMulti && value.length > 0)) && !inputProps.disabled && (
						<Box
							as="button"
							onClick={(e) => {
								e.stopPropagation();
								setInputText('');
								if (!isMulti) {
									if (!controlledValue) {
										setInternalValue([]);
									}
									onChange?.([]);
								}
							}}
							cursor="pointer"
							color="gray.500"
							_hover={{ color: 'gray.700' }}
						>
							<LuX size={16} />
						</Box>
					)}
					<Box color="gray.500" transition="transform 0.2s" transform={open ? 'rotate(180deg)' : 'rotate(0deg)'}>
						<LuChevronDown size={16} />
					</Box>
				</Flex>
			</Flex>
		</Flex>
	);

	return (
		<Box width={width}>
			<PopoverRoot
				open={open && !isDisabled}
				onOpenChange={(e) => {
					setOpen(e.open);
				}}
				closeOnEscape
				autoFocus={autoFocus}
				positioning={{ placement: 'bottom-start', sameWidth: true }}
			>
				<PopoverTrigger width="100%">
					{renderInput
						? renderInput({
								value: isMulti ? inputText : selectedOptions[0]?.label || inputText,
								onChange: handleInputChange,
								placeholder,
								disabled: isDisabled,
								...inputProps,
						  })
						: defaultRenderInput({
								value: isMulti ? inputText : selectedOptions[0]?.label || inputText,
								onChange: handleInputChange,
								placeholder,
								disabled: isDisabled,
								...inputProps,
						  })}
				</PopoverTrigger>
				{isMulti && selectedOptions.length > 0 && (
					<Flex gap={2} mt={2} flexWrap="wrap">
						{selectedOptions.map((option) => (
							<Tag
								key={option.value}
								size="md"
								variant="subtle"
								colorScheme="blue"
								onClose={() => handleRemoveTag(option.value)}
								closable
							>
								{option.label}
							</Tag>
						))}
					</Flex>
				)}

				<PopoverContent width="100%">
					<PopoverBody p={0}>
						<Flex flexDirection="column" gap={1} maxHeight={maxHeight} overflowY="auto">
							{isLoading ? (
								<Box px={4} py={2}>
									Loading...
								</Box>
							) : filteredOptions.length > 0 ? (
								filteredOptions.map((option) => (
									<Box key={option.value} onClick={() => handleSelect(option)}>
										{renderOption
											? renderOption(option, option.value === selectedOptions[0]?.value)
											: defaultRenderOption(option, option.value === selectedOptions[0]?.value)}
									</Box>
								))
							) : (
								<Box px={4} py={2} color="gray.500">
									{noResultsMessage}
								</Box>
							)}
						</Flex>
					</PopoverBody>
				</PopoverContent>
			</PopoverRoot>
		</Box>
	);
};
