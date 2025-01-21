import React from 'react';
import {
	AutoComplete,
	AutoCompleteInput,
	AutoCompleteItem,
	AutoCompleteList,
	AutoCompleteTag,
	AutoCompleteCreatable,
} from '@choc-ui/chakra-autocomplete';
import { Input, Box, Flex } from '@chakra-ui/react';
import { LuChevronDown, LuX } from 'react-icons/lu';

export type Option = {
	value: string;
	label: string;
};

export interface AutocompleteProps {
	options: Option[];
	value?: Option | Option[];
	onChange?: (value: Option | Option[]) => void;
	placeholder?: string;
	isMulti?: boolean;
	isClearable?: boolean;
}

export const Autocomplete: React.FC<AutocompleteProps> = ({
	options,
	value,
	onChange,
	placeholder = 'Выберите...',
	isMulti = false,
	isClearable = true,
}) => {
	const [selectedItems, setSelectedItems] = React.useState<Option[]>(
		isMulti ? (Array.isArray(value) ? value : []) : value ? [value as Option] : [],
	);

	const handleChange = (values: string[] | string) => {
		if (typeof values === 'string') {
			const selectedOptions = [options.find((opt) => opt.value === values)!];
			setSelectedItems(selectedOptions);
			if (onChange) {
				onChange(isMulti ? selectedOptions : selectedOptions[0]);
			}
		} else {
			const selectedOptions = values.map((val) => options.find((opt) => opt.value === val)!);
			setSelectedItems(selectedOptions);
			if (onChange) {
				onChange(isMulti ? selectedOptions : selectedOptions[0]);
			}
		}
	};

	const handleClear = () => {
		setSelectedItems([]);
		if (onChange) {
			onChange(isMulti ? [] : (undefined as any));
		}
	};

	return (
		<Box position="relative">
			<AutoComplete
				multiple={isMulti}
				openOnFocus
				onChange={handleChange}
				value={selectedItems.map((item) => item.value)}
			>
				<AutoCompleteInput as={Input} placeholder={placeholder} variant="outline">
					{({ tags }) =>
						isMulti &&
						tags.map((tag, tid) => (
							<AutoCompleteTag
								key={tid}
								label={options.find((opt) => opt.label === tag.label)?.label || tag.label}
								onRemove={tag.onRemove}
							/>
						))
					}
				</AutoCompleteInput>
				{isClearable && selectedItems.length > 0 && (
					<Flex
						position="absolute"
						right="8"
						top="50%"
						transform="translateY(-50%)"
						zIndex={2}
						cursor="pointer"
						onClick={handleClear}
					>
						<LuX className="h-4 w-4 cursor-pointer" />
					</Flex>
				)}
				<Flex position="absolute" right="2" top="50%" transform="translateY(-50%)" zIndex={2}>
					<LuChevronDown className="h-4 w-4" />
				</Flex>
				<AutoCompleteList>
					{options.map((option) => (
						<AutoCompleteItem
							key={option.value}
							value={option.value}
							textTransform="capitalize"
							_selected={{ bg: 'blue.100' }}
							_focus={{ bg: 'blue.50' }}
						>
							{option.label}
						</AutoCompleteItem>
					))}
				</AutoCompleteList>
			</AutoComplete>
		</Box>
	);
};
