import { type Config, Environment } from './config.interface';

export default (): Config => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  environment: (process.env.NODE_ENV as Environment) || Environment.DEVELOPMENT,
  serviceName: process.env.SERVICE_NAME || 'na3-be',
  apiKey: process.env.API_KEY || '123456a@',
  mongoUri: process.env.MONGO_URI,
  redisUri: process.env.REDIS_URI,
  redisKeyPrefix: process.env.REDIS_KEY_PREFIX || 'na3-be',
  cors: {
    enabled: process.env.CORS_ENABLED === 'true',
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : [],
  },
  bull: {
    connection: {
      host: process.env.BULL_REDIS_HOST || 'localhost',
      port: parseInt(process.env.BULL_REDIS_PORT, 10) || 6379,
      db: parseInt(process.env.BULL_REDIS_DB, 10) || 0,
      username: process.env.BULL_REDIS_USERNAME,
      password: process.env.BULL_REDIS_PASSWORD,
    },
    prefix: process.env.BULL_PREFIX || 'na3-be-bull',
  },
  ton: {
    isMainnet: process.env.IS_TON_MAINNET === 'true',
    validAuthTime: 15 * 60, // 15 minutes
    allowedDomains: ['localhost:5173', 'hopium.dev', 'dev.hopium.dev'],
  },
  jwt: {
    secret: process.env.JWT_SECRET || '123456a@',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  grpcClient: {
    wallet: {
      name: 'WALLET_GRPC_CLIENT',
      host: process.env.GRPC_WALLET_HOST,
      authApiKey: process.env.GRPC_WALLET_AUTH_API_KEY,
    },
  },
  es: {
    node: process.env.ELASTICSEARCH_NODE,
    index: {
      commission: process.env.ES_COMMISSION_INDEX,
      user: process.env.ES_USER_INDEX,
      order: process.env.ES_ORDER_INDEX,
    },
  },
  kafka: {
    enable: process.env.KAFKA_ENABLE === 'true',
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    consumerGroupId: process.env.KAFKA_CONSUMER_GROUP_ID || 'na3-be-consumer',
  },
  auth: {
    authBaseUrl:
      process.env.AUTH_BASE_URL || 'http://127.0.0.1:8386/api/v1/auth',
    authApiKey: process.env.AUTH_API_KEY || '123456a@',
  },
  redisPubSub: {
    enable: process.env.REDIS_PUBSUB_ENABLE === 'true',
    host: process.env.REDIS_PUBSUB_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PUBSUB_PORT, 10) || 6379,
    db: parseInt(process.env.REDIS_PUBSUB_DB, 10) || 0,
    password: process.env.REDIS_PUBSUB_PASSWORD,
  },
  chatbot: {
    apiBaseUrl: process.env.CHATBOT_API_BASE_URL,
    apiKey: process.env.CHATBOT_API_KEY,
  },
  // OTEL TRACING
  tracing: {
    enable: process.env.OTEL_TRACING_ENABLE === 'true',
    url: process.env.OTEL_TRACING_URL,
    apiKey: process.env.OTEL_TRACING_API_KEY,
  },
  futuresService: {
    apiBaseUrl: process.env.FUTURES_SERVICE_API_BASE_URL,
    apiKey: process.env.FUTURES_SERVICE_API_KEY,
  },
});
