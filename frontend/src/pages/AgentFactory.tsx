import { useState } from 'react';
import { Box, Card, CardHeader, CardBody, Heading, Text, Badge, Button, TextInput, SelectInput, Checkbox, CheckboxGroup } from '@razorpay/blade/components';
import { AlertTriangle, Play, ArrowRight } from 'lucide-react';
import styled from 'styled-components';

const TabNav = styled.ul`
  list-style: none;
  padding: 8px 0;
  margin: 0;
  background-color: #ffffff;
  border: 1px solid #e4e6ea;
  border-radius: 8px;
`;

const TabNavItem = styled.li<{ active: boolean }>`
  padding: 12px 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.active ? '#3366FF' : '#121727'};
  background-color: ${props => props.active ? 'rgba(51, 102, 255, 0.05)' : 'transparent'};
  border-left: 3px solid ${props => props.active ? '#3366FF' : 'transparent'};
  
  &:hover {
    background-color: rgba(51, 102, 255, 0.05);
  }
`;

export default function AgentFactory() {
  const [activeTab, setActiveTab] = useState('business');

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom="spacing.8">
        <Box>
          <Heading size="large" weight="semibold">Merchant Agent Factory</Heading>
          <Text color="surface.text.gray.subtle" marginTop="spacing.2">Configure your AI's behavior, pricing guardrails, and autonomy.</Text>
        </Box>
        <Button variant="primary" icon={Play} iconPosition="left">Deploy Agent</Button>
      </Box>

      <Box display="flex" gap="spacing.8">
        <Box width="240px" flexShrink={0}>
          <TabNav>
            <TabNavItem active={activeTab === 'business'} onClick={() => setActiveTab('business')}>1. Business Profile</TabNavItem>
            <TabNavItem active={activeTab === 'catalog'} onClick={() => setActiveTab('catalog')}>2. Catalog Sync</TabNavItem>
            <TabNavItem active={activeTab === 'revenue'} onClick={() => setActiveTab('revenue')}>3. Revenue Strategy</TabNavItem>
            <TabNavItem active={activeTab === 'guardrails'} onClick={() => setActiveTab('guardrails')}>4. Pricing Guardrails</TabNavItem>
            <TabNavItem active={activeTab === 'autonomy'} onClick={() => setActiveTab('autonomy')}>5. Autonomy Limits</TabNavItem>
          </TabNav>
        </Box>

        <Box flex={1}>
          
          {activeTab === 'business' && (
            <Card>
              <CardBody>
                <Box paddingBottom="spacing.5" marginBottom="spacing.5" borderBottomWidth="thin" borderBottomColor="surface.border.gray.muted">
                  <Heading size="small">Business Information</Heading>
                  <Text size="small" color="surface.text.gray.subtle">Set up the identity of your Agentic Merchant.</Text>
                </Box>
                <Box display="flex" flexDirection="column" gap="spacing.6">
                  <TextInput label="Merchant Name" defaultValue="Agentic Electronics" />
                  
                  <Box display="flex" gap="spacing.6">
                    <Box flex={1}>
                      <SelectInput label="Business Type" defaultValue="electronics">
                        <SelectInput.Option value="electronics">Electronics</SelectInput.Option>
                        <SelectInput.Option value="fashion">Fashion</SelectInput.Option>
                      </SelectInput>
                    </Box>
                    <Box flex={1}>
                      <SelectInput label="Currency" defaultValue="inr">
                        <SelectInput.Option value="inr">INR</SelectInput.Option>
                        <SelectInput.Option value="usd">USD</SelectInput.Option>
                      </SelectInput>
                    </Box>
                  </Box>

                  <TextInput label="Product Categories" defaultValue="Laptops, Accessories" />
                  
                  <Box marginTop="spacing.4">
                    <Button variant="primary" onClick={() => setActiveTab('catalog')} icon={ArrowRight} iconPosition="right">Next: Catalog</Button>
                  </Box>
                </Box>
              </CardBody>
            </Card>
          )}

          {activeTab === 'revenue' && (
            <Card>
              <CardBody>
                <Box paddingBottom="spacing.5" marginBottom="spacing.5" borderBottomWidth="thin" borderBottomColor="surface.border.gray.muted">
                  <Heading size="small">Revenue Engine Strategy</Heading>
                  <Text size="small" color="surface.text.gray.subtle">How should your agent organically grow revenue?</Text>
                </Box>
                <Box display="flex" gap="spacing.8" marginBottom="spacing.8">
                  <Box flex={1} padding="spacing.5" backgroundColor="surface.background.primary.subtle" borderRadius="medium">
                    <Text weight="semibold" marginBottom="spacing.4">Optimization Objective</Text>
                    <CheckboxGroup defaultValue={['aov']}>
                      <Checkbox value="conversion">Maximize Conversion</Checkbox>
                      <Checkbox value="aov">Maximize AOV (Average Order Value)</Checkbox>
                      <Checkbox value="balanced">Balanced</Checkbox>
                    </CheckboxGroup>
                  </Box>
                  
                  <Box flex={1}>
                    <Text weight="semibold" marginBottom="spacing.4">Enabled Strategies</Text>
                    <CheckboxGroup defaultValue={['cross-sell', 'upsell', 'bundling', 'negotiation']}>
                      <Checkbox value="cross-sell">Cross-sell</Checkbox>
                      <Checkbox value="upsell">Upsell</Checkbox>
                      <Checkbox value="bundling">Bundling</Checkbox>
                      <Checkbox value="negotiation">Negotiation</Checkbox>
                      <Checkbox value="recovery">Cart Recovery</Checkbox>
                    </CheckboxGroup>
                  </Box>
                </Box>

                <Box borderTopWidth="thin" borderTopColor="surface.border.gray.muted" paddingTop="spacing.6">
                  <Heading size="small" marginBottom="spacing.4">Cross-sell Logic</Heading>
                  <CheckboxGroup defaultValue={['relevant', 'consent', 'budget']}>
                    <Checkbox value="relevant">Only recommend products that are relevant to cart items</Checkbox>
                    <Checkbox value="consent">Require buyer consent before adding to checkout</Checkbox>
                    <Checkbox value="budget">Never exceed buyer's explicitly stated budget</Checkbox>
                  </CheckboxGroup>
                </Box>

                <Box marginTop="spacing.6">
                   <Button variant="primary" onClick={() => setActiveTab('guardrails')} icon={ArrowRight} iconPosition="right">Next: Guardrails</Button>
                </Box>
              </CardBody>
            </Card>
          )}

          {activeTab === 'guardrails' && (
            <Box borderTopWidth="thick" borderTopColor="surface.border.notice.normal" borderRadius="medium">
              <Card>
                <CardBody>
                  <Box paddingBottom="spacing.5" marginBottom="spacing.5" borderBottomWidth="thin" borderBottomColor="surface.border.gray.muted" display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Heading size="small">Pricing Guardrails</Heading>
                      <Text size="small" color="surface.text.gray.subtle">AI Proposes. PolicyEngine Authorizes.</Text>
                    </Box>
                    <Badge color="notice" icon={AlertTriangle}>Strict Enforcement</Badge>
                  </Box>
                  <Box display="flex" gap="spacing.6" marginBottom="spacing.6">
                    <Box flex={1}>
                      <TextInput label="Maximum Allowed Discount (%)" defaultValue="8.0" helpText="The LLM cannot authorize discounts beyond this limit." />
                    </Box>
                    <Box flex={1}>
                      <TextInput label="Minimum Retained Margin (₹)" defaultValue="5000" />
                    </Box>
                    <Box flex={1}>
                      <TextInput label="Maximum Negotiation Rounds" defaultValue="3" />
                    </Box>
                  </Box>

                  <Box borderTopWidth="thin" borderTopColor="surface.border.gray.muted" paddingTop="spacing.6">
                    <Heading size="small" marginBottom="spacing.4">System Permissions</Heading>
                    <CheckboxGroup defaultValue={['bundle', 'agent-offers', 'policy-engine']}>
                      <Checkbox value="bundle">Allow bundle discounts</Checkbox>
                      <Checkbox value="agent-offers">Allow agent-generated dynamic offers</Checkbox>
                      <Checkbox value="llm-modify">LLM may modify final price bypassing backend</Checkbox>
                      <Checkbox value="policy-engine" isDisabled>Backend PolicyEngine <Badge color="positive" marginLeft="spacing.2">ACTIVE</Badge></Checkbox>
                    </CheckboxGroup>
                  </Box>
                </CardBody>
              </Card>
            </Box>
          )}

          {(activeTab === 'catalog' || activeTab === 'autonomy') && (
            <Card>
              <CardBody>
                 <Box paddingBottom="spacing.5" marginBottom="spacing.5" borderBottomWidth="thin" borderBottomColor="surface.border.gray.muted">
                  <Heading size="small">{activeTab === 'catalog' ? 'Catalog Sync' : 'Agent Autonomy'}</Heading>
                  <Text size="small" color="surface.text.gray.subtle">Configure {activeTab} settings here.</Text>
                </Box>
                <Box padding="spacing.11" textAlign="center" backgroundColor="surface.background.gray.subtle" borderRadius="medium">
                  <Text color="surface.text.gray.subtle" marginBottom="spacing.4">UI Blocked out for Hackathon Demo brevity.</Text>
                  <Button variant="secondary" onClick={() => setActiveTab(activeTab === 'catalog' ? 'revenue' : 'business')}>Next Step</Button>
                </Box>
              </CardBody>
            </Card>
          )}
        </Box>
      </Box>
    </Box>
  );
}
