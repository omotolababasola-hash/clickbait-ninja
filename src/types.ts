export interface SummaryRequest {
  type: 'SUMMARIZE_URL';
  url: string;
  timestamp: number;
}

export interface SummaryResponse {
  success: boolean;
  summary?: string;
  error?: string;
  cached: boolean;
}

export interface CacheEntry {
  summary: string;
  timestamp: number;
  url: string;
}

export interface TooltipConfig {
  maxWidth: number;
  maxHeight: number;
  padding: number;
  borderRadius: number;
  zIndex: number;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface Message {
  type: string;
  [key: string]: any;
}

export interface NetworkError extends Error {
  code?: string;
  status?: number;
}

export class NetworkErrorImpl extends Error implements NetworkError {
  code?: string;
  status?: number;
  
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'NetworkError';
    if (status !== undefined) {
      this.status = status;
    }
    if (code !== undefined) {
      this.code = code;
    }
  }
}

export interface SummarizerError extends Error {
  reason?: 'unavailable' | 'model_download' | 'processing_failed';
}

export interface PermissionError extends Error {
  permission?: string;
}

export const TIMING_CONSTANTS = {
  HOVER_DETECTION_TIMEOUT: 100,
  CONTENT_FETCH_TIMEOUT: 3000,
  TOOLTIP_SHOW_DELAY: 200,
  TOOLTIP_HIDE_DELAY: 100,
  CACHE_EXPIRATION: 10 * 60 * 1000,
} as const;

export const PERFORMANCE_LIMITS = {
  MAX_CONCURRENT_REQUESTS: 3,
  MAX_MEMORY_USAGE: 50 * 1024 * 1024,
  MAX_CONTENT_SIZE: 1024 * 1024,
  MAX_SUMMARY_SENTENCES: 5,
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error',
  CONTENT_BLOCKED: 'Content blocked by site',
  CONTENT_UNAVAILABLE: 'Unable to load content',
  SUMMARIZATION_FAILED: 'Content cannot be summarized',
  AUTH_REQUIRED: 'Content requires authentication',
  TEMPORARY_ERROR: 'Temporary error occurred',
  LOADING: 'Loading summary...',
} as const;

export const DEFAULT_TOOLTIP_CONFIG: TooltipConfig = {
  maxWidth: 300,
  maxHeight: 200,
  padding: 12,
  borderRadius: 8,
  zIndex: 10000,
  backgroundColor: '#ffffff',
  borderColor: '#e0e0e0',
  textColor: '#333333',
};

export const SUMMARIZER_CONFIG = {
  type: 'tldr' as const,
  format: 'plain-text' as const,
  length: 'long' as const,
  sharedContext: 'This is a webpage that a user wants to preview before visiting',
} as const;

export const VALID_URL_PATTERN = /^https?:\/\/.+/i;

export const MESSAGE_TYPES = {
  SUMMARIZE_URL: 'SUMMARIZE_URL',
  CANCEL_REQUEST: 'CANCEL_REQUEST',
  CLEAR_CACHE: 'CLEAR_CACHE',
} as const;