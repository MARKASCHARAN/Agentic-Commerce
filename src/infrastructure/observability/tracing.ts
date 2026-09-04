import { PrismaClient } from '@prisma/client';

export interface TraceSpan {
  id: string;
  sessionId: string;
  merchantId: string;
  name: string;
  type: 'SPAN' | 'EVENT';
  status: 'SUCCESS' | 'ERROR' | 'PENDING' | 'RECONCILIATION_FAILED';
  durationMs: number;
  startTime: string;
  endTime?: string;
  attributes: Record<string, any>;
  input?: Record<string, any>;
  output?: Record<string, any>;
  reasoning?: string;
  error?: string;
}

export interface AgentRunTrace {
  sessionId: string;
  merchantId: string;
  orderId?: string;
  status: 'SUCCESS' | 'FAILED' | 'RECONCILIATION_FAILED' | 'IN_PROGRESS';
  totalDurationMs: number;
  startTime: string;
  endTime?: string;
  finalAmountFormatted?: string;
  merchantName?: string;
  summary: {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
  };
  spans: TraceSpan[];
  failureDetails?: {
    step: string;
    code: string;
    expectedAmount: string;
    actualAmount: string;
    message: string;
  };
}

/**
 * Sanitizes data to comply with OpenTelemetry security guidance (redacting credentials, card numbers, CVVs, tokens, raw emails)
 */
export function sanitizeTraceData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeTraceData);

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    if (
      lowerKey.includes('card') ||
      lowerKey.includes('cvv') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('auth')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (lowerKey.includes('email') && typeof value === 'string') {
      const parts = value.split('@');
      sanitized[key] = parts.length === 2 ? `${parts[0][0]}***@${parts[1]}` : '[REDACTED_EMAIL]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeTraceData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Lightweight OpenTelemetry Agent Tracer singleton
 */
export class AgentTracer {
  private static instance: AgentTracer;
  private memoryTraces: Map<string, TraceSpan[]> = new Map();

  private constructor() {}

  public static getInstance(): AgentTracer {
    if (!AgentTracer.instance) {
      AgentTracer.instance = new AgentTracer();
    }
    return AgentTracer.instance;
  }

  public recordSpan(span: Omit<TraceSpan, 'id' | 'startTime'> & { id?: string; startTime?: string }): TraceSpan {
    const fullSpan: TraceSpan = {
      id: span.id || `span_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      startTime: span.startTime || new Date().toISOString(),
      ...span,
      input: sanitizeTraceData(span.input),
      output: sanitizeTraceData(span.output),
      attributes: sanitizeTraceData(span.attributes),
    };

    const sessionSpans = this.memoryTraces.get(span.sessionId) || [];
    sessionSpans.push(fullSpan);
    this.memoryTraces.set(span.sessionId, sessionSpans);

    return fullSpan;
  }

  public recordEvent(
    sessionId: string,
    merchantId: string,
    name: string,
    attributes: Record<string, any> = {},
    reasoning?: string
  ): TraceSpan {
    return this.recordSpan({
      sessionId,
      merchantId,
      name,
      type: 'EVENT',
      status: 'SUCCESS',
      durationMs: 0,
      attributes,
      reasoning,
    });
  }

  public getSessionTrace(sessionId: string): TraceSpan[] {
    return this.memoryTraces.get(sessionId) || [];
  }

  public clearSessionTrace(sessionId: string) {
    this.memoryTraces.delete(sessionId);
  }
}

export const tracer = AgentTracer.getInstance();
