'use client';

import type { CollectionItem } from '@chakra-ui/react';
import { Select as ChakraSelect, Portal, Box, Input } from '@chakra-ui/react';
import { CloseButton } from './close-button';
import * as React from 'react';

/**
 * =========================
 * SelectTrigger
 * =========================
 */
interface SelectTriggerProps extends ChakraSelect.ControlProps {
	clearable?: boolean;
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(function SelectTrigger(
	props,
	ref,
) {
	const { children, clearable, ...rest } = props;
	return (
		<ChakraSelect.Control {...rest}>
			<ChakraSelect.Trigger ref={ref}>{children}</ChakraSelect.Trigger>
			<ChakraSelect.IndicatorGroup>
				{clearable && <SelectClearTrigger />}
				<ChakraSelect.Indicator />
			</ChakraSelect.IndicatorGroup>
		</ChakraSelect.Control>
	);
});

const SelectClearTrigger = React.forwardRef<HTMLButtonElement, ChakraSelect.ClearTriggerProps>(
	function SelectClearTrigger(props, ref) {
		return (
			<ChakraSelect.ClearTrigger asChild {...props} ref={ref}>
				<CloseButton size="xs" variant="plain" focusVisibleRing="inside" focusRingWidth="2px" pointerEvents="auto" />
			</ChakraSelect.ClearTrigger>
		);
	},
);

/**
 * =========================
 * SelectContent
 * =========================
 */
interface SelectContentProps extends ChakraSelect.ContentProps {
	portalled?: boolean;
	portalRef?: React.RefObject<HTMLElement>;
	searchable?: boolean; // Новое свойство для включения поиска
	searchTerm?: string; // Текущее значение строки поиска
	onSearchChange?: (value: string) => void; // Колбэк для обновления searchTerm
}

export const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(function SelectContent(props, ref) {
	const { portalled = true, portalRef, searchable, searchTerm, onSearchChange, ...rest } = props;

	// Если надо — внутри можно и локально хранить searchTerm, но чаще удобнее
	// контролировать из родительского компонента.
	// Здесь просто используем переданные пропсы.
	const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (onSearchChange) {
			onSearchChange(e.target.value);
		}
	};

	return (
		<Portal disabled={!portalled} container={portalRef}>
			<ChakraSelect.Positioner>
				<ChakraSelect.Content {...rest} ref={ref}>
					{searchable && (
						<Box p={2} onPointerDown={(e) => e.stopPropagation()}>
							<Input placeholder="Поиск..." value={searchTerm || ''} onChange={handleSearch} />
						</Box>
					)}
					{/*
            Далее ChakraSelect создаёт внутреннюю коллекцию опций.
            По умолчанию, если вы используете <SelectItem>, они будут все отображаться.
            Чтобы фильтровать, можно либо:
            1) Обернуть потомков в React.Children.map и скрывать ненужные.
            2) Или использовать встроенные механизмы ChakraSelect (для этого иногда
               приходится хранить items отдельно и генерировать <SelectItem> динамически).
            Здесь — покажу пример быстрого фильтра через React.Children.map:
          */}
					{searchable && searchTerm
						? React.Children.map(rest.children, (child) => {
								// Если это компонент <SelectItem>, фильтруем по value или label
								if (
									React.isValidElement(child) &&
									(child.type === SelectItem || child.props?.__TYPE === 'SelectItem')
								) {
									const { item } = child.props;
									const val = item?.value?.toString().toLowerCase() || '';
									// Можем фильтровать и по label, если нужно
									// const label = item?.label?.toString().toLowerCase() || "";
									if (val.includes(searchTerm.toLowerCase())) {
										return child;
									}
									return null;
								}
								// Для групп или других вложений — оставляем как есть
								return child;
						  })
						: rest.children}
				</ChakraSelect.Content>
			</ChakraSelect.Positioner>
		</Portal>
	);
});

/**
 * =========================
 * SelectItem
 * =========================
 */
export const SelectItem = React.forwardRef<HTMLDivElement, ChakraSelect.ItemProps>(function SelectItem(props, ref) {
	const { item, children, ...rest } = props;
	return (
		<ChakraSelect.Item key={item.value} item={item} {...rest} ref={ref}>
			{children}
			<ChakraSelect.ItemIndicator />
		</ChakraSelect.Item>
	);
});

/**
 * =========================
 * SelectValueText
 * =========================
 */
interface SelectValueTextProps extends Omit<ChakraSelect.ValueTextProps, 'children'> {
	children?(items: CollectionItem[]): React.ReactNode;
}

export const SelectValueText = React.forwardRef<HTMLSpanElement, SelectValueTextProps>(function SelectValueText(
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
					if (children) return children(items);
					if (items.length === 1) return select.collection.stringifyItem(items[0]);
					return `${items.length} selected`;
				}}
			</ChakraSelect.Context>
		</ChakraSelect.ValueText>
	);
});

/**
 * =========================
 * SelectRoot
 * =========================
 * Основной контейнер селекта, в который передаём searchable,
 * чтобы управлять состоянием поиска (searchTerm) из родителя.
 */
export const SelectRoot = React.forwardRef<HTMLDivElement, ChakraSelect.RootProps & { searchable?: boolean }>(
	function SelectRoot(props, ref) {
		const { searchable, children, ...rest } = props;
		// Локальный стейт поиска (можно вынести наружу, если хочется контролировать извне)
		const [searchTerm, setSearchTerm] = React.useState('');

		return (
			<ChakraSelect.Root {...rest} ref={ref} positioning={{ sameWidth: true, ...props.positioning }}>
				{/* Если не используем asChild, то рендерим HiddenSelect + children */}
				{!props.asChild && <ChakraSelect.HiddenSelect />}
				{/*
        Пробрасываем searchable/searchTerm/onSearchChange в SelectContent,
        чтобы там можно было обрабатывать поиск.
      */}
				{React.Children.map(children, (child) => {
					if (
						React.isValidElement(child) &&
						(child.type === SelectContent || child.props?.__TYPE === 'SelectContent')
					) {
						// Обогащаем SelectContent нужными пропсами
						return React.cloneElement(child, {
							searchable,
							searchTerm,
							onSearchChange: setSearchTerm,
						});
					}
					return child;
				})}
			</ChakraSelect.Root>
		);
	},
) as ChakraSelect.RootComponent;

/**
 * =========================
 * SelectItemGroup
 * =========================
 */
interface SelectItemGroupProps extends ChakraSelect.ItemGroupProps {
	label: React.ReactNode;
}

export const SelectItemGroup = React.forwardRef<HTMLDivElement, SelectItemGroupProps>(function SelectItemGroup(
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

/**
 * =========================
 * Прочие экспортируемые компоненты
 * =========================
 */
export const SelectLabel = ChakraSelect.Label;
export const SelectItemText = ChakraSelect.ItemText;
