import { AgentCardsSidebar } from './agent-cards';
import { SettingsSidebar } from './settings';
import { UserPersonSidebar } from './user-person';
import { PipelineSidebar } from './pipelines';
import { InstructionsSidebar } from './instructions';
import { TemplateSidebar } from './templates';

export const ConnectSidebars = () => {
	return (
		<>
			<SettingsSidebar />
			<AgentCardsSidebar />
			<UserPersonSidebar />
			<PipelineSidebar />
			<InstructionsSidebar />
			<TemplateSidebar />
		</>
	);
};
