/**
 * 错误处理模块单元测试
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ErrorHandler, ErrorLevel, ErrorType } from '../../src/utils/error-handler.js';

describe('错误处理模块', () => {
  let errorHandler: ErrorHandler;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };
    
    errorHandler = new ErrorHandler({
      enableStackTrace: true,
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      logger: mockLogger
    });
  });

  describe('构造函数', () => {
    test('应该使用默认配置', () => {
      const defaultHandler = new ErrorHandler();
      expect(defaultHandler).toBeDefined();
    });

    test('应该使用自定义配置', () => {
      const customHandler = new ErrorHandler({
        enableStackTrace: false,
        maxRetries: 5
      });
      expect(customHandler).toBeDefined();
    });
  });

  describe('handleError', () => {
    test('应该处理基本错误', () => {
      const error = new Error('Test error');
      const result = errorHandler.handleError(error);
      
      expect(result).toBeDefined();
      expect(result.message).toBe('Test error');
      expect(result.type).toBe(ErrorType.INTERNAL_ERROR);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('应该处理自定义错误类型', () => {
      const error = new Error('Network error');
      const result = errorHandler.handleError(error, {
        type: ErrorType.NETWORK_ERROR,
        level: ErrorLevel.WARNING
      });
      
      expect(result.type).toBe(ErrorType.NETWORK_ERROR);
      expect(result.level).toBe(ErrorLevel.WARNING);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('应该包含堆栈跟踪', () => {
      const error = new Error('Test error');
      const result = errorHandler.handleError(error);
      
      expect(result.stackTrace).toBeDefined();
      expect(result.stackTrace).toContain('Error: Test error');
    });

    test('应该在禁用时不包含堆栈跟踪', () => {
      const noStackHandler = new ErrorHandler({
        enableStackTrace: false
      });
      
      const error = new Error('Test error');
      const result = noStackHandler.handleError(error);
      
      expect(result.stackTrace).toBeUndefined();
    });
  });

  describe('isRetryableError', () => {
    test('应该识别可重试的网络错误', () => {
      const error = new Error('Network timeout');
      const result = errorHandler.isRetryableError(error, ErrorType.NETWORK_ERROR);
      
      expect(result).toBe(true);
    });

    test('应该识别不可重试的配置错误', () => {
      const error = new Error('Invalid config');
      const result = errorHandler.isRetryableError(error, ErrorType.CONFIG_ERROR);
      
      expect(result).toBe(false);
    });

    test('应该识别可重试的API错误', () => {
      const error = new Error('API timeout');
      const result = errorHandler.isRetryableError(error, ErrorType.API_ERROR);
      
      expect(result).toBe(true);
    });
  });

  describe('formatErrorForResponse', () => {
    test('应该格式化基本错误响应', () => {
      const error = new Error('Test error');
      const handledError = errorHandler.handleError(error);
      const formatted = errorHandler.formatErrorForResponse(handledError);
      
      expect(formatted).toEqual({
        isError: true,
        errorCode: ErrorType.INTERNAL_ERROR,
        errorMessage: 'Test error',
        timestamp: expect.any(String)
      });
    });

    test('应该在详细模式下包含更多信息', () => {
      const detailHandler = new ErrorHandler({
        enableDetailedErrors: true
      });
      
      const error = new Error('Test error');
      const handledError = detailHandler.handleError(error);
      const formatted = detailHandler.formatErrorForResponse(handledError);
      
      expect(formatted.errorDetails).toBeDefined();
      expect(formatted.stackTrace).toBeDefined();
    });

    test('应该在生产模式下隐藏敏感信息', () => {
      const prodHandler = new ErrorHandler({
        enableDetailedErrors: false,
        enableStackTrace: false
      });
      
      const error = new Error('Sensitive information');
      const handledError = prodHandler.handleError(error);
      const formatted = prodHandler.formatErrorForResponse(handledError);
      
      expect(formatted.stackTrace).toBeUndefined();
      expect(formatted.errorDetails).toBeUndefined();
    });
  });

  describe('createErrorFromCode', () => {
    test('应该根据错误代码创建错误', () => {
      const error = errorHandler.createErrorFromCode('CONFIG_MISSING', 'Required config is missing');
      
      expect(error).toBeDefined();
      expect(error.code).toBe('CONFIG_MISSING');
      expect(error.message).toBe('Required config is missing');
    });

    test('应该为未知错误代码使用默认值', () => {
      const error = errorHandler.createErrorFromCode('UNKNOWN_CODE');
      
      expect(error.code).toBe('UNKNOWN_CODE');
      expect(error.message).toBe('Unknown error occurred');
    });
  });

  describe('retryWithBackoff', () => {
    test('应该成功执行操作', async () => {
      const successfulOperation = jest.fn().mockResolvedValue('success');
      
      const result = await errorHandler.retryWithBackoff(successfulOperation);
      
      expect(result).toBe('success');
      expect(successfulOperation).toHaveBeenCalledTimes(1);
    });

    test('应该重试失败的操作', async () => {
      const failingOperation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');
      
      const result = await errorHandler.retryWithBackoff(failingOperation);
      
      expect(result).toBe('success');
      expect(failingOperation).toHaveBeenCalledTimes(3);
    });

    test('应该在达到最大重试次数后抛出错误', async () => {
      const alwaysFailingOperation = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(errorHandler.retryWithBackoff(alwaysFailingOperation))
        .rejects.toThrow('Always fails');
      
      expect(alwaysFailingOperation).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    test('应该不重试不可重试的错误', async () => {
      const configError = new Error('Config error');
      const nonRetryableOperation = jest.fn().mockRejectedValue(configError);
      
      // 模拟配置错误不可重试
      jest.spyOn(errorHandler, 'isRetryableError').mockReturnValue(false);
      
      await expect(errorHandler.retryWithBackoff(nonRetryableOperation))
        .rejects.toThrow('Config error');
      
      expect(nonRetryableOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('logError', () => {
    test('应该使用正确的日志级别', () => {
      const error = new Error('Test error');
      
      // 测试不同级别的日志
      const criticalError = errorHandler.handleError(error, { level: ErrorLevel.CRITICAL });
      const warningError = errorHandler.handleError(error, { level: ErrorLevel.WARNING });
      const infoError = errorHandler.handleError(error, { level: ErrorLevel.INFO });
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
        expect.any(Object)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARNING'),
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO'),
        expect.any(Object)
      );
    });
  });

  describe('错误分类', () => {
    test('应该正确分类API错误', () => {
      const apiError = new Error('HTTP 500 Internal Server Error');
      const result = errorHandler.handleError(apiError, { type: ErrorType.API_ERROR });
      
      expect(result.type).toBe(ErrorType.API_ERROR);
      expect(result.category).toBe('external');
    });

    test('应该正确分类验证错误', () => {
      const validationError = new Error('Invalid parameter');
      const result = errorHandler.handleError(validationError, { type: ErrorType.VALIDATION_ERROR });
      
      expect(result.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(result.category).toBe('client');
    });

    test('应该正确分类内部错误', () => {
      const internalError = new Error('Unexpected error');
      const result = errorHandler.handleError(internalError);
      
      expect(result.type).toBe(ErrorType.INTERNAL_ERROR);
      expect(result.category).toBe('server');
    });
  });
});