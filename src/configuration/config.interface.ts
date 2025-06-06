export enum Environment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
}

export interface Config {
  port: number;
  environment: Environment;
  serviceName: string;
  apiKey: string;
  mongoUri: string;
  redisUri: string;
  redisKeyPrefix: string;
  cors: CorsConfig;
  bull: BullConfig;
  // TON
  ton: TonConfig;
  jwt: JwtConfig;
  grpcClient: GrpcClientConfig;
  es: ESConfig;
  // KAFKA
  kafka: KafkaConfig;
  auth: AuthConfig;
  // REDIS PUB/SUB
  redisPubSub: RedisPubSubConfig;
  // CHATBOT
  chatbot: ChatbotConfig;
  // TRACING OTEL
  tracing: TracingConfig;
  // ORDER SERVICE
  futuresService: FuturesServiceConfig;
}

export interface AuthConfig {
  authBaseUrl: string;
  authApiKey: string;
}

export interface TonConfig {
  isMainnet: boolean;
  validAuthTime: number;
  allowedDomains: string[];
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface CorsConfig {
  enabled: boolean;
  origins: string[];
}

export interface BullConfig {
  connection: {
    host: string;
    port: number;
    db: number;
    username?: string;
    password?: string;
  };
  prefix: string;
}

export interface GrpcClientConfig {
  wallet: {
    name: string;
    host: string;
    authApiKey: string;
  };
}

export interface ESConfig {
  node: string;
  index: {
    commission: string;
    user: string;
    order: string;
  };
}

export interface KafkaConfig {
  brokers: string[];
  consumerGroupId: string;
  enable: boolean;
}

export interface RedisPubSubConfig {
  enable: boolean;
  host: string;
  port: number;
  db: number;
  username?: string;
  password?: string;
}

export interface ChatbotConfig {
  apiBaseUrl: string;
  apiKey: string;
}

export interface TracingConfig {
  enable: boolean;
  url: string;
  apiKey: string;
}

export interface FuturesServiceConfig {
  apiBaseUrl: string;
  apiKey: string;
}
