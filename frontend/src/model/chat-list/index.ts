import { AgentCard } from '@shared/types/agent-card';
import { createItemsModel } from '@model/_fabric_/items-model';

export const chatListModel = createItemsModel<AgentCard>({ route: '/chat' }, 'chat');
