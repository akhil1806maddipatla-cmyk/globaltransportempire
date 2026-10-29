export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface DiagnosticLogEntry {
  timestamp: number;
  level: LogLevel;
  context: string;
  message: string;
  details?: unknown;
}

export class Logger {
  private static level: LogLevel = LogLevel.INFO;
  private static throttleMap = new Map<string, number>();
  private static recentDiagnostics: DiagnosticLogEntry[] = [];
  private static readonly MAX_DIAGNOSTIC_HISTORY = 100;

  private readonly context: string;

  constructor(context: string) {
    this.context = context;
  }

  public static setLogLevel(level: LogLevel): void {
    Logger.level = level;
  }

  public static getLogLevel(): LogLevel {
    return Logger.level;
  }

  public static isDebugEnabled(): boolean {
    return Logger.level <= LogLevel.DEBUG;
  }

  public static getRecentDiagnostics(): readonly DiagnosticLogEntry[] {
    return [...Logger.recentDiagnostics];
  }

  public static clearDiagnostics(): void {
    Logger.recentDiagnostics = [];
    Logger.throttleMap.clear();
  }

  private static recordEntry(
    level: LogLevel,
    context: string,
    message: string,
    details?: unknown
  ): void {
    if (Logger.recentDiagnostics.length >= Logger.MAX_DIAGNOSTIC_HISTORY) {
      Logger.recentDiagnostics.shift();
    }
    Logger.recentDiagnostics.push({
      timestamp: Date.now(),
      level,
      context,
      message,
      details,
    });
  }

  public debug(message: string, ...args: unknown[]): void {
    if (Logger.level <= LogLevel.DEBUG) {
      console.debug(`[${this.context}] [DEBUG] ${message}`, ...args);
    }
  }

  public info(message: string, ...args: unknown[]): void {
    if (Logger.level <= LogLevel.INFO) {
      console.info(`[${this.context}] [INFO] ${message}`, ...args);
    }
  }

  public warn(message: string, ...args: unknown[]): void {
    if (Logger.level <= LogLevel.WARN) {
      console.warn(`[${this.context}] [WARN] ${message}`, ...args);
      Logger.recordEntry(LogLevel.WARN, this.context, message, args);
    }
  }

  public error(message: string, ...args: unknown[]): void {
    if (Logger.level <= LogLevel.ERROR) {
      console.error(`[${this.context}] [ERROR] ${message}`, ...args);
      Logger.recordEntry(LogLevel.ERROR, this.context, message, args);
    }
  }

  /**
   * Logs a warning at most once per intervalMs for the given key,
   * preventing console floods from recurring animation or simulation frames.
   */
  public warnThrottled(
    throttleKey: string,
    intervalMs: number = 3000,
    message: string,
    ...args: unknown[]
  ): void {
    if (Logger.level > LogLevel.WARN) return;
    const now = Date.now();
    const last = Logger.throttleMap.get(throttleKey) || 0;
    if (now - last >= intervalMs) {
      Logger.throttleMap.set(throttleKey, now);
      console.warn(`[${this.context}] [WARN] ${message}`, ...args);
      Logger.recordEntry(LogLevel.WARN, this.context, message, args);
    }
  }

  /**
   * Logs an error at most once per intervalMs for the given key.
   */
  public errorThrottled(
    throttleKey: string,
    intervalMs: number = 3000,
    message: string,
    ...args: unknown[]
  ): void {
    if (Logger.level > LogLevel.ERROR) return;
    const now = Date.now();
    const last = Logger.throttleMap.get(throttleKey) || 0;
    if (now - last >= intervalMs) {
      Logger.throttleMap.set(throttleKey, now);
      console.error(`[${this.context}] [ERROR] ${message}`, ...args);
      Logger.recordEntry(LogLevel.ERROR, this.context, message, args);
    }
  }
}
