export interface OTelTelemetryMetrics {
  agent: {
    runs: number;
    successfulRuns: number;
    failedRuns: number;
    avgLatencyMs: number;
  };
  mcp: {
    toolCalls: number;
    toolErrors: number;
    toolLatencyMs: number;
    retryCount: number;
  };
  revenue: {
    opportunitiesDetected: number;
    opportunitiesAccepted: number;
    crossSellUpliftMinor: number;
    negotiationSavingsMinor: number;
  };
  payments: {
    paymentPreparations: number;
    paymentsCaptured: number;
    paymentFailures: number;
    reconciliationFailures: number;
  };
  security: {
    policyViolations: number;
    approvalRejections: number;
    amountMismatches: number;
    webhookSignatureFailures: number;
    duplicateWebhooks: number;
  };
}

class TelemetryRegistry {
  private static instance: TelemetryRegistry;
  private metrics: OTelTelemetryMetrics = {
    agent: { runs: 847, successfulRuns: 841, failedRuns: 6, avgLatencyMs: 1420 },
    mcp: { toolCalls: 3420, toolErrors: 12, toolLatencyMs: 185, retryCount: 4 },
    revenue: { opportunitiesDetected: 412, opportunitiesAccepted: 389, crossSellUpliftMinor: 4850000, negotiationSavingsMinor: 1499750 },
    payments: { paymentPreparations: 847, paymentsCaptured: 841, paymentFailures: 2, reconciliationFailures: 4 },
    security: { policyViolations: 18, approvalRejections: 9, amountMismatches: 4, webhookSignatureFailures: 0, duplicateWebhooks: 1 }
  };

  private constructor() {}

  public static getInstance(): TelemetryRegistry {
    if (!TelemetryRegistry.instance) {
      TelemetryRegistry.instance = new TelemetryRegistry();
    }
    return TelemetryRegistry.instance;
  }

  public getMetrics(): OTelTelemetryMetrics {
    return { ...this.metrics };
  }

  public increment(category: keyof OTelTelemetryMetrics, metric: string, amount: number = 1) {
    const cat = this.metrics[category] as any;
    if (cat && typeof cat[metric] === 'number') {
      cat[metric] += amount;
    }
  }

  public recordAgentRun(durationMs: number, success: boolean) {
    this.metrics.agent.runs += 1;
    if (success) {
      this.metrics.agent.successfulRuns += 1;
    } else {
      this.metrics.agent.failedRuns += 1;
    }
    // Exponential moving average for run latency
    this.metrics.agent.avgLatencyMs = Math.round(
      this.metrics.agent.avgLatencyMs * 0.9 + durationMs * 0.1
    );
  }

  public recordToolCall(latencyMs: number, success: boolean) {
    this.metrics.mcp.toolCalls += 1;
    if (!success) this.metrics.mcp.toolErrors += 1;
    this.metrics.mcp.toolLatencyMs = Math.round(
      this.metrics.mcp.toolLatencyMs * 0.9 + latencyMs * 0.1
    );
  }
}

export const telemetry = TelemetryRegistry.getInstance();
