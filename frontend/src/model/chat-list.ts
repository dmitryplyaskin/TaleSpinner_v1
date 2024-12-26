import { createEffect, createStore } from "effector";
import { BASE_URL } from "../const";
import { createEmptyChatCard } from "./fns";
import { ChatCard } from "../types/chat";

export const $chatList = createStore<ChatCard[]>([]);
export const $currentChatId = createStore("");

export const getChatListFx = createEffect<void, ChatCard[]>(async () => {
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

// export const editChatFx = createEffect(async (data) => {
//   try {
//     const response = await fetch(`${BASE_URL}/chats/${data.id}`, {
//       method: "PUT",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(data),
//     });
//     return response.json();
//   } catch (error) {
//     console.error("Error editing chat:", error);
//     return null;
//   }
// });

export const deleteChatFx = createEffect<ChatCard, void>(async (data) => {
  if (!window.confirm("Вы уверены, что хотите удалить этот чат?")) {
    return;
  }
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

export const createChatFx = createEffect<void, ChatCard>(async () => {
  try {
    const response = await fetch(`${BASE_URL}/chats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createEmptyChatCard()),
    });
    return response.json();
  } catch (error) {
    console.error("Error creating chat:", error);
    return null;
  }
});

export const saveChatFx = createEffect<ChatCard, void>(async (data) => {
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
    console.error("Error saving chat:", error);
    return null;
  }
});

$chatList
  .on(getChatListFx.doneData, (_, data) => data)
  .on(deleteChatFx.done, (state, { params }) =>
    state.filter((chat) => chat.id !== params.id)
  )
  .on(createChatFx.doneData, (state, data) => [data, ...state]);
// .on(saveChatFx.doneData, (state, data) =>
//   state.map((chat) => {
//     if (chat.id === data.id) {
//       return { ...chat, ...data };
//     }
//     return chat;
//   })
// );
