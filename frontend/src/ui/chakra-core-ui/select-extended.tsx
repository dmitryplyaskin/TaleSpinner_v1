"use client";

import type { CollectionItem } from "@chakra-ui/react";
import { Select as ChakraSelect, Portal, useToken } from "@chakra-ui/react";
import { CloseButton } from "./close-button";
import * as React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { LuChevronDown } from "react-icons/lu";

interface SelectTriggerProps extends ChakraSelect.ControlProps {
  clearable?: boolean;
  isOpen: boolean;
  onOpen: () => void;
}

const CustomSelectTrigger = React.forwardRef<
  HTMLButtonElement,
  SelectTriggerProps
>(function SelectTrigger(props, ref) {
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

const SelectClearTrigger = React.forwardRef<
  HTMLButtonElement,
  ChakraSelect.ClearTriggerProps
>(function SelectClearTrigger(props, ref) {
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
      <CloseButton
        size="xs"
        variant="plain"
        focusVisibleRing="inside"
        focusRingWidth="2px"
        pointerEvents="auto"
      />
    </ChakraSelect.ClearTrigger>
  );
});

interface SelectContentProps extends ChakraSelect.ContentProps {
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement>;
}

const CustomSelectContent = React.forwardRef<
  HTMLDivElement,
  SelectContentProps
>(function SelectContent(props, ref) {
  const { portalled = true, portalRef, ...rest } = props;
  return (
    <Portal disabled={!portalled} container={portalRef}>
      <ChakraSelect.Positioner>
        <ChakraSelect.Content {...rest} ref={ref} />
      </ChakraSelect.Positioner>
    </Portal>
  );
});

const CustomSelectItem = React.forwardRef<
  HTMLDivElement,
  ChakraSelect.ItemProps
>(function SelectItem(props, ref) {
  const { item, children, ...rest } = props;
  return (
    <ChakraSelect.Item key={item.value} item={item} {...rest} ref={ref}>
      {children}
      <ChakraSelect.ItemIndicator />
    </ChakraSelect.Item>
  );
});

interface SelectValueTextProps
  extends Omit<ChakraSelect.ValueTextProps, "children"> {
  children?(items: CollectionItem[]): React.ReactNode;
}

const CustomSelectValueText = React.forwardRef<
  HTMLSpanElement,
  SelectValueTextProps
>(function SelectValueText(props, ref) {
  const { children, ...rest } = props;
  return (
    <ChakraSelect.ValueText {...rest} ref={ref}>
      <ChakraSelect.Context>
        {(select) => {
          const items = select.selectedItems;
          if (items.length === 0) return props.placeholder;
          if (children) return children(items);
          if (items.length === 1)
            return select.collection.stringifyItem(items[0]);
          return `${items.length} selected`;
        }}
      </ChakraSelect.Context>
    </ChakraSelect.ValueText>
  );
});

const CustomSelectRoot = React.forwardRef<
  HTMLDivElement,
  ChakraSelect.RootProps
>(function SelectRoot(props, ref) {
  return (
    <ChakraSelect.Root
      {...props}
      ref={ref}
      positioning={{ sameWidth: true, ...props.positioning }}
    >
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

const CustomSelectItemGroup = React.forwardRef<
  HTMLDivElement,
  SelectItemGroupProps
>(function SelectItemGroup(props, ref) {
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

// New Select Component with React Hook Form integration and search
interface SelectProps<T extends { value: string; label: string }> {
  name: string;
  label?: string;
  placeholder?: string;
  options: T[];
  isClearable?: boolean;
  isDisabled?: boolean;
  isMulti?: boolean; // пока не реализовано, но можно добавить в будущем
  [x: string]: any; // Allow other Chakra Select props
}

export const Select = <T extends { value: string; label: string }>({
  name,
  label,
  placeholder,
  options: initialOptions,
  isClearable,
  isDisabled,
  ...rest
}: SelectProps<T>) => {
  const { control } = useFormContext();
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  //   const [focusOutsideRef] = useToken("__cssVar.focusRing.offset", "0");
  //   const [focusInsideRef] = useToken("__cssVar.focusRing.width", "2px");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return initialOptions;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return initialOptions.filter((option) =>
      option.label.toLowerCase().includes(lowerSearchTerm)
    );
  }, [searchTerm, initialOptions]);

  const handleOpen = () => {
    if (isDisabled) return;
    setIsOpen(true);
  };
  const handleClose = () => setIsOpen(false);

  const handleClear = (onChange: (value: any) => void) => {
    onChange(null);
    setSearchTerm("");
    handleClose();
  };

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

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <CustomSelectRoot
          {...rest}
          isDisabled={isDisabled}
          onSelect={console.log}
        >
          {label && (
            <CustomSelectLabel htmlFor={name}>{label}</CustomSelectLabel>
          )}
          <CustomSelectTrigger
            ref={triggerRef}
            clearable={isClearable}
            isOpen={isOpen}
            onOpen={handleOpen}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            isDisabled={isDisabled}
          >
            <CustomSelectValueText placeholder={placeholder}>
              {field.value
                ? initialOptions.find((opt) => opt.value === field.value)?.label
                : placeholder}
            </CustomSelectValueText>
          </CustomSelectTrigger>
          {isOpen && (
            <CustomSelectContent ref={contentRef} zIndex={1500}>
              <input
                type="text"
                placeholder="Поиск..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: "0.5rem",
                  borderBottom: "1px solid #e2e8f0", // light gray border
                  outline: "none",
                  width: "100%",
                }}
                autoFocus
              />
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <CustomSelectItem
                    key={option.value}
                    item={option}
                    onSelect={() => {
                      field.onChange(option.value);
                      handleClose();
                      setSearchTerm("");
                    }}
                  >
                    <CustomSelectItemText>{option.label}</CustomSelectItemText>
                  </CustomSelectItem>
                ))
              ) : (
                <div style={{ padding: "0.5rem", textAlign: "center" }}>
                  Нет совпадений
                </div>
              )}
            </CustomSelectContent>
          )}
        </CustomSelectRoot>
      )}
    />
  );
};
