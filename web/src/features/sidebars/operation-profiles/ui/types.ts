import type { OperationKind } from '@shared/types/operation-profiles';

export type OperationListRowMeta = {
	opId: string;
	index: number;
	rowKey: string;
};

export type OperationFilterState = {
	query: string;
	kind: 'all' | OperationKind;
	enabled: 'all' | 'enabled' | 'disabled';
	required: 'all' | 'required' | 'optional';
};

export type NodeEditorViewState = 'graph' | 'inspector';
