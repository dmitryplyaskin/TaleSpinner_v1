// This file is used to connect all the sidebars to the main layout
import { AgentCardsSidebar } from './agent-cards';
import { AppSettingsSidebar } from './app-settings';
import { InstructionsSidebar } from './instructions';
import { OperationProfilesSidebar } from './operation-profiles';
import { SettingsSidebar } from './settings';
import { UserPersonSidebar } from './user-person';
import { WorldInfoSidebar } from './world-info';

export const ConnectSidebars = () => {
	return (
		<>
			<SettingsSidebar />
			<AgentCardsSidebar />
			<UserPersonSidebar />
			<OperationProfilesSidebar />
			<InstructionsSidebar />
			<WorldInfoSidebar />
			<AppSettingsSidebar />
		</>
	);
};
