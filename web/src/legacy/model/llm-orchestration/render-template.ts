import Handlebars from 'handlebars';

import { $currentAgentCard } from '@model/chat-service';
import { instructionsModel } from '@model/instructions';
import { userPersonsModel } from '@model/user-persons';

// Кэш для хранения скомпилированных шаблонов
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

Handlebars.registerHelper('eq', function (a, b) {
	return a === b;
});

// Функция компиляции с кэшированием
const compileWithCache = (templateString: string): HandlebarsTemplateDelegate => {
	if (!templateCache.has(templateString)) {
		try {
			const compiled = Handlebars.compile(templateString, { noEscape: true });
			templateCache.set(templateString, compiled);
		} catch (error) {
			console.error('Template compilation error:', error);
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Template compilation failed: ${message}`);
		}
	}
	return templateCache.get(templateString)!;
};

// Обработка ошибок при рендеринге
const safeRender = (template: HandlebarsTemplateDelegate, context: any): string => {
	try {
		return template(context);
	} catch (error) {
		console.error('Template rendering error:', error);
		const message = error instanceof Error ? error.message : String(error);
		return `[Rendering Error: ${message}]`;
	}
};

// Рекурсивная обработка с кэшированием и обработкой ошибок
const compileNestedTemplates = (data: any, context: any): any => {
	try {
		if (typeof data === 'string') {
			const template = compileWithCache(data);
			return safeRender(template, context);
		}

		if (Array.isArray(data)) {
			return data.map((item) => compileNestedTemplates(item, context));
		}

		if (typeof data === 'object' && data !== null) {
			return Object.fromEntries(
				Object.entries(data).map(([key, value]) => [key, compileNestedTemplates(value, context)]),
			);
		}

		return data;
	} catch (error) {
		console.error('Nested template processing error:', error);
		const message = error instanceof Error ? error.message : String(error);
		return `[Nested Processing Error: ${message}]`;
	}
};

export const renderTemplate = (content: string, customContext: Record<string, any> = {}): string => {
	try {
		const user = userPersonsModel.$selectedItem.getState();
		const char = $currentAgentCard.getState()?.metadata;
		const systemPrompt = instructionsModel.$selectedItem.getState();

		// Безопасное создание контекста
		const rawContext = {
			user: user?.name,
			persona: user?.type === 'default' ? user.contentTypeDefault : undefined,
			char: char?.name,
			description: char?.description,
			system: systemPrompt?.instruction,
			scenario: char?.scenario,
			personality: char?.personality,
			first_mes: char?.first_mes,
			mes_example: char?.mes_example,
			creator_notes: char?.creator_notes,
			system_prompt: char?.system_prompt,
			post_history_instructions: char?.post_history_instructions,
			...customContext,
		};

		// Обработка вложенных шаблонов
		const processedContext = compileNestedTemplates(rawContext, rawContext);

		// Компиляция основного шаблона
		const template = compileWithCache(content);
		const result = safeRender(template, processedContext);

		return result;
	} catch (error) {
		console.error('Global template error:', error);
		const message = error instanceof Error ? error.message : String(error);
		return `[Global Error: ${message}]`;
	}
};

