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
    return engineConfig;
  }

  mergeOptions(override: IOptions = {}) {
    // 1. chat options 2. role options
    if (!Object.keys(override).length) return this.config;
    let mergedConfig = mergeDefault(this.config, override);
    return this.#normalizeEngineConfig(mergedConfig);
  }

  get token(): IToken {
    let apiKeyParamValue: string = '';
    try {
      apiKeyParamValue = fs.readFileSync(this.config.tokenPath, 'utf-8');
    } catch (error) {}
    if (!apiKeyParamValue) {
      throw new Error("Missing API key");
    }

    const elements = apiKeyParamValue.trim().split(',');
    const apiKey = elements[0].trim();
    const orgId = elements.length > 1 ? elements[1].trim() : null;
    return { apiKey, orgId }
  }

  async #makeRequest(requestConfig: IEngineConfig, data: IAPIOptions) {
    this.config = requestConfig;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.config.requiresAuth && {
        'Authorization': `Bearer ${this.token.apiKey}`,
        ...(this.token.orgId && { 'OpenAI-Organization': this.token.orgId })
      })
    };
    const body = JSON.stringify(data);

    if (!this.controller.signal.aborted) this.controller.abort();
    this.controller = new AbortController();
    let timeout = setTimeout(() => {
      this.controller.abort()
    }, this.config.requestTimeout * 1000);

    const resp = await fetch(this.config.endpointUrl, {
      method: 'post',
      body,
      headers,
      signal: this.controller.signal,
    });
    clearTimeout(timeout);
    if (resp.status !== 200) {
      window.showErrorMessage(`HTTPError ${resp.status}: ${resp.statusText}`);
    }
    return resp
  }

  #parseLine(line: string) {
    const parsed = JSON.parse(line);
    if (parsed.choices?.[0]?.delta?.reasoning_content) {
      let chunk: IChunk = {
        type: 'reasoning_content',
        content: parsed.choices[0].delta.reasoning_content as string,
      };
      return chunk;
    } else {
      let chunk: IChunk = {
        type: 'content',
        content: parsed.choices[0].delta.content as string,
      };
      return chunk;
    }
  }

  async * generate(requestConfig: IEngineConfig, data: IAPIOptions) {
    const resp = await this.#makeRequest(requestConfig, data)
    if (!resp.body) return;

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
          yield this.#parseLine(line);
        } catch (error) {
          if (buffer) {
            window.showErrorMessage(`Error during decoding:${error}`);
          } else {
            buffer += line;  // in case json row scattered across two chunks
          }
        }
      }
    }
  }
}
