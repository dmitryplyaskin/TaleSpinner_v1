import { useState, useCallback, useMemo } from 'react';
import { Input, Box, Text, Flex, InputProps } from '@chakra-ui/react';
import { PopoverRoot, PopoverBody, PopoverContent, PopoverTrigger } from './chakra-core-ui/popover';

export interface AutocompleteOption {
	title: string;
	value: string;
	[key: string]: any;
}

export interface CustomAutocompleteProps {
	// Основные пропсы
	options: AutocompleteOption[];
	onSelect?: (option: AutocompleteOption) => void;
	onChange?: (value: string) => void;
	value?: string;
	defaultValue?: string;

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
}

export const CustomAutocomplete: React.FC<CustomAutocompleteProps> = ({
	options,
	onSelect,
	onChange,
	value: controlledValue,
	defaultValue = '',
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
}) => {
	const [internalValue, setInternalValue] = useState(defaultValue);
	const [open, setOpen] = useState(false);

	const value = controlledValue !== undefined ? controlledValue : internalValue;

	// Дефолтная функция фильтрации
	const defaultFilterFunction = useCallback(
		(option: AutocompleteOption, input: string) => option.title.toLowerCase().includes(input.toLowerCase()),
		[],
	);

	const filteredOptions = useMemo(() => {
		const filterFn = filterFunction || defaultFilterFunction;
		return options.filter((option) => filterFn(option, value));
	}, [options, value, filterFunction, defaultFilterFunction]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		if (!controlledValue) {
			setInternalValue(newValue);
		}
		onChange?.(newValue);

		if (newValue.length >= minCharsToShow) {
			if (!open) setOpen(true);
		} else {
			setOpen(false);
		}
	};

	const handleSelect = (option: AutocompleteOption) => {
		if (!controlledValue) {
			setInternalValue(option.title);
		}
		onSelect?.(option);
		if (closeOnSelect) {
			setOpen(false);
		}
	};

	const defaultRenderOption = (option: AutocompleteOption, isSelected: boolean) => (
		<Text
			px={4}
			py={2}
			cursor="pointer"
			{...optionStyles.normal}
			_hover={optionStyles.hover || { bg: 'gray.100' }}
			{...(isSelected ? optionStyles.selected : {})}
		>
			{option.title}
		</Text>
	);

	const defaultRenderInput = (inputProps: InputProps) => <Input {...inputProps} />;

	const currentSelectedOption = options.find((opt) => opt.value === value);

	return (
		<Box width={width}>
			<PopoverRoot
				open={open && !isDisabled}
				onOpenChange={(e) => {
					console.log(e);
					setOpen(e.open);
				}}
				closeOnEscape
				autoFocus={autoFocus}
				positioning={{ placement: 'bottom-start', sameWidth: true }}
			>
				<PopoverTrigger width="100%">
					{renderInput
						? renderInput({
								value,
								onChange: handleInputChange,
								placeholder,
								disabled: isDisabled,
								...inputProps,
						  })
						: defaultRenderInput({
								value,
								onChange: handleInputChange,
								placeholder,
								disabled: isDisabled,
								...inputProps,
						  })}
				</PopoverTrigger>

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
											? renderOption(option, option.value === currentSelectedOption?.value)
											: defaultRenderOption(option, option.value === currentSelectedOption?.value)}
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
