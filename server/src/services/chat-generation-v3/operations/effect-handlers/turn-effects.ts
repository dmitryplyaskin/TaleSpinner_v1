import { updatePartPayloadText } from "../../../chat-entry-parts/parts-repository";

import type { UserTurnTarget } from "../../contracts";

export async function persistUserTurnText(params: {
  target: UserTurnTarget | undefined;
  text: string;
}): Promise<void> {
  const target = params.target;
  if (!target) {
    throw new Error("User turn target is required for turn.user.* effect");
  }

  await updatePartPayloadText({
    partId: target.userMainPartId,
    payloadText: params.text,
    payloadFormat: "markdown",
  });
}
