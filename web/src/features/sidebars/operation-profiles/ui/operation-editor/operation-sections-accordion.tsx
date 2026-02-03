import { Accordion } from '@mantine/core';
import React, { useMemo, useState } from 'react';

import type { OperationKind } from '@shared/types/operation-profiles';

import { BasicsSection } from './sections/basics-section';
import { ExecutionSection } from './sections/execution-section';
import { OutputSection } from './sections/output-section';
import { ParamsSection } from './sections/params-section';

type Props = {
	index: number;
	kind: OperationKind;
};

type SectionId = 'basics' | 'execution' | 'params' | 'output';

const DEFAULT_OPEN: SectionId[] = ['basics', 'execution'];

function isSectionId(v: unknown): v is SectionId {
	return v === 'basics' || v === 'execution' || v === 'params' || v === 'output';
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

			<Accordion.Item value="execution">
				<Accordion.Control>Execution</Accordion.Control>
				<Accordion.Panel>{isOpen('execution') && <ExecutionSection index={index} />}</Accordion.Panel>
			</Accordion.Item>

			<Accordion.Item value="params">
				<Accordion.Control>Template / Params</Accordion.Control>
				<Accordion.Panel>
					{isOpen('params') && <ParamsSection index={index} kind={kind === 'template' ? 'template' : 'other'} />}
				</Accordion.Panel>
			</Accordion.Item>

			<Accordion.Item value="output">
				<Accordion.Control>Effects / Output</Accordion.Control>
				<Accordion.Panel>{isOpen('output') && <OutputSection index={index} />}</Accordion.Panel>
			</Accordion.Item>
		</Accordion>
	);
};

