import { ChatCardSidebar } from '../chat-card-sidebar';
import { SettingsSidebar } from '../settings-sidebar';
import { UserPersonSidebar } from '../user-person-sidebar';
import { PipelineSidebar } from '../pipeline-sidebar';
import { InstructionsSidebar } from '../instructions-sidebar';
import { TemplateSidebar } from '../template-sidebar';

export const ConnectSidebars = () => {
	return (
		<>
			<SettingsSidebar />
			<ChatCardSidebar />
			<UserPersonSidebar />
			<PipelineSidebar />
			<InstructionsSidebar />
			<TemplateSidebar />
		</>
	);
};
