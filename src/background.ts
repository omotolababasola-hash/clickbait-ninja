import {
  SummaryRequest,
  SummaryResponse,
  Message,
  MESSAGE_TYPES,
  ERROR_MESSAGES,
  VALID_URL_PATTERN,
  TIMING_CONSTANTS,
  PERFORMANCE_LIMITS,
  SUMMARIZER_CONFIG,
  NetworkError,
  NetworkErrorImpl,
  SummarizerError,
  CacheEntry,
} from './types';

declare global {
  interface Window {
    ai?: {
      summarizer?: {
        capabilities(): Promise<{ available: string }>;
        create(config: typeof SUMMARIZER_CONFIG): Promise<AISummarizer>;
      };
    };
  }
  
  interface AISummarizer {
    summarize(text: string): Promise<string>;
    destroy(): void;
  }
}

let summarizerInstance: AISummarizer | null = null;
let summarizerInitializing = false;
const summaryCache = new Map<string, CacheEntry>();
const activeRequests = new Map<string, AbortController>();
let activeRequestCount = 0;

interface MessageHandler {
  [key: string]: (message: any, sender: chrome.runtime.MessageSender) => Promise<SummaryResponse>;
}

const messageHandlers: MessageHandler = {
  [MESSAGE_TYPES.SUMMARIZE_URL]: handleSummarizeUrl,
  [MESSAGE_TYPES.CANCEL_REQUEST]: handleCancelRequest,
  [MESSAGE_TYPES.CLEAR_CACHE]: handleClearCache,
};

chrome.runtime.onMessage.addListener((
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: SummaryResponse) => void
) => {
  if (!isValidMessage(message)) {
    sendResponse({
      success: false,
      error: ERROR_MESSAGES.TEMPORARY_ERROR,
      cached: false,
    });
    return false;
  }

  const handler = messageHandlers[message.type];
  if (!handler) {
    sendResponse({
      success: false,
      error: ERROR_MESSAGES.TEMPORARY_ERROR,
      cached: false,
    });
    return false;
  }

  handler(message, sender)
    .then(response => sendResponse(response))
    .catch(() => {
      sendResponse({
        success: false,
        error: ERROR_MESSAGES.TEMPORARY_ERROR,
        cached: false,
      });
    });

  return true;
});

function isValidMessage(message: any): message is Message {
  return (
    message &&
    typeof message === 'object' &&
    typeof message.type === 'string' &&
    Object.values(MESSAGE_TYPES).includes(message.type as any)
  );
}

function isValidSummaryRequest(message: any): message is SummaryRequest {
  return (
    message.type === MESSAGE_TYPES.SUMMARIZE_URL &&
    typeof message.url === 'string' &&
    typeof message.timestamp === 'number' &&
    VALID_URL_PATTERN.test(message.url)
  );
}
function getCachedSummary(url: string): string | null {
  const entry = summaryCache.get(url);

  if (!entry) {
    return null;
  }

  const age = Date.now() - entry.timestamp;

  if (age > TIMING_CONSTANTS.CACHE_EXPIRATION) {
    summaryCache.delete(url);
    return null;
  }

  return entry.summary;
}

function setCachedSummary(url: string, summary: string): void {
  summaryCache.set(url, {
    summary,
    timestamp: Date.now(),
    url,
  });

  cleanupCache();
}

function cleanupCache(): void {
  const memoryUsage = estimateCacheMemoryUsage();

  if (memoryUsage <= PERFORMANCE_LIMITS.MAX_MEMORY_USAGE) {
    return;
  }

  const entries = Array.from(summaryCache.entries())
    .map(([url, entry]) => ({ url, entry }))
    .sort((a, b) => a.entry.timestamp - b.entry.timestamp);

  let currentMemory = memoryUsage;

  for (const { url } of entries) {
    if (currentMemory <= PERFORMANCE_LIMITS.MAX_MEMORY_USAGE) {
      break;
    }

    const entry = summaryCache.get(url);
    if (entry) {
      const entrySize = estimateEntrySize(entry);
      summaryCache.delete(url);
      currentMemory -= entrySize;
    }
  }
}

function estimateCacheMemoryUsage(): number {
  let totalSize = 0;

  for (const entry of summaryCache.values()) {
    totalSize += estimateEntrySize(entry);
  }

  return totalSize;
}

function estimateEntrySize(entry: CacheEntry): number {
  return (
    entry.url.length * 2 +
    entry.summary.length * 2 +
    8 +
    100
  );
}

async function handleSummarizeUrl(
  message: any,
  _sender: chrome.runtime.MessageSender
): Promise<SummaryResponse> {
  if (!isValidSummaryRequest(message)) {
    return {
      success: false,
      error: ERROR_MESSAGES.TEMPORARY_ERROR,
      cached: false,
    };
  }

  const cachedSummary = getCachedSummary(message.url);
  if (cachedSummary) {
    return {
      success: true,
      summary: cachedSummary,
      cached: true,
    };
  }

  if (activeRequestCount >= PERFORMANCE_LIMITS.MAX_CONCURRENT_REQUESTS) {
    return {
      success: false,
      error: ERROR_MESSAGES.TEMPORARY_ERROR,
      cached: false,
    };
  }

  const requestId = `${message.url}-${message.timestamp}`;
  const controller = new AbortController();
  activeRequests.set(requestId, controller);
  activeRequestCount++;

  try {
    const content = await fetchPageContent(message.url, controller.signal);
    const summary = await summarizeContent(content, message.url);

    setCachedSummary(message.url, summary);

    return {
      success: true,
      summary,
      cached: false,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        success: false,
        error: ERROR_MESSAGES.TEMPORARY_ERROR,
        cached: false,
      };
    }

    if (error instanceof NetworkErrorImpl) {
      return {
        success: false,
        error: getNetworkErrorMessage(error),
        cached: false,
      };
    }

    if (isSummarizerError(error)) {
      return {
        success: false,
        error: getSummarizerErrorMessage(error),
        cached: false,
      };
    }

    return {
      success: false,
      error: ERROR_MESSAGES.TEMPORARY_ERROR,
      cached: false,
    };
  } finally {
    activeRequests.delete(requestId);
    activeRequestCount--;
  }
}

async function handleCancelRequest(
  message: any,
  _sender: chrome.runtime.MessageSender
): Promise<SummaryResponse> {
  if (message.url && message.timestamp) {
    const requestId = `${message.url}-${message.timestamp}`;
    const controller = activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      activeRequests.delete(requestId);
      activeRequestCount--;
    }
  } else {
    cancelAllRequests();
  }
  
  return {
    success: true,
    cached: false,
  };
}

async function handleClearCache(
  _message: any,
  _sender: chrome.runtime.MessageSender
): Promise<SummaryResponse> {
  summaryCache.clear();
  cancelAllRequests();
  return {
    success: true,
    cached: false,
  };
}

function cancelAllRequests(): void {
  for (const controller of activeRequests.values()) {
    controller.abort();
  }
  activeRequests.clear();
  activeRequestCount = 0;
}

chrome.runtime.onSuspend.addListener(() => {
  cancelAllRequests();
  summaryCache.clear();
  if (summarizerInstance) {
    summarizerInstance.destroy();
    summarizerInstance = null;
  }
});

export {};

async function fetchPageContent(url: string, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMING_CONSTANTS.CONTENT_FETCH_TIMEOUT);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClickbaitNinja/1.0)',
      },
      mode: 'cors',
      credentials: 'omit',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw createNetworkError(response.status, response.statusText);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > PERFORMANCE_LIMITS.MAX_CONTENT_SIZE) {
      throw createNetworkError(413, 'Content too large');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw createNetworkError(500, 'Unable to read response');
    }

    let content = '';
    let totalBytes = 0;
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      totalBytes += value.length;
      if (totalBytes > PERFORMANCE_LIMITS.MAX_CONTENT_SIZE) {
        reader.cancel();
        break;
      }
      
      content += decoder.decode(value, { stream: true });
    }

    content += decoder.decode();

    if (!content.trim()) {
      throw createNetworkError(204, 'No content available');
    }

    return content;

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw createNetworkError(408, 'Request timeout');
    }
    
    if (error instanceof TypeError) {
      if (error.message.includes('CORS')) {
        throw createNetworkError(0, 'CORS blocked', 'CORS');
      }
      if (error.message.includes('Failed to fetch')) {
        throw createNetworkError(0, 'Network error', 'NETWORK');
      }
    }
    
    if (error instanceof NetworkErrorImpl) {
      throw error;
    }
    
    throw createNetworkError(500, 'Unknown fetch error');
  }
}

function createNetworkError(status: number, message: string, code?: string): NetworkErrorImpl {
  return new NetworkErrorImpl(message, status, code);
}

function getNetworkErrorMessage(error: NetworkError): string {
  if (error.code === 'CORS') {
    return ERROR_MESSAGES.CONTENT_BLOCKED;
  }
  
  if (error.code === 'NETWORK') {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  switch (error.status) {
    case 401:
    case 403:
      return ERROR_MESSAGES.AUTH_REQUIRED;
    case 404:
      return ERROR_MESSAGES.CONTENT_UNAVAILABLE;
    case 408:
      return ERROR_MESSAGES.NETWORK_ERROR;
    case 413:
      return ERROR_MESSAGES.CONTENT_UNAVAILABLE;
    case 204:
      return ERROR_MESSAGES.CONTENT_UNAVAILABLE;
    default:
      return ERROR_MESSAGES.CONTENT_UNAVAILABLE;
  }
}

async function initializeSummarizer(): Promise<AISummarizer> {
  if (summarizerInstance) {
    return summarizerInstance;
  }

  if (summarizerInitializing) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return initializeSummarizer();
  }

  summarizerInitializing = true;

  try {
    const ai = (self as any).ai;
    
    if (!ai?.summarizer) {
      throw createSummarizerError('unavailable', 'Summarizer API not available');
    }

    const capabilities = await ai.summarizer.capabilities();
    
    if (capabilities.available === 'no') {
      throw createSummarizerError('unavailable', 'Summarizer not available');
    }

    const instance = await ai.summarizer.create(SUMMARIZER_CONFIG);
    summarizerInstance = instance;
    
    return instance;
  } finally {
    summarizerInitializing = false;
  }
}

async function summarizeContent(content: string, _url: string): Promise<string> {
  const cleanedContent = extractTextContent(content);
  
  if (!cleanedContent.trim()) {
    throw createSummarizerError('processing_failed', 'No text content found');
  }

  const sentenceCount = countSentences(cleanedContent);
  
  if (sentenceCount <= PERFORMANCE_LIMITS.MAX_SUMMARY_SENTENCES) {
    return cleanedContent.trim();
  }

  try {
    const summarizer = await initializeSummarizer();
    const summary = await summarizer.summarize(cleanedContent);
    
    const limitedSummary = limitToSentences(summary, PERFORMANCE_LIMITS.MAX_SUMMARY_SENTENCES);
    
    return limitedSummary;
  } catch (error) {
    if (isSummarizerError(error)) {
      throw error;
    }
    
    return getFallbackSummary(cleanedContent);
  }
}

function extractTextContent(html: string): string {
  const tempDiv = new DOMParser().parseFromString(html, 'text/html');
  
  const scripts = tempDiv.querySelectorAll('script, style, noscript');
  scripts.forEach(el => el.remove());
  
  const textContent = tempDiv.body?.textContent || tempDiv.textContent || '';
  
  return textContent.replace(/\s+/g, ' ').trim();
}

function countSentences(text: string): number {
  const sentences = text.match(/[.!?]+/g);
  return sentences ? sentences.length : 0;
}

function limitToSentences(text: string, maxSentences: number): string {
  const sentencePattern = /[^.!?]+[.!?]+/g;
  const sentences = text.match(sentencePattern);
  
  if (!sentences || sentences.length <= maxSentences) {
    return text.trim();
  }
  
  return sentences.slice(0, maxSentences).join(' ').trim();
}

function getFallbackSummary(content: string): string {
  const sentences = content.match(/[^.!?]+[.!?]+/g);
  
  if (!sentences || sentences.length === 0) {
    const words = content.split(/\s+/).slice(0, 50);
    return words.join(' ') + '...';
  }
  
  const firstSentences = sentences.slice(0, PERFORMANCE_LIMITS.MAX_SUMMARY_SENTENCES);
  return firstSentences.join(' ').trim();
}

function createSummarizerError(reason: NonNullable<SummarizerError['reason']>, message: string): SummarizerError {
  const error = new Error(message) as SummarizerError;
  error.name = 'SummarizerError';
  error.reason = reason;
  return error;
}

function isSummarizerError(error: any): error is SummarizerError {
  return error && error.name === 'SummarizerError' && 'reason' in error;
}

function getSummarizerErrorMessage(error: SummarizerError): string {
  switch (error.reason) {
    case 'unavailable':
      return ERROR_MESSAGES.SUMMARIZATION_FAILED;
    case 'model_download':
      return ERROR_MESSAGES.LOADING;
    case 'processing_failed':
      return ERROR_MESSAGES.SUMMARIZATION_FAILED;
    default:
      return ERROR_MESSAGES.SUMMARIZATION_FAILED;
  }
}