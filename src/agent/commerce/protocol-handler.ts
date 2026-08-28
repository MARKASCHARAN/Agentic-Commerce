import { 
  CommerceMessageEnvelopeSchema, 
  CommerceMessageEnvelope,
  CommerceMessagePayload,
  PaymentRequestPayloadSchema,
  PaymentResultPayloadSchema
} from './protocol';
import { CommerceProtocolValidator } from './validator';
import { CommerceMessageRepository } from '../../database/repositories/commerce-message.repository';
import { MerchantCapabilityResolver } from '../intelligence/capability-resolver';
import { WorkflowStateMachine } from '../workflows/workflow-state-machine';
import { CommerceProtocolWorkflow, CommerceProtocolState, CommerceProtocolEvent } from './commerce-workflow';
import { ToolGateway } from '../tools/tool-gateway';
import crypto from 'crypto';
import { InvalidTransitionError } from '../workflows/errors';

export class CommerceProtocolConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommerceProtocolConflictError';
  }
}

export class CommerceProtocolHandler {
  constructor(
    private readonly messageRepo: CommerceMessageRepository,
    private readonly capabilityResolver: MerchantCapabilityResolver,
    private readonly toolGateway: ToolGateway
  ) {}

  async handleMessage(
    rawMessage: any, 
    workflowMachine: WorkflowStateMachine<any, CommerceProtocolState, CommerceProtocolEvent>
  ): Promise<{ status: 'SUCCESS' | 'IGNORED', message?: CommerceMessageEnvelope, result?: any }> {
    
    // 1. Zod Validation
    const envelope = await CommerceMessageEnvelopeSchema.parseAsync(rawMessage);

    // 2. Protocol & Expiration Validation
    CommerceProtocolValidator.validateEnvelope(envelope);

    // 3. Replay Protection / Fingerprinting
    // [IDEMPOTENCY]
    // Verifies cryptographic payload fingerprints against existing database records.
    // This catches replay attacks or race conditions where the same message ID is maliciously 
    // reused with a different financial payload, rejecting it deterministically.
    const existing = await this.messageRepo.findByMessageId(envelope.messageId);
    if (existing) {
      const existingFingerprint = this.fingerprintPayload(existing.payload);
      const newFingerprint = this.fingerprintPayload(envelope.payload);
      
      if (existingFingerprint !== newFingerprint) {
        throw new CommerceProtocolConflictError(`Duplicate messageId ${envelope.messageId} with conflicting payload`);
      }
      return { status: 'IGNORED', message: envelope };
    }

    // 4. Capability Validation
    const capabilities = await this.capabilityResolver.resolve(envelope.recipient);
    CommerceProtocolValidator.validateCapabilities(envelope.payload.type, capabilities);

    // 5. Workflow State Validation
    const eventType = envelope.payload.type as CommerceProtocolEvent;
    
    // If it's a valid transition, workflowMachine.transition will succeed
    // otherwise it will throw InvalidTransitionError
    await workflowMachine.transition(eventType);

    // 6. Idempotent Persistence
    await this.messageRepo.create({
      messageId: envelope.messageId,
      protocolVersion: envelope.protocolVersion,
      messageType: envelope.payload.type,
      sessionId: envelope.sessionId,
      sender: envelope.sender,
      recipient: envelope.recipient,
      correlationId: envelope.correlationId,
      payload: envelope.payload,
      expiresAt: envelope.expiresAt ? new Date(envelope.expiresAt) : null,
    });

    // 7. Side Effect execution (Payment Firewall)
    // [FINANCIAL SAFETY]
    // The Protocol layer acts as a strict sandbox. A PAYMENT_REQUEST is merely an intent.
    // We isolate financial side-effects by delegating execution strictly to the ToolGateway,
    // preventing AI hallucinations or capability bypasses from triggering money movement.
    let executionResult = null;
    if (envelope.payload.type === 'PAYMENT_REQUEST') {
      const paymentData = PaymentRequestPayloadSchema.parse(envelope.payload.data);
      executionResult = await this.toolGateway.execute({
        toolId: 'capture_payment',
        input: {
          orderId: paymentData.orderId,
          amountMinor: 1000, // In a real system, this is looked up securely from the order
          currency: 'USD'
        },
        context: {
          executionId: envelope.messageId,
          agentId: envelope.sender,
          sessionId: envelope.sessionId,
          userId: envelope.sender, // Caller
          idempotencyKey: `payment-${envelope.correlationId}`
        }
      });
    }

    // 8. Reconcile Payment Results
    if (envelope.payload.type === 'PAYMENT_RESULT') {
      // In a real system, we'd verify the result against an authoritative webhook state here
      // For protocol handling, we just accept the authoritative result mapping
      const resultData = PaymentResultPayloadSchema.parse(envelope.payload.data);
      if (resultData.status !== 'SUCCESS') {
        // Handle failure if needed, workflow state is COMPLETED or PENDING
      }
    }

    return { status: 'SUCCESS', message: envelope, result: executionResult };
  }

  private fingerprintPayload(payload: any): string {
    const canonical = JSON.stringify(this.sortKeys(payload));
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  private sortKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((i: any) => this.sortKeys(i));
    const sorted: any = {};
    Object.keys(obj).sort().forEach(k => {
      sorted[k] = this.sortKeys(obj[k]);
    });
    return sorted;
  }
}
