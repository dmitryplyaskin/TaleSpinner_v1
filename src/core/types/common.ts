export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface BaseConfig {
  [key: string]: unknown;
}

export interface ServiceOptions {
  dataDir?: string;
  logger?: Logger;
}

export interface Logger {
  info: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
}
