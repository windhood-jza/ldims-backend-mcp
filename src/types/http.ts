/**
 * HTTP Server 相关类型定义
 */

export interface HttpServerConfig {
  host: string;
  port: number;
  auth: {
    enabled: boolean;
    header: string;
    token?: string;
  };
  cors: {
    origin: string;
    credentials?: boolean;
  };
}

export interface HealthCheckResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    mcp: boolean;
    ldims_api: boolean;
  };
}

export interface HttpMcpResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  executionTime?: number | undefined;
}
