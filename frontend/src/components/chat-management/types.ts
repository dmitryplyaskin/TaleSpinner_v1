export interface ChatInfo {
  id: string;
  title: string;
  timestamp: string;
}

export interface ChatManagementProps {
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  chatList: ChatInfo[];
  currentChatId?: string;
}
