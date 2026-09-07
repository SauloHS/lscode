export type Command = {
  id: string;
  label: string;
  keybinding?: string;
  run: () => void | Promise<void>;
};

const commands = new Map<string, Command>();

export function register(cmd: Command): void {
  commands.set(cmd.id, cmd);
}

export function getCommands(): Command[] {
  return [...commands.values()];
}

export function runCommand(id: string): void {
  void commands.get(id)?.run();
}
