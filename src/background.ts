import {
  SummaryRequest,
  SummaryResponse,
  Message,
  MESSAGE_TYPES,
  ERROR_MESSAGES,
  VALID_URL_PATTERN,
  TIMING_CONSTANTS,
  PERFORMANCE_LIMITS,
  NetworkError,
  NetworkErrorImpl,
} from './types';

console.log('Clickbait Ninja service worker initialized');

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
    .catch(error => {
      console.error('Message handler error:', error);
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

  console.log('Processing summary request for:', message.url);
  
  try {
    const content = await fetchPageContent(message.url);
    
    return {
      success: true,
      summary: `Content fetched successfully (${content.length} characters)`,
      cached: false,
    };
  } catch (error) {
    console.error('Content fetch error:', error);
    
    if (error instanceof NetworkErrorImpl) {
      return {
        success: false,
        error: getNetworkErrorMessage(error),
        cached: false,
      };
    }
    
    return {
      success: false,
      error: ERROR_MESSAGES.TEMPORARY_ERROR,
      cached: false,
    };
  }
}

async function handleCancelRequest(
  _message: any,
  _sender: chrome.runtime.MessageSender
): Promise<SummaryResponse> {
  console.log('Processing cancel request');
  
  return {
    success: true,
    cached: false,
  };
}

async function handleClearCache(
  _message: any,
  _sender: chrome.runtime.MessageSender
): Promise<SummaryResponse> {
  console.log('Processing clear cache request');
  
  return {
    success: true,
    cached: false,
  };
}

export {};

async function fetchPageContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMING_CONSTANTS.CONTENT_FETCH_TIMEOUT);

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