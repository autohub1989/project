import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import brokerRoutes from './routes/broker.js';
import orderRoutes from './routes/orders.js';
import webhookRoutes from './routes/webhook.js';
import subscriptionRoutes from './routes/subscription.js';
import { initDatabase } from './database/init.js';
import { createLogger, requestLoggingMiddleware } from './utils/logger.js';
import orderStatusService from './services/orderStatusService.js';
import { subscriptionAPI } from './services/subscriptionService.js';

// Patch: add dotenv first and catch async top-level
dotenv.config();

// Initialize logger before anything else
const logger = createLogger('SERVER');

// Async wrapper to allow top-level await logic
const bootstrap = async () => {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', err, { fatal: true });
    orderStatusService.stopAllPolling();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', reason, {
      fatal: true,
      promise: promise.toString()
    });
    orderStatusService.stopAllPolling();
    process.exit(1);
  });

  const app = express();
  const PORT = process.env.PORT || 3001;

  // CORS
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
  }));
  app.options('*', cors());

  // Helmet
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self"],
        scriptSrc: ["'self"],
        styleSrc: ["'self"],
        imgSrc: ["'self"],
        connectSrc: ["'self"],
      }
    }
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(limiter);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestLoggingMiddleware);

  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      const logBody = { ...req.body };
      if (logBody.password) logBody.password = '[HIDDEN]';
      if (logBody.apiSecret) logBody.apiSecret = '[HIDDEN]';
      if (logBody.apiKey) logBody.apiKey = `${logBody.apiKey.substring(0, 4)}...`;
      logger.debug('Request body received', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        body: logBody
      });
    }
    next();
  });

  // Initialize DB
  try {
    await initDatabase();
    logger.info('Database initialized successfully');
  } catch (err) {
    logger.error('Database initialization failed', err);
    process.exit(1);
  }

  try {
    logger.info('Starting order status service...');
    await orderStatusService.startPollingForOpenOrders();
    logger.info('Order status service initialized successfully');
  } catch (err) {
    logger.error('Order status service initialization failed', err);
  }

  // Subscription Monitor
  try {
    logger.info('Starting subscription monitoring service...');
    setInterval(async () => {
      try {
        const deactivated = await subscriptionAPI.deactivateExpiredSubscriptions();
        if (deactivated > 0) {
          logger.info(`Deactivated ${deactivated} expired subscriptions`);
        }
      } catch (err) {
        logger.error('Subscription monitoring error:', err);
      }
    }, 60 * 60 * 1000);
    logger.info('Subscription monitoring service initialized successfully');
  } catch (err) {
    logger.error('Subscription monitor failed:', err);
  }

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/broker', brokerRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/webhook', webhookRoutes);
  app.use('/api/subscription', subscriptionRoutes);

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      uptime: process.uptime()
    });
  });

  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    logger.error('Unhandled error occurred', err);
    res.status(statusCode).json({
      error: 'Internal Server Error',
      message: err.message
    });
  });

  app.use('*', (req, res) => {
    logger.warn('Route not found', { url: req.originalUrl });
    res.status(404).json({
      error: 'Route not found',
      message: `Cannot ${req.method} ${req.originalUrl}`
    });
  });

  const server = app.listen(PORT, () => {
    logger.info('Server started successfully', { port: PORT });
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    logger.error('Server error occurred', err);
    if (err.code === 'EADDRINUSE') {
      logger.error('Port already in use.');
    }
    orderStatusService.stopAllPolling();
    process.exit(1);
  });
};

// Start server
bootstrap();

export default {};
