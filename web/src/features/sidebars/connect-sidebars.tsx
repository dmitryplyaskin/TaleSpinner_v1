// This file is used to connect all the sidebars to the main layout
import { AgentCardsSidebar } from './agent-cards';
import { AppSettingsSidebar } from './app-settings';
import { InstructionsSidebar } from './instructions';
import { OperationProfilesSidebar } from './operation-profiles';
import { PipelineSidebar } from './pipelines';
import { SettingsSidebar } from './settings';
import { TemplateSidebar } from './templates';
import { UserPersonSidebar } from './user-person';

export const ConnectSidebars = () => {
	return (
		<>
			<SettingsSidebar />
			<AgentCardsSidebar />
			<UserPersonSidebar />
			<PipelineSidebar />
			<OperationProfilesSidebar />
			<InstructionsSidebar />
			<TemplateSidebar />
			<AppSettingsSidebar />
		</>
	);
};
