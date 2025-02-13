import React, { useEffect, useState } from 'react';
import { OpenRouterConfig, OpenRouterModel, getOpenRouterModels } from '../../api/openRouter';
import { VStack, Text } from '@chakra-ui/react';

import { FormProvider, useForm } from 'react-hook-form';
import { FormInput } from '@ui/form-components';

interface APIProviderTabProps {
	config: OpenRouterConfig | null;
}

export const APIProviderTab: React.FC<APIProviderTabProps> = ({ config }) => {
	const methods = useForm({
		defaultValues: {
			provider: ['openrouter'],
			openRouterModel: 'deepseek/deepseek-chat',
			apiKey: config?.apiKey || '',
		},
	});

	const provider = methods.watch('provider');

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

	const options = [
		{ value: 'openrouter', label: 'OpenRouter' },
		{ value: 'openai', label: 'OpenAI' },
	];

	return (
		<FormProvider {...methods}>
			<VStack gap={6} align="stretch">
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
		</FormProvider>
	);
};
