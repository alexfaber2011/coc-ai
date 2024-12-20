import * as os from 'os';
import * as fs from 'fs';
import * as ini from 'ini';

import { defaultEngineConfig } from './engine';
import {mergeDefault} from './utils';

export function getRoles() {
  let rolesConfigPath = defaultEngineConfig.rolesConfigPath;
  rolesConfigPath = rolesConfigPath.replace(/^~/, os.homedir())
  try {
    const content = fs.readFileSync(rolesConfigPath, 'utf-8');
    const roles: Record<string, IRoleConfig> = ini.parse(content);
    return roles;
  } catch (e) {
    console.error(`Error reading ini file: ${e}`);
    return null;
  }
}

export function parseTaskRole(rawPrompt: string, task?: 'chat' | 'complete' | 'edit' ): IRoleConfig {
  rawPrompt = rawPrompt.trim();
  let roleName = rawPrompt.split(' ')[0];
  if (!roleName.startsWith('/')) return { prompt: rawPrompt };
  roleName = roleName.slice(1);
  const roles = getRoles();
  const role = roles ? roles[roleName] : null;
  if (!role) return { prompt: rawPrompt };

  let prompt = rawPrompt.slice(roleName.length).trim();
  if (role.prompt) prompt = role.prompt + ':\n' + prompt;

  let options = role.options ? role.options : {};
  if (task) {
    const taskOptions = role[`options-${task}`];
    if (taskOptions) options = mergeDefault(options, taskOptions);
  }
  return { prompt, options };
}
