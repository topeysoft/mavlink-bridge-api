export interface ParsedCommand {
  command: string;
  subcommand?: string | undefined;
  args: string[];
  options: Record<string, any>;
}

export class CommandParser {
  /**
   * Parse a command line input into structured components
   */
  static parse (input: string): ParsedCommand | null {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    // Split by spaces but respect quoted strings
    const parts = this.splitCommandLine(trimmed);
    if (parts.length === 0) {
      return null;
    }

    const command = parts[0]?.toLowerCase();
    if (!command) {
      return null;
    }
    let subcommand: string | undefined;
    const args: string[] = [];
    const options: Record<string, any> = {};

    // Check if second part is a subcommand (doesn't start with -)
    let startIndex = 1;
    if (parts.length > 1 && parts[1] && !parts[1].startsWith('-')) {
      subcommand = parts[1].toLowerCase();
      startIndex = 2;
    }

    // Parse remaining parts
    for (let i = startIndex; i < parts.length; i++) {
      const part = parts[i];

      if (part && part.startsWith('--')) {
        // Long option
        const [key, value] = this.parseOption(part.substring(2));
        options[key] = value;
      } else if (part && part.startsWith('-')) {
        // Short option(s)
        const flags = part.substring(1);
        for (const flag of flags) {
          options[flag] = true;
        }
      } else if (part) {
        // Regular argument
        args.push(part);
      }
    }

    return {
      command,
      subcommand,
      args,
      options
    };
  }

  /**
   * Split command line respecting quoted strings
   */
  private static splitCommandLine (input: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if ((char === '"' || char === "'") && (!inQuotes || char === quoteChar)) {
        if (inQuotes) {
          inQuotes = false;
          quoteChar = '';
        } else {
          inQuotes = true;
          quoteChar = char;
        }
        continue;
      }

      if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Parse an option into key-value pair
   */
  private static parseOption (option: string): [string, any] {
    const equalIndex = option.indexOf('=');

    if (equalIndex === -1) {
      return [option, true];
    }

    const key = option.substring(0, equalIndex);
    const value = option.substring(equalIndex + 1);

    // Try to parse as number or boolean
    if (value === 'true') return [key, true];
    if (value === 'false') return [key, false];

    const num = Number(value);
    if (!isNaN(num)) return [key, num];

    return [key, value];
  }

  /**
   * Build a command string from components
   */
  static build (command: string, subcommand?: string, args?: string[], options?: Record<string, any>): string {
    const parts = [command];

    if (subcommand) {
      parts.push(subcommand);
    }

    if (args && args.length > 0) {
      parts.push(...args);
    }

    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (key.length === 1) {
          // Short option
          if (value === true) {
            parts.push(`-${key}`);
          } else {
            parts.push(`-${key}`, String(value));
          }
        } else {
          // Long option
          if (value === true) {
            parts.push(`--${key}`);
          } else {
            parts.push(`--${key}=${value}`);
          }
        }
      });
    }

    return parts.join(' ');
  }
}