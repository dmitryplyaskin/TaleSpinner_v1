import { Accordion, Group, Text } from '@mantine/core';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

function isSectionId(v: unknown): v is SectionId {
	return v === 'basics' || v === 'kind' || v === 'execution' || v === 'output';
}

export const OperationSectionsAccordion: React.FC<Props> = ({ index, kind }) => {
	const { t } = useTranslation();
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
				<Accordion.Control>{t('operationProfiles.sections.basics')}</Accordion.Control>
				<Accordion.Panel>{isOpen('basics') && <BasicsSection index={index} />}</Accordion.Panel>
			</Accordion.Item>

			<Accordion.Item value="kind">
				<Accordion.Control>
					<Group gap={8} wrap="nowrap">
						<Text inherit>{t(`operationProfiles.kind.${kind}`)}</Text>
						<span className="op-advancedBadge">{t('operationProfiles.sections.kindSpecific')}</span>
					</Group>
				</Accordion.Control>
				<Accordion.Panel>{isOpen('kind') && <ParamsSection index={index} kind={kind} />}</Accordion.Panel>
			</Accordion.Item>

			<Accordion.Item value="execution">
				<Accordion.Control>{t('operationProfiles.sections.execution')}</Accordion.Control>
				<Accordion.Panel>{isOpen('execution') && <ExecutionSection index={index} />}</Accordion.Panel>
			</Accordion.Item>

			<Accordion.Item value="output">
				<Accordion.Control>
					<Group gap={8} wrap="nowrap">
						<Text inherit>{t('operationProfiles.sections.effectsOutput')}</Text>
						<span className="op-advancedBadge">{t('operationProfiles.sections.advanced')}</span>
					</Group>
				</Accordion.Control>
				<Accordion.Panel>{isOpen('output') && <OutputSection index={index} />}</Accordion.Panel>
			</Accordion.Item>
		</Accordion>
	);
};

