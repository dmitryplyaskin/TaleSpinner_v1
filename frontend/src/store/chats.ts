import { createEffect, createEvent, createStore } from "effector";
import { BASE_URL } from "../const";
import { ChatInfo } from "../types/chat";

export const $chatList = createStore<ChatInfo[]>([]);
export const $currentChatId = createStore("");

export const getChatListFx = createEffect<void, ChatInfo[]>(async () => {
  try {
    const response = await fetch(`${BASE_URL}/chats`).then((response) =>
      response.json()
    );

    return response;
  } catch (error) {
    console.error("Error fetching chat list:", error);
    return [];
  }
});

export const editChatFx = createEffect(async (data) => {
  try {
    const response = await fetch(`${BASE_URL}/chats/${data.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return response.json();
  } catch (error) {
    console.error("Error editing chat:", error);
    return null;
  }
});

export const deleteChatFx = createEffect(async (data) => {
  try {
    const response = await fetch(`${BASE_URL}/chats/${data.id}`, {
      method: "DELETE",
    });
    return response.json();
  } catch (error) {
    console.error("Error deleting chat:", error);
    return null;
  }
});

$chatList
  .on(getChatListFx.doneData, (_, data) => data)
  .on(editChatFx.doneData, (state, data) =>
    state.map((chat) => {
      if (chat.id === data.id) {
        return { ...chat, ...data };
      }
      return chat;
    })
  )
  .on(deleteChatFx.doneData, (state, data) =>
    state.filter((chat) => chat.id !== data.id)
  );

export const selectCurrentChat = createEvent<string>();

$currentChatId.on(selectCurrentChat, (_, data) => data);
