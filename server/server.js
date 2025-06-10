const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { translateText } = require('./services/geminiService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public', { maxAge: '1d' }));

const LiveRequestManager = require('./utils/LiveRequestManager');
const requestManager = new LiveRequestManager(3);

// Enhanced status monitoring with memory usage
requestManager.on('status', (status) => {
  const memoryUsage = process.memoryUsage();
  io.emit('serverStatus', {
    ...status,
    memoryUsage: {
      rss: memoryUsage.rss / (1024 * 1024),
      heapTotal: memoryUsage.heapTotal / (1024 * 1024),
      heapUsed: memoryUsage.heapUsed / (1024 * 1024),
      external: memoryUsage.external / (1024 * 1024)
    }
  });
});

// Conversation state management
const conversationStates = new Map();

// Enhanced translation endpoint with conversation tracking
app.post('/transcribe', async (req, res) => {
  try {
    const { text, targetLang, conversationId } = req.body;
    
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'text and targetLang are required' });
    }

    // Initialize conversation state if new
    if (conversationId && !conversationStates.has(conversationId)) {
      conversationStates.set(conversationId, {
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        pendingRequests: 0
      });
    }

    // Update conversation state
    if (conversationId) {
      const state = conversationStates.get(conversationId);
      state.lastActivity = Date.now();
      state.messageCount += 1;
      state.pendingRequests += 1;
    }

    const requestFunction = async () => {
      try {
        const startTime = Date.now();
        const translated = await translateText(text, targetLang);
        const processingTime = Date.now() - startTime;

        io.emit('translationResult', {
          original: text,
          translated,
          conversationId,
          processingTime
        });

        // Update conversation state on success
        if (conversationId) {
          const state = conversationStates.get(conversationId);
          if (state) {
            state.pendingRequests -= 1;
            // Clean up old conversations (5 minutes of inactivity)
            if (Date.now() - state.lastActivity > 300000) {
              conversationStates.delete(conversationId);
            }
          }
        }
      } catch (error) {
        // Update conversation state on error
        if (conversationId) {
          const state = conversationStates.get(conversationId);
          if (state) state.pendingRequests -= 1;
        }
        throw error;
      }
    };

    requestManager.addRequest(requestFunction);
    res.json({ 
      message: 'Request queued',
      queuePosition: requestManager.getQueuePosition(),
      estimatedWaitTime: requestManager.getEstimatedWaitTime()
    });
  } catch (error) {
    console.error('Error in transcription endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    memoryUsage: {
      rss: `${(memoryUsage.rss / (1024 * 1024)).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / (1024 * 1024)).toFixed(2)} MB`,
      heapUsed: `${(memoryUsage.heapUsed / (1024 * 1024)).toFixed(2)} MB`
    },
    activeConversations: conversationStates.size,
    queueStatus: requestManager.getStatus()
  });
});

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Close all WebSocket connections
  io.close(() => {
    console.log('Socket.IO server closed.');
  });

  // Give connections 5 seconds to close before forcing shutdown
  setTimeout(() => {
    console.log('Forcing shutdown...');
    process.exit(1);
  }, 5000);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});