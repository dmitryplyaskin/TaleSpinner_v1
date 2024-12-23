import { useUnit } from "effector-react";
import React, { useState } from "react";
import { $openEditor, toggleEditor } from "../../model/chats";

interface EditChatModalProps {
  isOpen: boolean;
  chatId: string;
  initialTitle: string;
  onClose: () => void;
  onSave: (chatId: string, newTitle: string) => void;
}

export const EditChatModal: React.FC<EditChatModalProps> = ({
  chatId,
  initialTitle,
  onClose,
  onSave,
}) => {
  const isOpen = useUnit($openEditor);
  const [title, setTitle] = useState(initialTitle);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(chatId, title);
    toggleEditor();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Редактировать чат</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Название чата
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="Введите название чата"
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
