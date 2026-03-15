import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { TranslateTextInput, TranslationProviderPort } from './translation-provider.port';

@Injectable()
export class OpenAiTranslationProviderAdapter implements TranslationProviderPort {
  private readonly clientCache = new Map<string, OpenAI>();

  async translateText(input: TranslateTextInput): Promise<{ translatedText: string }> {
    const completion = await (await this.getClient(input.apiKey)).chat.completions.create({
      model: input.model,
      temperature: 0,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content:
            'You are a professional business translation engine. Return only the translated text without explanations.',
        },
        {
          role: 'user',
          content: [
            `Translate this text from ${input.sourceLanguage} to ${input.targetLanguage}.`,
            'Keep business tone, preserve punctuation and formatting, and do not add extra content.',
            `Text:\n${input.text}`,
          ].join('\n\n'),
        },
      ],
    });

    const translatedText = completion.choices[0]?.message?.content?.trim() || '';
    return { translatedText };
  }

  private async getClient(apiKey: string): Promise<OpenAI> {
    if (this.clientCache.has(apiKey)) {
      return this.clientCache.get(apiKey) as OpenAI;
    }
    const client = new OpenAI({ apiKey });
    this.clientCache.set(apiKey, client);
    return client;
  }
}
