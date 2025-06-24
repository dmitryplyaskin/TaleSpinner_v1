// This file is used to connect all the sidebars to the main layout
import { SettingsSidebar } from './settings';
import { AgentCardsSidebar } from './agent-cards';
import { UserPersonSidebar } from './user-person';
import { PipelineSidebar } from './pipelines';
import { InstructionsSidebar } from './instructions';
import { TemplateSidebar } from './templates';
import { AppSettingsSidebar } from './app-settings';

export const ConnectSidebars = () => {
	return (
		<>
			<SettingsSidebar />
			<AgentCardsSidebar />
			<UserPersonSidebar />
			<PipelineSidebar />
			<InstructionsSidebar />
			<TemplateSidebar />
			<AppSettingsSidebar />
		</>
	);
};
