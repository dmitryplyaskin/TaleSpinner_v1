import { Accordion, Group, Text } from '@mantine/core';
import React, { useMemo, useState } from 'react';

import { BasicsSection } from './sections/basics-section';
import { ExecutionSection } from './sections/execution-section';
import { OutputSection } from './sections/output-section';
import { ParamsSection } from './sections/params-section';

import type { OperationKind } from '@shared/types/operation-profiles';

type Props = {
	index: number;
	kind: OperationKind;
};

type SectionId = 'basics' | 'kind' | 'execution' | 'output';

const DEFAULT_OPEN: SectionId[] = ['basics', 'kind', 'execution'];

const KIND_TITLE_MAP: Record<OperationKind, string> = {
	template: 'Template',
	llm: 'LLM',
	rag: 'RAG',
	tool: 'Tool',
	compute: 'Compute',
	transform: 'Transform',
	legacy: 'Legacy',
};

function isSectionId(v: unknown): v is SectionId {
	return v === 'basics' || v === 'kind' || v === 'execution' || v === 'output';
}

export const OperationSectionsAccordion: React.FC<Props> = ({ index, kind }) => {
	const [open, setOpen] = useState<SectionId[]>(DEFAULT_OPEN);

	const isOpen = useMemo(() => {
		const set = new Set(open);
		return (id: SectionId) => set.has(id);
	}, [open]);

	return (
		<Accordion
			multiple
			value={open}
			onChange={(next) => setOpen(next.filter(isSectionId))}
			variant="contained"
		>
			<Accordion.Item value="basics">
				<Accordion.Control>Basics</Accordion.Control>
				<Accordion.Panel>{isOpen('basics') && <BasicsSection index={index} />}</Accordion.Panel>
			</Accordion.Item>

			<Accordion.Item value="kind">
				<Accordion.Control>
					<Group gap={8} wrap="nowrap">
						<Text inherit>{KIND_TITLE_MAP[kind]}</Text>
						<span className="op-advancedBadge">Kind-specific</span>
					</Group>
				</Accordion.Control>
				<Accordion.Panel>{isOpen('kind') && <ParamsSection index={index} kind={kind} />}</Accordion.Panel>
			</Accordion.Item>

			<Accordion.Item value="execution">
				<Accordion.Control>Execution</Accordion.Control>
				<Accordion.Panel>{isOpen('execution') && <ExecutionSection index={index} />}</Accordion.Panel>
			</Accordion.Item>

			<Accordion.Item value="output">
				<Accordion.Control>
					<Group gap={8} wrap="nowrap">
						<Text inherit>Effects / Output</Text>
						<span className="op-advancedBadge">Advanced</span>
					</Group>
				</Accordion.Control>
				<Accordion.Panel>{isOpen('output') && <OutputSection index={index} />}</Accordion.Panel>
			</Accordion.Item>
		</Accordion>
	);
};

