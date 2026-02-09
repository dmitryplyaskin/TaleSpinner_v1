import { Button, Divider, Flex, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { useUnit } from "effector-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { llmProviderModel } from "@model/provider";
import { Dialog } from "@ui/dialog";

import type { LlmProviderId, LlmScope } from "@shared/types/llm";

type Props = {
  providerId: LlmProviderId;
  scope: LlmScope;
  scopeId: string;
};

export const TokenManager: React.FC<Props> = ({ providerId, scope, scopeId }) => {
  const { t } = useTranslation();
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

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (open) return;
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
      open={isOpen}
      onOpenChange={handleOpenChange}
      title={t("tokenManager.title")}
      size="lg"
      footer={
        <Flex justify="flex-end" gap={2}>
          <Button variant="subtle" onClick={() => handleOpenChange(false)}>
            {t("common.close")}
          </Button>
        </Flex>
      }
      showCloseButton
      closeOnEscape
      closeOnInteractOutside
    >
      <Stack gap="sm">
        <Text fw={600}>{t("tokenManager.addToken")}</Text>
        <Stack gap="xs">
          <TextInput placeholder={t("tokenManager.fields.name")} value={newName} onChange={(e) => setNewName(e.currentTarget.value)} />
          <PasswordInput placeholder={t("tokenManager.fields.token")} value={newToken} onChange={(e) => setNewToken(e.currentTarget.value)} />
          <Flex justify="flex-end">
            <Button onClick={submitCreate} disabled={!newName.trim() || !newToken.trim()}>
              {t("common.add")}
            </Button>
          </Flex>
        </Stack>

        <Divider />

        <Text fw={600}>{t("tokenManager.tokensFor", { providerId })}</Text>

        {tokens.length === 0 ? (
          <Text c="dimmed">{t("tokenManager.empty")}</Text>
        ) : (
          <Stack gap="xs">
            {tokens.map((token) => (
              <Flex key={token.id} gap={2} align="center" justify="space-between">
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Text fw={500}>
                    {token.name} {token.id === activeTokenId ? t("tokenManager.activeSuffix") : ""}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {token.tokenHint}
                  </Text>
                </Stack>
                <Flex gap={2}>
                  <Button size="sm" variant="outline" onClick={() => startEdit(token.id)}>
                    {t("common.edit")}
                  </Button>
                  <Button size="sm" variant="outline" color="red" onClick={() => submitDelete(token.id)}>
                    {t("common.delete")}
                  </Button>
                </Flex>
              </Flex>
            ))}
          </Stack>
        )}

        {editing && (
          <Stack gap="xs" mt="md" p="md" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
            <Text fw={600}>{t("tokenManager.editToken")}</Text>
            <TextInput value={editName} onChange={(e) => setEditName(e.currentTarget.value)} placeholder={t("tokenManager.fields.name")} />
            <PasswordInput
              value={editToken}
              onChange={(e) => setEditToken(e.currentTarget.value)}
              placeholder={t("tokenManager.fields.newTokenPlaceholder", { hint: editing.tokenHint })}
            />
            <Flex justify="flex-end" gap={2}>
              <Button variant="subtle" onClick={() => setEditingId(null)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={submitEdit} disabled={!editName.trim() && !editToken.trim()}>
                {t("common.save")}
              </Button>
            </Flex>
          </Stack>
        )}
      </Stack>
    </Dialog>
  );
};

