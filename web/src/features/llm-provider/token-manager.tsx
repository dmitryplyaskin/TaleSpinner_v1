import { Button, Flex, Input, Stack, Text } from "@chakra-ui/react";
import { useUnit } from "effector-react";
import { useMemo, useState } from "react";

import { llmProviderModel } from "@model/provider";
import { Dialog } from "@ui/dialog";

import type { LlmProviderId, LlmScope } from "@shared/types/llm";

type Props = {
  providerId: LlmProviderId;
  scope: LlmScope;
  scopeId: string;
};

export const TokenManager: React.FC<Props> = ({ providerId, scope, scopeId }) => {
  const [
    isOpen,
    setOpen,
    tokensByProviderId,
    runtimeByKey,
    createTokenFx,
    patchTokenFx,
    deleteTokenFx,
    loadTokensFx,
  ] = useUnit([
    llmProviderModel.$isTokenManagerOpen,
    llmProviderModel.tokenManagerOpened,
    llmProviderModel.$tokensByProviderId,
    llmProviderModel.$runtimeByScopeKey,
    llmProviderModel.createTokenFx,
    llmProviderModel.patchTokenFx,
    llmProviderModel.deleteTokenFx,
    llmProviderModel.loadTokensFx,
  ]);

  const scopeKey = `${scope}:${scopeId}` as const;
  const runtime = runtimeByKey[scopeKey];
  const activeTokenId = runtime?.activeTokenId ?? null;
  const tokens = useMemo(
    () => tokensByProviderId[providerId] ?? [],
    [tokensByProviderId, providerId]
  );

  const [newName, setNewName] = useState("");
  const [newToken, setNewToken] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useMemo(() => tokens.find((t) => t.id === editingId) ?? null, [tokens, editingId]);
  const [editName, setEditName] = useState("");
  const [editToken, setEditToken] = useState("");

  const onClose = () => {
    setOpen(false);
    setEditingId(null);
    setNewName("");
    setNewToken("");
  };

  const startEdit = (id: string) => {
    const token = tokens.find((t) => t.id === id);
    if (!token) return;
    setEditingId(id);
    setEditName(token.name);
    setEditToken("");
  };

  const submitCreate = async () => {
    const name = newName.trim();
    const token = newToken.trim();
    if (!name || !token) return;

    const created = await createTokenFx({ providerId, name, token });
    setNewName("");
    setNewToken("");
    await loadTokensFx(providerId);

    llmProviderModel.tokenSelected({ scope, scopeId, tokenId: created.id });
  };

  const submitEdit = async () => {
    if (!editingId) return;
    const name = editName.trim();
    const token = editToken.trim();
    await patchTokenFx({ id: editingId, name: name || undefined, token: token || undefined });
    setEditingId(null);
    setEditToken("");
    await loadTokensFx(providerId);
  };

  const submitDelete = async (id: string) => {
    await deleteTokenFx(id);
    await loadTokensFx(providerId);
    if (id === activeTokenId) {
      llmProviderModel.tokenSelected({ scope, scopeId, tokenId: null });
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Token manager"
      size="lg"
      footer={
        <Flex justify="flex-end" gap={2}>
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </Flex>
      }
      showCloseButton
      closeOnEscape
      closeOnInteractOutside
    >
      <Stack gap={3}>
        <Text fontWeight="semibold">Добавить токен</Text>
        <Stack direction={{ base: "column", md: "row" }} gap={2}>
          <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input
            placeholder="Token"
            type="password"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
          />
          <Button onClick={submitCreate} disabled={!newName.trim() || !newToken.trim()}>
            Добавить
          </Button>
        </Stack>

        <Text fontWeight="semibold" mt={3}>
          Токены для `{providerId}`
        </Text>

        {tokens.length === 0 ? (
          <Text opacity={0.7}>Нет токенов. Добавьте первый токен выше.</Text>
        ) : (
          <Stack gap={2}>
            {tokens.map((t) => (
              <Flex key={t.id} gap={2} align="center" justify="space-between">
                <Stack gap={0}>
                  <Text fontWeight="medium">
                    {t.name} {t.id === activeTokenId ? "(active)" : ""}
                  </Text>
                  <Text fontSize="sm" opacity={0.75}>
                    {t.tokenHint}
                  </Text>
                </Stack>
                <Flex gap={2}>
                  <Button size="sm" variant="outline" onClick={() => startEdit(t.id)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" colorPalette="red" onClick={() => submitDelete(t.id)}>
                    Delete
                  </Button>
                </Flex>
              </Flex>
            ))}
          </Stack>
        )}

        {editing && (
          <Stack gap={2} mt={4} p={3} borderWidth="1px" borderRadius="md">
            <Text fontWeight="semibold">Редактировать токен</Text>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
            <Input
              value={editToken}
              onChange={(e) => setEditToken(e.target.value)}
              placeholder={`New token (leave empty to keep ${editing.tokenHint})`}
              type="password"
            />
            <Flex justify="flex-end" gap={2}>
              <Button variant="ghost" onClick={() => setEditingId(null)}>
                Отмена
              </Button>
              <Button onClick={submitEdit} disabled={!editName.trim() && !editToken.trim()}>
                Сохранить
              </Button>
            </Flex>
          </Stack>
        )}
      </Stack>
    </Dialog>
  );
};

