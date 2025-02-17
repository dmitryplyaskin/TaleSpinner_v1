import React from 'react';
import { OpenRouterConfig, OpenRouterModel, getOpenRouterModels } from '../../../api/openRouter';
import { VStack } from '@chakra-ui/react';

import { Select } from 'chakra-react-select';

interface APIProviderTabProps {}

export const APIProviderTab: React.FC<APIProviderTabProps> = () => {
	// useEffect(() => {
	// 	const fetchModels = async () => {
	// 		try {
	// 			setLoading(true);
	// 			const modelsList = await getOpenRouterModels();
	// 			setModels(modelsList);
	// 		} catch (error) {
	// 			console.error('Error fetching models:', error);
	// 		} finally {
	// 			setLoading(false);
	// 		}
	// 	};

	// 	if (config?.apiKey) {
	// 		fetchModels();
	// 	}
	// }, [config?.apiKey]);

	const options = [
		{
			label: 'Other API',
			options: [
				{ value: 'openrouter', label: 'OpenRouter' },
				{ value: 'textgenweb', label: 'Text Generation WebUI' },
			],
		},
		{
			label: 'Official API Providers',
			options: [
				{ value: 'openai', label: 'OpenAI' },
				{ value: 'googleaistudio', label: 'Google AI Studio' },
				{ value: 'anthropic', label: 'Anthropic' },
				{ value: 'mistralai', label: 'Mistral AI' },
				{ value: 'custom', label: 'Custom API (OpenAI API)' },
			],
		},
	];

	return (
		<VStack gap={6} align="stretch">
			<Select options={options} />

			{/* <FormAutocomplete name="provider" label="API Provider" options={options} disableFilterOptions />

				<Text>В настоящее время поддерживается только OpenRouter</Text>

				<FormInput label="API Key" inputProps={{ type: 'password' }} name="apiKey" placeholder="Введите API ключ" />
				{provider.includes('openrouter') && (
					<FormAutocomplete
						name="openRouterModel"
						label="Model"
						options={models.map((model) => ({
							label: model.name,
							value: model.id,
						}))}
						disableFilterOptions
					/>
				)} */}

			{/* {loading && <FormHelperText>Загрузка списка моделей...</FormHelperText>}
        {!config?.apiKey && (
          <FormHelperText>
            Введите API ключ для загрузки списка моделей
          </FormHelperText>
        )} */}
			{/* </FormControl> */}
		</VStack>
	);
};
