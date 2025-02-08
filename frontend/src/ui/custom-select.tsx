'use client';

import { createListCollection, Input } from '@chakra-ui/react';
import {
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectRoot,
	SelectTrigger,
	SelectValueText,
} from './chakra-core-ui/select';
import { useState } from 'react';

export const Demo = () => {
	const [value, setValue] = useState<string[]>([]);
	return (
		<SelectRoot collection={frameworks} width="320px" value={value} onValueChange={(e) => setValue(e.value)}>
			<SelectLabel>Select framework</SelectLabel>
			<SelectTrigger>
				<SelectValueText placeholder="Select movie" />
			</SelectTrigger>
			<SelectContent zIndex={1500}>
				<Input placeholder="Search" size="sm" />
				{frameworks.items.map((movie) => (
					<SelectItem item={movie} key={movie.value}>
						{movie.label}
					</SelectItem>
				))}
			</SelectContent>
		</SelectRoot>
	);
};

const frameworks = createListCollection({
	items: [
		{ label: 'React.js', value: 'react' },
		{ label: 'Vue.js', value: 'vue' },
		{ label: 'Angular', value: 'angular' },
		{ label: 'Svelte', value: 'svelte' },
	],
});
