const EventEmitter = require('events');
const { performance } = require('perf_hooks');

class LiveRequestManager extends EventEmitter {
  constructor(maxConcurrent = 3) {
    super();
    this.maxConcurrentRequests = maxConcurrent;
    this.activeRequests = 0;
    this.totalProcessed = 0;
    this.totalFailed = 0;

    this.highPriorityQueue = [];
    this.normalQueue = [];

    // Adaptive rate limiting
    this.cooldownMs = 3000;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;
    this.lastSuccessTime = 0;

    // Performance tracking
    this.requestTimeoutMs = 5000;
    this.avgProcessingTime = 0;
    this.isProcessing = false;

    // Cleanup interval
    setInterval(() => this.cleanup(), 60000).unref();
  }

  addRequest(requestFunction, priority = false, metadata = {}) {
    const requestObj = {
      fn: requestFunction,
      addedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      metadata,
      id: Math.random().toString(36).substring(2, 10)
    };

    if (priority) {
      this.highPriorityQueue.unshift(requestObj); // Add to front for priority
    } else {
      this.normalQueue.push(requestObj);
    }

    this.emitStatus();
    this.processQueue();
    return requestObj.id;
  }

  getNextRequest() {
    this.ageRequests();
    
    if (this.highPriorityQueue.length > 0) {
      return this.highPriorityQueue.shift();
    }
    
    // Implement weighted random selection for normal queue to prevent starvation
    if (this.normalQueue.length > 0) {
      return this.normalQueue.shift();
    }
    
    return null;
  }

  ageRequests() {
    const now = Date.now();
    const agedRequests = [];
    
    // Process normal queue first
    for (let i = 0; i < this.normalQueue.length; i++) {
      if (now - this.normalQueue[i].addedAt > this.requestTimeoutMs) {
        agedRequests.push(this.normalQueue.splice(i, 1)[0]);
        i--;
      }
    }
    
    // Add aged requests to high priority queue in order
    if (agedRequests.length > 0) {
      this.highPriorityQueue.push(...agedRequests);
      this.emit('agedRequests', agedRequests.length);
    }
  }

  async processQueue() {
    if (this.isProcessing || this.isInCooldown()) return;
    this.isProcessing = true;

    try {
      while (this.canProcessMore()) {
        const requestObj = this.getNextRequest();
        if (!requestObj) break;

        this.activeRequests++;
        requestObj.startedAt = Date.now();
        this.emitStatus();

        try {
          const startTime = performance.now();
          await requestObj.fn();
          const processingTime = performance.now() - startTime;

          // Update performance metrics
          this.updateSuccessMetrics(processingTime);
          this.totalProcessed++;
          
          requestObj.completedAt = Date.now();
          this.emit('requestCompleted', {
            ...requestObj,
            processingTime
          });
        } catch (error) {
          this.totalFailed++;
          requestObj.error = error;
          requestObj.completedAt = Date.now();
          
          if (error.response && error.response.status === 429) {
            this.handleRateLimitError(requestObj);
          } else {
            this.emit('requestFailed', requestObj);
            console.error('Request error:', error.message);
          }
        } finally {
          this.activeRequests--;
          this.emitStatus();
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  handleRateLimitError(requestObj) {
    this.updateCooldownOnFailure();
    this.emit('rateLimitHit', this.cooldownMs);

    // Exponential backoff with jitter
    const backoffTime = this.calculateBackoffTime();
    
    setTimeout(() => {
      this.addRequest(requestObj.fn, true, requestObj.metadata);
    }, backoffTime);
  }

  calculateBackoffTime() {
    const base = Math.min(this.cooldownMs, 10000);
    const jitter = Math.random() * 1000;
    return base + jitter;
  }

  updateCooldownOnFailure() {
    const now = Date.now();
    const timeSinceLastFailure = now - this.lastFailureTime;

    if (timeSinceLastFailure > 10000) {
      this.failureCount = 0;
    }

    this.failureCount++;
    this.lastFailureTime = now;

    // More aggressive cooldown increase
    if (this.failureCount >= 2) {
      this.cooldownMs = Math.min(
        this.cooldownMs * (this.failureCount < 5 ? 1.5 : 2),
        30000 // Max 30s cooldown
      );
      this.emit('cooldownIncrease', this.cooldownMs);
    }
  }

  updateSuccessMetrics(processingTime) {
    const now = Date.now();
    this.successCount++;
    this.lastSuccessTime = now;

    // Update average processing time (exponential moving average)
    this.avgProcessingTime = this.avgProcessingTime 
      ? 0.8 * this.avgProcessingTime + 0.2 * processingTime
      : processingTime;

    // Gradually reduce cooldown on sustained success
    if (this.successCount >= 3 && now - this.lastFailureTime > 15000) {
      this.cooldownMs = Math.max(this.cooldownMs * 0.9, 1000); // Min 1s cooldown
      this.emit('cooldownDecrease', this.cooldownMs);
    }
  }

  isInCooldown() {
    return this.failureCount > 0 && 
           Date.now() - this.lastFailureTime < this.cooldownMs;
  }

  canProcessMore() {
    return this.activeRequests < this.maxConcurrentRequests &&
           !this.isInCooldown() &&
           (this.highPriorityQueue.length > 0 || this.normalQueue.length > 0);
  }

  getQueuePosition(requestId) {
    const highPriorityPos = this.highPriorityQueue.findIndex(r => r.id === requestId);
    if (highPriorityPos >= 0) return {
      position: highPriorityPos + 1,
      queue: 'highPriority'
    };

    const normalPos = this.normalQueue.findIndex(r => r.id === requestId);
    if (normalPos >= 0) return {
      position: normalPos + 1 + this.highPriorityQueue.length,
      queue: 'normal'
    };

    return null;
  }

  getEstimatedWaitTime() {
    const activeTime = this.activeRequests * this.avgProcessingTime;
    const queuedItems = this.highPriorityQueue.length + this.normalQueue.length;
    const queueTime = queuedItems * this.avgProcessingTime / this.maxConcurrentRequests;
    return activeTime + queueTime + (this.isInCooldown() ? this.cooldownMs : 0);
  }

  getStatus() {
    return {
      activeRequests: this.activeRequests,
      highPriorityQueue: this.highPriorityQueue.length,
      normalQueue: this.normalQueue.length,
      cooldownMs: this.cooldownMs,
      isInCooldown: this.isInCooldown(),
      avgProcessingTime: this.avgProcessingTime,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      failureRate: this.totalProcessed > 0 
        ? (this.totalFailed / this.totalProcessed) * 100 
        : 0
    };
  }

  cleanup() {
    const now = Date.now();
    const cleanupThreshold = 3600000; // 1 hour

    // Clean up old completed requests from memory
    // (In a real implementation, you might log these to a database first)
  }

  emitStatus() {
    this.emit('status', this.getStatus());
  }
}

module.exports = LiveRequestManager;