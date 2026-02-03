import { useMemo } from 'react';
import { useWatch } from 'react-hook-form';

export type DepOption = { value: string; label: string };

/**
 * Builds `dependsOn` options from current form state.
 *
 * Important: this intentionally watches the whole `operations` array, but the only
 * mounted heavy editor is a single operation (Drawer P0 fix), so this becomes cheap.
 */
export function useOperationDepsOptions(): DepOption[] {
	const operations = useWatch({ name: 'operations' }) as Array<{ opId?: unknown; name?: unknown }> | undefined;

	return useMemo<DepOption[]>(() => {
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
}

