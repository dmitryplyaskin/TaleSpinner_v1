import React, { useEffect, useState } from 'react';
import { OpenRouterConfig, OpenRouterModel, getOpenRouterModels } from '../../api/openRouter';
import { VStack, Input, Text } from '@chakra-ui/react';

import { FormProvider, useForm } from 'react-hook-form';
import { Autocomplete } from '@ui/chakra-core-ui/autocomplete';

interface APIProviderTabProps {
	config: OpenRouterConfig | null;
	onConfigChange: (config: OpenRouterConfig) => void;
}

export const APIProviderTab: React.FC<APIProviderTabProps> = ({ config, onConfigChange }) => {
	const methods = useForm({ defaultValues: { provider: 'openrouter' } });

	const [models, setModels] = useState<OpenRouterModel[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const fetchModels = async () => {
			try {
				setLoading(true);
				const modelsList = await getOpenRouterModels();
				setModels(modelsList);
			} catch (error) {
				console.error('Error fetching models:', error);
			} finally {
				setLoading(false);
			}
		};

		if (config?.apiKey) {
			fetchModels();
		}
	}, [config?.apiKey]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		if (config) {
			onConfigChange({
				...config,
				[e.target.name]: e.target.value,
			});
		}
	};

	const options = [
		{ value: 'openrouter', label: 'OpenRouter' },
		{ value: 'openai', label: 'OpenAI' },
	];

	return (
		<FormProvider {...methods}>
			<VStack gap={6} align="stretch">
				{/* <AutoComplete openOnFocus>
					<AutoCompleteInput variant="subtle" />
					<AutoCompleteList>
						{options.map(({ label, value }, cid) => (
							<AutoCompleteItem key={`option-${cid}`} value={value} textTransform="capitalize">
								{label}
							</AutoCompleteItem>
						))}
					</AutoCompleteList>
				</AutoComplete> */}
				<Autocomplete options={options} />

				{/* <FormControl> */}
				{/* <Select
					name="provider"
					label="API Provider"
					placeholder="Выберите провайдера"
					options={[
						{ value: 'openrouter', label: 'OpenRouter' },
						{ value: 'openai', label: 'OpenAI' },
					]}
					isClearable
					// isMulti
					// isDisabled
				/> */}
				{/* <Text>API Provider</Text>
      <SelectRoot value="openrouter" disabled size="md" variant="outline">
        <SelectTrigger>
          <SelectValueText>OpenRouter</SelectValueText>
        </SelectTrigger>
      </SelectRoot> */}
				<Text>В настоящее время поддерживается только OpenRouter</Text>
				{/* </FormControl> */}

				{/* <FormControl> */}
				<Text>API Key</Text>
				<Input
					type="password"
					name="apiKey"
					value={config?.apiKey || ''}
					onChange={handleInputChange}
					placeholder="Введите API ключ"
					size="md"
				/>
				{/* </FormControl> */}

				{/* <FormControl> */}
				{/* <Text>Model</Text>
      <SelectRoot
        name="modelId"
        value={config?.modelId || ""}
        onChange={(value) =>
          handleInputChange({
            target: { name: "modelId", value },
          } as React.ChangeEvent<HTMLSelectElement>)
        }
        disabled={loading || !config?.apiKey}
        size="md"
        variant="outline"
      >
        <SelectTrigger>
          <SelectValueText placeholder="Выберите модель" />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem
              key={model.id}
              item={{
                label: `${model.name} (${model.pricing.prompt} / ${model.pricing.completion})`,
                value: model.id,
              }}
            >
              {model.name} ({model.pricing.prompt} / {model.pricing.completion})
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot> */}
				{/* {loading && <FormHelperText>Загрузка списка моделей...</FormHelperText>}
        {!config?.apiKey && (
          <FormHelperText>
            Введите API ключ для загрузки списка моделей
          </FormHelperText>
        )} */}
				{/* </FormControl> */}
			</VStack>
		</FormProvider>
	);
};
