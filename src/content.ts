import {
  SummaryRequest,
  SummaryResponse,
  Position,
  MESSAGE_TYPES,
  TIMING_CONSTANTS,
  VALID_URL_PATTERN,
  ERROR_MESSAGES,
  DEFAULT_TOOLTIP_CONFIG,
} from './types';

let currentTooltip: HTMLElement | null = null;
let currentHoveredLink: HTMLAnchorElement | null = null;
let currentRequestTimestamp: number | null = null;
let hoverStartTime: number | null = null;

function initializeHoverListeners(): void {
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
}

function handleMouseOver(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  
  if (!isValidLink(target)) {
    return;
  }

  const link = target as HTMLAnchorElement;
  const url = link.href;

  if (!VALID_URL_PATTERN.test(url)) {
    return;
  }

  if (currentHoveredLink === link) {
    return;
  }

  if (currentHoveredLink) {
    handleLinkLeave();
  }

  currentHoveredLink = link;
  hoverStartTime = performance.now();

  handleLinkHover(link, url);
}

function handleMouseOut(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  
  if (!isValidLink(target)) {
    return;
  }

  const link = target as HTMLAnchorElement;
  
  if (currentHoveredLink === link) {
    handleLinkLeave();
  }
}

function isValidLink(element: HTMLElement): boolean {
  return element.tagName === 'A' && (element as HTMLAnchorElement).href !== undefined;
}

function handleLinkHover(link: HTMLAnchorElement, url: string): void {
  const timestamp = Date.now();
  currentRequestTimestamp = timestamp;

  showLoadingTooltip(link);

  sendSummaryRequest(url, timestamp)
    .then(response => {
      if (currentRequestTimestamp !== timestamp) {
        return;
      }

      if (response.success && response.summary) {
        showSummaryTooltip(link, response.summary);
      } else {
        showErrorTooltip(link, response.error || ERROR_MESSAGES.TEMPORARY_ERROR);
      }
    })
    .catch(() => {
      if (currentRequestTimestamp !== timestamp) {
        return;
      }
      showErrorTooltip(link, ERROR_MESSAGES.TEMPORARY_ERROR);
    });
}

function handleLinkLeave(): void {
  if (currentRequestTimestamp !== null) {
    cancelSummaryRequest(currentHoveredLink!.href, currentRequestTimestamp);
  }

  hideTooltip();
  currentHoveredLink = null;
  currentRequestTimestamp = null;
  hoverStartTime = null;
}

async function sendSummaryRequest(url: string, timestamp: number): Promise<SummaryResponse> {
  const request: SummaryRequest = {
    type: MESSAGE_TYPES.SUMMARIZE_URL,
    url,
    timestamp,
  };

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(request, (response: SummaryResponse) => {
      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          error: ERROR_MESSAGES.TEMPORARY_ERROR,
          cached: false,
        });
        return;
      }
      resolve(response);
    });
  });
}

function cancelSummaryRequest(url: string, timestamp: number): void {
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.CANCEL_REQUEST,
    url,
    timestamp,
  });
}

initializeHoverListeners();

window.addEventListener('beforeunload', () => {
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.CANCEL_REQUEST,
  });
  hideTooltip();
});

export {};

function createTooltip(): HTMLElement {
  const tooltip = document.createElement('div');
  tooltip.id = 'clickbait-ninja-tooltip';
  
  tooltip.style.position = 'absolute';
  tooltip.style.maxWidth = `${DEFAULT_TOOLTIP_CONFIG.maxWidth}px`;
  tooltip.style.maxHeight = `${DEFAULT_TOOLTIP_CONFIG.maxHeight}px`;
  tooltip.style.padding = `${DEFAULT_TOOLTIP_CONFIG.padding}px`;
  tooltip.style.borderRadius = `${DEFAULT_TOOLTIP_CONFIG.borderRadius}px`;
  tooltip.style.backgroundColor = DEFAULT_TOOLTIP_CONFIG.backgroundColor;
  tooltip.style.border = `1px solid ${DEFAULT_TOOLTIP_CONFIG.borderColor}`;
  tooltip.style.color = DEFAULT_TOOLTIP_CONFIG.textColor;
  tooltip.style.zIndex = `${DEFAULT_TOOLTIP_CONFIG.zIndex}`;
  tooltip.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  tooltip.style.fontSize = '14px';
  tooltip.style.lineHeight = '1.5';
  tooltip.style.overflow = 'auto';
  tooltip.style.pointerEvents = 'none';
  
  return tooltip;
}

function positionTooltip(tooltip: HTMLElement, link: HTMLAnchorElement): void {
  const linkRect = link.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  let x = linkRect.left + window.scrollX;
  let y = linkRect.bottom + window.scrollY + 8;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (x + tooltipRect.width > viewportWidth + window.scrollX) {
    x = viewportWidth + window.scrollX - tooltipRect.width - 16;
  }

  if (x < window.scrollX + 16) {
    x = window.scrollX + 16;
  }

  if (y + tooltipRect.height > viewportHeight + window.scrollY) {
    y = linkRect.top + window.scrollY - tooltipRect.height - 8;
  }

  if (y < window.scrollY + 16) {
    y = window.scrollY + 16;
  }

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function showLoadingTooltip(link: HTMLAnchorElement): void {
  hideTooltip();

  const tooltip = createTooltip();
  tooltip.textContent = ERROR_MESSAGES.LOADING;
  tooltip.style.fontStyle = 'italic';
  tooltip.style.color = '#666666';

  document.body.appendChild(tooltip);
  positionTooltip(tooltip, link);

  currentTooltip = tooltip;
}

function showSummaryTooltip(link: HTMLAnchorElement, summary: string): void {
  if (!currentTooltip) {
    const tooltip = createTooltip();
    document.body.appendChild(tooltip);
    currentTooltip = tooltip;
  }

  currentTooltip.textContent = summary;
  currentTooltip.style.fontStyle = 'normal';
  currentTooltip.style.color = DEFAULT_TOOLTIP_CONFIG.textColor;

  positionTooltip(currentTooltip, link);
}

function showErrorTooltip(link: HTMLAnchorElement, error: string): void {
  if (!currentTooltip) {
    const tooltip = createTooltip();
    document.body.appendChild(tooltip);
    currentTooltip = tooltip;
  }

  currentTooltip.textContent = error;
  currentTooltip.style.fontStyle = 'italic';
  currentTooltip.style.color = '#cc0000';

  positionTooltip(currentTooltip, link);
}

function hideTooltip(): void {
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
}
