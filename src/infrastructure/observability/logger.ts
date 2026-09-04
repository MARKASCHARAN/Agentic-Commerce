import { tracer, sanitizeTraceData } from './tracing.js';
import { telemetry } from './metrics.js';

export class OTelLogger {
  static info(message: string, attributes?: Record<string, any>) {
    const cleanAttr = sanitizeTraceData(attributes || {});
    console.log(`[OTel INFO] ${new Date().toISOString()} - ${message}`, Object.keys(cleanAttr).length ? cleanAttr : '');
  }

  static warn(message: string, attributes?: Record<string, any>) {
    const cleanAttr = sanitizeTraceData(attributes || {});
    console.warn(`[OTel WARN] ${new Date().toISOString()} - ${message}`, Object.keys(cleanAttr).length ? cleanAttr : '');
  }

  static error(message: string, error?: any, attributes?: Record<string, any>) {
    const cleanAttr = sanitizeTraceData(attributes || {});
    console.error(`[OTel ERROR] ${new Date().toISOString()} - ${message}`, error?.message || error, cleanAttr);
  }

  static recordToolTrace(
    sessionId: string,
    merchantId: string,
    toolName: string,
    durationMs: number,
    status: 'SUCCESS' | 'ERROR',
    input?: any,
    output?: any,
    reasoning?: string
  ) {
    telemetry.recordToolCall(durationMs, status === 'SUCCESS');
    return tracer.recordSpan({
      sessionId,
      merchantId,
      name: `MCP: ${toolName}`,
      type: 'SPAN',
      status,
      durationMs,
      input,
      output,
      reasoning,
      attributes: {
        'gen_ai.system': 'claude-3-5-sonnet',
        'gen_ai.operation.name': 'tool_call',
        'rpc.method': toolName,
      },
    });
  }
}
