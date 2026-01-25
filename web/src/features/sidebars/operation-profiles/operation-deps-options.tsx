import React, { createContext, useMemo } from 'react';
import { useWatch } from 'react-hook-form';

type DepOption = { value: string; label: string };

const OperationDepsOptionsContext = createContext<DepOption[]>([]);

export const OperationDepsOptionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const operations = useWatch({ name: 'operations' }) as Array<{ opId?: unknown; name?: unknown }> | undefined;

	const options = useMemo<DepOption[]>(() => {
		if (!Array.isArray(operations)) return [];
		return operations
			.map((o) => {
				const opId = typeof o?.opId === 'string' ? o.opId : '';
				if (!opId) return null;
				const name = typeof o?.name === 'string' ? o.name : '';
				return { value: opId, label: name.trim() ? `${name} — ${opId}` : opId };
			})
			.filter((v): v is DepOption => Boolean(v));
	}, [operations]);

	return <OperationDepsOptionsContext.Provider value={options}>{children}</OperationDepsOptionsContext.Provider>;
};

export function useOperationDepsOptions(): DepOption[] {
	return React.useContext(OperationDepsOptionsContext);
}

