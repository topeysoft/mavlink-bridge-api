import { Command } from './types';

export class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private aliases: Map<string, string> = new Map();

  /**
   * Register a new command
   */
  register(command: Command): void {
    this.commands.set(command.name, command);
    
    // Register aliases
    if (command.aliases) {
      command.aliases.forEach(alias => {
        this.aliases.set(alias, command.name);
      });
    }
  }

  /**
   * Get a command by name or alias
   */
  get(nameOrAlias: string): Command | undefined {
    const commandName = this.aliases.get(nameOrAlias) || nameOrAlias;
    return this.commands.get(commandName);
  }

  /**
   * Get all registered commands
   */
  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getByCategory(category: string): Command[] {
    return this.getAll().filter(cmd => cmd.category === category);
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.commands.forEach(cmd => {
      if (cmd.category) {
        categories.add(cmd.category);
      }
    });
    return Array.from(categories).sort();
  }

  /**
   * Check if a command exists
   */
  has(nameOrAlias: string): boolean {
    return this.commands.has(nameOrAlias) || this.aliases.has(nameOrAlias);
  }

  /**
   * Get command suggestions for autocomplete
   */
  getSuggestions(partial: string): string[] {
    const suggestions: string[] = [];
    
    // Add matching command names
    this.commands.forEach((cmd, name) => {
      if (name.startsWith(partial)) {
        suggestions.push(name);
      }
    });
    
    // Add matching aliases
    this.aliases.forEach((cmdName, alias) => {
      if (alias.startsWith(partial) && !suggestions.includes(alias)) {
        suggestions.push(alias);
      }
    });
    
    return suggestions.sort();
  }

  /**
   * Clear all registered commands
   */
  clear(): void {
    this.commands.clear();
    this.aliases.clear();
  }
}