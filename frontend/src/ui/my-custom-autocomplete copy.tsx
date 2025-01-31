import { useState } from 'react';
import { Input, Box, Text, useDisclosure, Flex } from '@chakra-ui/react';
import { PopoverRoot, PopoverBody, PopoverContent, PopoverTrigger } from './chakra-core-ui/popover';

export const MyCustomAutocomplete = () => {
	const [inputValue, setInputValue] = useState('');
	const { open, onOpen, onClose } = useDisclosure();

	// Пример списка вариантов
	const allOptions = [
		'Apple',
		'Banana',
		'Cherry',
		'Date',
		'Elderberry',
		'Fig',
		'Grape',
		'Honeydew',
		'Kiwi',
		'Lemon',
		'Mango',
		'Nectarine',
		'Orange',
		'Papaya',
		'Raspberry',
		'Strawberry',
		'Tangerine',
		'Ugli',
		'Vanilla',
		'Watermelon',
		'Xigua',
		'Yuzu',
		'Zucchini',
	];

	// Фильтрация вариантов
	const filteredOptions = allOptions.filter((option) => option.toLowerCase().includes(inputValue.toLowerCase()));

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setInputValue(e.target.value);
		if (!open) onOpen();
	};

	const handleSelect = (value) => {
		setInputValue(value);
		onClose();
	};

	return (
		<Box width={'100%'}>
			<PopoverRoot
				open={open}
				onOpenChange={onOpen}
				closeOnEscape
				autoFocus={false}
				positioning={{ placement: 'bottom-start', sameWidth: true }}
			>
				<PopoverTrigger width={'100%'}>
					<Input placeholder="Search fruits..." value={inputValue} onChange={handleInputChange} onFocus={onOpen} />
				</PopoverTrigger>

				<PopoverContent width={'100%'}>
					<PopoverBody p={0}>
						<Flex flexDirection="column" gap={1} maxHeight={'500px'} overflowY={'auto'}>
							{filteredOptions.map((option) => (
								<Text
									key={option}
									px={4}
									py={2}
									cursor="pointer"
									_hover={{ bg: 'gray.100' }}
									onClick={() => handleSelect(option)}
								>
									{option}
								</Text>
							))}

							{filteredOptions.length === 0 && (
								<Box px={4} py={2} color="gray.500">
									No results found
								</Box>
							)}
						</Flex>
					</PopoverBody>
				</PopoverContent>
			</PopoverRoot>
		</Box>
	);
};
