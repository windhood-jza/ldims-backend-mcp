/**
 * Jest 测试设置文件
 *
 * 配置全局测试环境和模拟
 */
import { jest } from "@jest/globals";
// 设置环境变量
process.env.NODE_ENV = "test";
process.env.LDIMS_API_BASE_URL = "http://localhost:3000/api";
process.env.LDIMS_API_VERSION = "v1";
process.env.LDIMS_AUTH_TOKEN = "test-token";
process.env.LOG_LEVEL = "error";
// 全局模拟
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};
// 模拟 fetch
global.fetch = jest.fn();
// 测试超时设置
jest.setTimeout(10000);
//# sourceMappingURL=setup.js.map