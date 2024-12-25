import { workspace, window } from 'coc.nvim';
import * as os from 'os';
import * as fs from 'fs';
import { TextDecoder } from 'util';
import { AbortController, mergeDefault } from './utils';

const config = workspace.getConfiguration('coc-ai');
export const defaultEngineConfig = config.get<IEngineConfig>('global')!;

export class Engine {
  config: IEngineConfig;
  controller: AbortController;
  #token?: IToken;

  constructor(public configName: 'chat' | 'edit' | 'complete') {
    this.config = this.#initEngineConfig()
    this.controller = new AbortController();
  }

  /**
   * Merge and normalize: coc-ai.[name] & coc-ai.global
   */
  #initEngineConfig() {
    let specificConfig = config.get<Partial<IEngineConfig>>(this.configName)!;
    let engineConfig = mergeDefault(defaultEngineConfig, specificConfig);
    return this.#normalizeEngineConfig(engineConfig);
  }

  #normalizeEngineConfig(engineConfig: IEngineConfig): IEngineConfig {
    engineConfig.tokenPath = engineConfig.tokenPath.replace(/^~/, os.homedir());
    if (typeof engineConfig.initialPrompt === 'string') {
      engineConfig.initialPrompt = engineConfig.initialPrompt.split('\n');
    }
    return engineConfig;
  }

  mergeOptions(override: IOptions = {}) {
    // 1. chat options 2. role options
    if (!Object.keys(override).length) return this.config;
    let mergedConfig = mergeDefault(this.config, override);
    return this.#normalizeEngineConfig(mergedConfig);
  }

  get token(): IToken {
    if (this.#token === undefined) {
      let apiKeyParamValue = process.env.OPENAI_API_KEY;
      try {
        apiKeyParamValue = apiKeyParamValue || fs.readFileSync(this.config.tokenPath, 'utf-8');
      } catch (error) {}
      if (!apiKeyParamValue) {
        throw new Error("Missing OpenAI API key");
      }

      const elements = apiKeyParamValue.trim().split(',');
      const apiKey = elements[0].trim();
      const orgId = elements.length > 1 ? elements[1].trim() : null;
      this.#token = { apiKey, orgId };
    }
    return this.#token
  }

  async * generate(requestConfig: IEngineConfig, data: IAPIOptions) {
    const headers = {
      'Content-Type': 'application/json',
      ...(requestConfig.requiresAuth && {
        'Authorization': `Bearer ${this.token.apiKey}`,
        ...(this.token.orgId && { 'OpenAI-Organization': this.token.orgId })
      })
    };
    const body = JSON.stringify(data)

    if (!this.controller.signal.aborted) this.controller.abort();
    this.controller = new AbortController();
    let timeout = setTimeout(() => {
      this.controller.abort()
    }, this.config.requestTimeout * 1000);

    try {
      const resp = await fetch(requestConfig.endpointUrl, {
        method: 'post',
        body,
        headers,
        signal: this.controller.signal,
      });

      if (!resp.ok || resp.body === null) {
        window.showErrorMessage(`HTTPError ${resp.status}: ${resp.statusText}`);
        return;
      }
      clearTimeout(timeout);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done || this.controller.signal.aborted) break;

        const data = decoder.decode(value, {stream: true});
        const lines = data.split('\n').filter(line => line.trim() !== '');

        for (let line of lines) {
          line = line.startsWith('data: ') ? line.slice('data: '.length) : line;
          if (line === '[DONE]') continue;

          try {
            if (buffer) {
              line = buffer + line;
              buffer = '';
            }
            const parsed = JSON.parse(line);
            if (parsed.choices?.[0]?.delta?.content) {
              yield parsed.choices[0].delta.content as string;
            }
          } catch (error) {
            if (buffer) {
              window.showErrorMessage(`Error during decoding:${error}`);
            } else {
              buffer += line;  // in case json row scattered across two chunks
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        window.showErrorMessage('Request aborted...')
      } else { throw error };
    };
  }
}
