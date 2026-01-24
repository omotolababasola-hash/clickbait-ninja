import {
  SummaryRequest,
  SummaryResponse,
  Message,
  MESSAGE_TYPES,
  ERROR_MESSAGES,
  VALID_URL_PATTERN,
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
  
  return {
    success: false,
    error: 'Summary functionality not yet implemented',
    cached: false,
  };
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