import { Engine } from './engine';

export abstract class Task {
  abstract engine: Engine;
  /** 1. parse prompt and options
   *  2. (chat only) parse messages, chat-options
   *  3. construct IMessage
   *  4. construct api options
   *  5. post request and print result
   */
  abstract run(selection: string, rawPrompt: string): Promise<void>;
}
