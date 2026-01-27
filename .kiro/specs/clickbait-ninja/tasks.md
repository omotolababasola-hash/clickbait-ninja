# Implementation Plan: Clickbait Ninja Extension

## Overview

This implementation plan breaks down the Clickbait Ninja Chrome extension into discrete coding tasks. The extension will be built using TypeScript with Chrome Manifest V3 architecture, leveraging Chrome's built-in Summarizer API for content summarization.

## Tasks

- [x] 1. Set up Chrome extension project structure
  - Create manifest.json with Manifest V3 configuration
  - Set up TypeScript build configuration
  - Create directory structure for content scripts, service worker, and assets
  - Configure permissions for activeTab, storage, and cross-origin requests
  - _Requirements: 7.1, 7.4_

- [ ]* 1.1 Set up testing framework
  - Install and configure Jest and fast-check for property-based testing
  - Set up test environment for Chrome extension testing
  - _Requirements: All (testing infrastructure)_

- [x] 2. Implement core type definitions and interfaces
  - Create TypeScript interfaces for messages, cache entries, and configurations
  - Define SummaryRequest, SummaryResponse, CacheEntry, and TooltipConfig types
  - Set up shared constants for timing, limits, and error messages
  - _Requirements: 1.1, 2.1, 4.1, 4.2, 5.1, 5.2, 5.3_

- [ ]* 2.1 Write property test for message interface validation
  - **Property 3: Valid Target Filtering**
  - **Validates: Requirements 1.3, 1.4**

- [ ] 3. Implement service worker (background.js)
  - [x] 3.1 Create message handling system
    - Set up chrome.runtime.onMessage listener
    - Implement message routing for different request types
    - Add request validation and error handling
    - _Requirements: 2.1, 6.5_

  - [ ]* 3.2 Write property test for message handling
    - **Property 15: Error Message Consistency**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

  - [x] 3.3 Implement content fetching functionality
    - Create fetchPageContent function with timeout handling
    - Add CORS error detection and handling
    - Implement content size limiting (1MB max)
    - Handle authentication-required and blocked content scenarios
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.4 Write property test for content fetch timing
    - **Property 4: Content Fetch Timing**
    - **Validates: Requirements 2.1**

  - [ ] 3.5 Implement Chrome Summarizer API integration
    - Initialize Summarizer API with proper configuration
    - Handle model download and availability checking
    - Implement summarization with 5-sentence limit
    - Add language detection and preservation
    - Handle summarization errors and fallbacks
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.6 Write property test for summary length constraint
    - **Property 5: Summary Length Constraint**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 3.7 Write property test for language preservation
    - **Property 6: Language Preservation**
    - **Validates: Requirements 3.4**

- [ ] 4. Implement caching and performance management
  - [ ] 4.1 Create cache management system
    - Implement in-memory cache with timestamp tracking
    - Add cache hit/miss logic with 10-minute expiration
    - Create memory usage monitoring and cleanup
    - _Requirements: 5.2, 5.3_

  - [ ]* 4.2 Write property test for cache behavior
    - **Property 12: Cache Hit Behavior**
    - **Validates: Requirements 5.2**

  - [ ]* 4.3 Write property test for memory management
    - **Property 13: Memory Management**
    - **Validates: Requirements 5.3**

  - [ ] 4.4 Implement request limiting and cleanup
    - Add concurrent request tracking (3 max)
    - Implement request cancellation on navigation
    - Add cleanup on extension disable
    - _Requirements: 5.1, 5.4, 5.5_

  - [ ]* 4.5 Write property test for concurrent request limiting
    - **Property 11: Concurrent Request Limiting**
    - **Validates: Requirements 5.1**

- [ ] 5. Checkpoint - Service worker functionality complete
  - Ensure all service worker tests pass
  - Verify Chrome Summarizer API integration works
  - Test caching and performance features
  - Ask the user if questions arise

- [ ] 6. Implement content script (content.js)
  - [ ] 6.1 Create hover detection system
    - Add event listeners for mouseenter and mouseleave on links
    - Implement URL validation for HTTP/HTTPS links only
    - Add hover timing measurement and validation
    - Handle rapid hover sequences and cleanup
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 6.2 Write property test for hover detection timing
    - **Property 1: Hover Detection Timing**
    - **Validates: Requirements 1.1**

  - [ ]* 6.3 Write property test for request cancellation
    - **Property 2: Request Cancellation on Mouse Leave**
    - **Validates: Requirements 1.2**

  - [ ] 6.4 Implement tooltip creation and management
    - Create dynamic tooltip DOM elements
    - Implement tooltip positioning with viewport awareness
    - Add loading indicator display
    - Handle tooltip show/hide timing requirements
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 6.5 Write property test for tooltip timing
    - **Property 7: Tooltip Display Timing**
    - **Property 8: Tooltip Hide Timing**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 6.6 Write property test for viewport positioning
    - **Property 9: Viewport-Aware Positioning**
    - **Validates: Requirements 4.3**

  - [ ]* 6.7 Write property test for most recent summary display
    - **Property 10: Most Recent Summary Display**
    - **Validates: Requirements 4.4**

- [ ] 7. Implement communication between content script and service worker
  - [ ] 7.1 Create message passing system
    - Implement chrome.runtime.sendMessage for summary requests
    - Add response handling with success/error states
    - Handle service worker unavailability
    - _Requirements: 2.1, 6.5_

  - [ ] 7.2 Add navigation cleanup
    - Implement beforeunload event handling
    - Cancel pending requests on page navigation
    - Clean up event listeners and tooltips
    - _Requirements: 5.4_

  - [ ]* 7.3 Write property test for navigation cleanup
    - **Property 14: Navigation Cleanup**
    - **Validates: Requirements 5.4**

- [ ] 8. Implement error handling and user feedback
  - [ ] 8.1 Create error display system
    - Add error message display in tooltips
    - Implement different error types (network, CORS, auth, etc.)
    - Add error logging for debugging
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 8.2 Add loading states and user feedback
    - Implement loading spinner for tooltip
    - Add progress indication for model download
    - Handle long-running operations gracefully
    - _Requirements: 4.5_

- [ ] 9. Implement extension lifecycle and initialization
  - [ ] 9.1 Create extension startup logic
    - Initialize service worker on extension start
    - Set up content script injection for all tabs
    - Handle extension installation and updates
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 9.2 Write property test for script injection
    - **Property 16: Universal Script Injection**
    - **Validates: Requirements 7.2**

  - [ ] 9.3 Add permission handling
    - Request necessary permissions on installation
    - Handle permission changes and updates
    - Provide user guidance for permission setup
    - _Requirements: 7.4_

- [ ] 10. Final integration and testing
  - [ ] 10.1 Wire all components together
    - Connect content script to service worker
    - Integrate all error handling paths
    - Test end-to-end functionality
    - _Requirements: All_

  - [ ]* 10.2 Write integration tests
    - Test complete hover-to-summary flow
    - Test error scenarios and recovery
    - Test performance under load
    - _Requirements: All_

- [ ] 11. Final checkpoint - Complete extension ready
  - Ensure all tests pass (unit and property-based)
  - Test extension installation and functionality
  - Verify all requirements are met
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The extension uses Chrome Manifest V3 and TypeScript for type safety
- Chrome Summarizer API requires Chrome 138+ and user activation