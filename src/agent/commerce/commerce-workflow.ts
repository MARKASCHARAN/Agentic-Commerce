import { createWorkflowDefinition } from '../workflows/workflow-definition';

export type CommerceProtocolState = 
  | 'INITIATED'
  | 'QUOTE_REQUESTED'
  | 'QUOTED'
  | 'OFFERED'
  | 'NEGOTIATING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ORDER_CREATED'
  | 'PAYMENT_PENDING'
  | 'COMPLETED'
  | 'CANCELLED';

export type CommerceProtocolEvent = 
  | 'DISCOVER'
  | 'QUOTE_REQUEST'
  | 'QUOTE'
  | 'OFFER'
  | 'COUNTER_OFFER'
  | 'ACCEPT'
  | 'REJECT'
  | 'ORDER_CREATE'
  | 'PAYMENT_REQUEST'
  | 'PAYMENT_RESULT'
  | 'CANCEL';

export const CommerceProtocolWorkflow = createWorkflowDefinition<any, CommerceProtocolState, CommerceProtocolEvent>({
  id: 'commerce-protocol-v1' as any,
  name: 'Agent-to-Agent Commerce Protocol',
  version: '1.0',
  inputSchema: {} as any, // Not strictly used for data passing in this layer
  states: [
    'INITIATED',
    'QUOTE_REQUESTED',
    'QUOTED',
    'OFFERED',
    'NEGOTIATING',
    'ACCEPTED',
    'REJECTED',
    'ORDER_CREATED',
    'PAYMENT_PENDING',
    'COMPLETED',
    'CANCELLED'
  ],
  initialState: 'INITIATED',
  events: [
    'DISCOVER',
    'QUOTE_REQUEST',
    'QUOTE',
    'OFFER',
    'COUNTER_OFFER',
    'ACCEPT',
    'REJECT',
    'ORDER_CREATE',
    'PAYMENT_REQUEST',
    'PAYMENT_RESULT',
    'CANCEL'
  ],
  transitions: [
    { from: 'INITIATED', event: 'DISCOVER', to: 'INITIATED' }, // Idempotent discover
    { from: 'INITIATED', event: 'QUOTE_REQUEST', to: 'QUOTE_REQUESTED' },
    { from: 'INITIATED', event: 'OFFER', to: 'OFFERED' }, // Direct offer
    { from: 'QUOTE_REQUESTED', event: 'QUOTE', to: 'QUOTED' },
    { from: 'QUOTED', event: 'OFFER', to: 'OFFERED' },
    { from: 'QUOTED', event: 'ORDER_CREATE', to: 'ORDER_CREATED' }, // Accept quote directly
    { from: 'OFFERED', event: 'COUNTER_OFFER', to: 'NEGOTIATING' },
    { from: 'OFFERED', event: 'ACCEPT', to: 'ACCEPTED' },
    { from: 'OFFERED', event: 'REJECT', to: 'REJECTED' },
    { from: 'NEGOTIATING', event: 'OFFER', to: 'OFFERED' },
    { from: 'NEGOTIATING', event: 'COUNTER_OFFER', to: 'NEGOTIATING' },
    { from: 'NEGOTIATING', event: 'ACCEPT', to: 'ACCEPTED' },
    { from: 'NEGOTIATING', event: 'REJECT', to: 'REJECTED' },
    { from: 'ACCEPTED', event: 'ORDER_CREATE', to: 'ORDER_CREATED' },
    { from: 'ORDER_CREATED', event: 'PAYMENT_REQUEST', to: 'PAYMENT_PENDING' },
    { from: 'PAYMENT_PENDING', event: 'PAYMENT_RESULT', to: 'COMPLETED' }, // Or stay pending on fail
    
    // Cancellation
    { from: 'INITIATED', event: 'CANCEL', to: 'CANCELLED' },
    { from: 'QUOTE_REQUESTED', event: 'CANCEL', to: 'CANCELLED' },
    { from: 'QUOTED', event: 'CANCEL', to: 'CANCELLED' },
    { from: 'OFFERED', event: 'CANCEL', to: 'CANCELLED' },
    { from: 'NEGOTIATING', event: 'CANCEL', to: 'CANCELLED' },
    { from: 'ACCEPTED', event: 'CANCEL', to: 'CANCELLED' },
    { from: 'ORDER_CREATED', event: 'CANCEL', to: 'CANCELLED' }
  ]
});
