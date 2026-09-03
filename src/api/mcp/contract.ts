/**
 * External AI Commerce Contract
 * 
 * This file defines the strict schemas and LLM-optimized descriptions for the tools 
 * exposed via the Model Context Protocol (MCP) to external AI buyers (e.g. ChatGPT, Claude).
 * 
 * Crucially, these tools DO NOT execute pricing/policy logic. They simply act as the transport 
 * layer, mapping external AI requests to our backend's deterministic ProtocolEngine.
 */

export const mcpTools = [
  {
    name: 'merchant.commerce.request',
    description: `Find products and create a merchant-approved commercial offer for a buyer request.
The merchant agent may recommend complementary products, bundles, or upgrades when they provide buyer value.
All pricing is determined by the merchant's deterministic pricing and policy engines.
Never assume a price from the tool description. The returned offer is authoritative.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The buyer\'s request (e.g., "Find me 10 laptops under 10 lakh")'
        },
        merchantId: {
          type: 'string',
          description: 'The ID of the merchant to query'
        }
      },
      required: ['query', 'merchantId']
    }
  },
  {
    name: 'merchant.offer.counter',
    description: `Submit a buyer counter-offer.
The requested price is only a proposal.
The merchant PricingEngine determines the actual authorized price.
The tool never guarantees that the requested price will be accepted.`,
    inputSchema: {
      type: 'object',
      properties: {
        offerId: {
          type: 'string',
          description: 'The ID of the current offer being negotiated'
        },
        requestedTotalAmount: {
          type: 'number',
          description: 'The total amount the buyer is proposing'
        }
      },
      required: ['offerId', 'requestedTotalAmount']
    }
  },
  {
    name: 'merchant.offer.accept',
    description: `Accept the currently authorized offer.
Acceptance creates the transaction according to the merchant's deterministic policy and inventory rules.
Do not call this unless the buyer has explicitly accepted the displayed offer.`,
    inputSchema: {
      type: 'object',
      properties: {
        offerId: {
          type: 'string',
          description: 'The ID of the offer being accepted'
        }
      },
      required: ['offerId']
    }
  }
];
