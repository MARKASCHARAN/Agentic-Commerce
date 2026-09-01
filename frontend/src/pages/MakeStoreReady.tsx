import { Box, Card, CardHeader, CardBody, Heading, Text, Badge, Button, Code } from '@razorpay/blade/components';
import { CheckCircle2, Code2, Copy, Shield, Box as BoxIcon, Loader2 } from 'lucide-react';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';

const JsonBlock = styled.pre`
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 4px;
  font-size: 11px;
  overflow-x: auto;
  border: 1px solid #333;
  margin: 0;
`;

export default function MakeStoreReady() {
  const { data: manifestData, isLoading, error } = useQuery({
    queryKey: ['agent-manifest'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3000/v1/agent-discovery/agentic_electronics');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    }
  });

  if (isLoading) {
    return <Box display="flex" justifyContent="center" padding="spacing.11"><Loader2 className="animate-spin" /></Box>;
  }

  if (error) {
    return <Text color="surface.text.negative.normal">Error loading manifest: {error.message}</Text>;
  }

  return (
    <Box>
      <Box marginBottom="spacing.8">
        <Heading size="large" weight="semibold">AI Commerce Connections</Heading>
        <Text color="surface.text.gray.subtle" marginTop="spacing.2">Make your merchant transactable by external AI buyers.</Text>
      </Box>

      <Box borderTopWidth="thick" borderTopColor="surface.border.positive.normal" borderRadius="medium" marginBottom="spacing.10">
        <Card>
          <CardBody>
            <Box paddingBottom="spacing.5" marginBottom="spacing.5" borderBottomWidth="thin" borderBottomColor="surface.border.gray.muted" display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Box display="flex" alignItems="center" gap="spacing.3">
                  <Heading size="small">Your Merchant is AI-Ready</Heading>
                  <Badge color="positive">● Agent ONLINE</Badge>
                </Box>
                <Text size="small" color="surface.text.gray.subtle" marginTop="spacing.2">Agent ID: <Code size="small">{manifestData?.agent?.id || 'agentic_electronics'}</Code></Text>
              </Box>
            </Box>
            
            <Box display="flex" gap="spacing.8">
              
              <Box flex={1} backgroundColor="surface.background.gray.subtle" padding="spacing.5" borderRadius="medium" borderWidth="thin" borderColor="surface.border.gray.muted">
                <Text size="small" weight="bold" color="surface.text.gray.subtle" textTransform="uppercase" marginBottom="spacing.4">Enabled Capabilities</Text>
                <Box display="flex" flexDirection="column" gap="spacing.3">
                  {manifestData?.commerce?.capabilities?.map((cap: string) => (
                    <Text key={cap} display="flex" alignItems="center" gap="spacing.3" weight="medium"><CheckCircle2 size={16} color="#1a9e52"/> {cap}</Text>
                  ))}
                </Box>
              </Box>

              <Box flex={1} backgroundColor="surface.background.gray.subtle" padding="spacing.5" borderRadius="medium" borderWidth="thin" borderColor="surface.border.gray.muted">
                <Text size="small" weight="bold" color="surface.text.gray.subtle" textTransform="uppercase" marginBottom="spacing.4">API Endpoints</Text>
                
                <Box marginBottom="spacing.4">
                  <Text size="small" color="surface.text.gray.subtle" marginBottom="spacing.2">Agent Commerce Protocol</Text>
                  <Box display="flex" gap="spacing.3" alignItems="center">
                    <Box flex={1}>
                      <Code size="medium">{manifestData?.protocol?.endpoint || 'https://api.yourdomain.com/v1/protocol'}</Code>
                    </Box>
                    <Button variant="tertiary" icon={Copy} />
                  </Box>
                </Box>

                <Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom="spacing.2">
                    <Text size="small" color="surface.text.gray.subtle">Agent Manifest</Text>
                    <Text size="small" color="surface.text.primary.normal" weight="semibold" style={{ cursor: 'pointer' }}>View JSON</Text>
                  </Box>
                  <JsonBlock>
                    {JSON.stringify(manifestData, null, 2)}
                  </JsonBlock>
                </Box>
              </Box>
            </Box>

          </CardBody>
        </Card>
      </Box>

      <Heading size="medium" weight="semibold" marginBottom="spacing.5">AI Clients & Adapters</Heading>
      
      <Box display="flex" gap="spacing.6">
        <Box flex={1}>
          <Card>
            <CardBody>
              <Box display="flex" flexDirection="column" height="100%">
                <Box display="flex" alignItems="center" gap="spacing.3" marginBottom="spacing.4">
                  <BoxIcon size={24} color="#3366FF" />
                  <Heading size="small">MCP Server</Heading>
                </Box>
                <Text size="small" color="surface.text.gray.subtle" marginBottom="spacing.5" style={{ flex: 1 }}>
                  Model Context Protocol adapter running locally on port 3001. Connect supported MCP clients directly to your merchant engine.
                </Text>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Badge color="positive">CONNECTED</Badge>
                  <Button variant="secondary" size="small">Configure</Button>
                </Box>
              </Box>
            </CardBody>
          </Card>
        </Box>

        <Box flex={1}>
          <Card>
            <CardBody>
              <Box display="flex" flexDirection="column" height="100%">
                <Box display="flex" alignItems="center" gap="spacing.3" marginBottom="spacing.4">
                  <Shield size={24} color="#10a37f" />
                  <Heading size="small">ChatGPT Integration</Heading>
                </Box>
                <Text size="small" color="surface.text.gray.subtle" marginBottom="spacing.5" style={{ flex: 1 }}>
                  Official custom GPT / MCP connector for OpenAI's ecosystem.
                </Text>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Badge color="neutral">UNCONFIGURED</Badge>
                  <Button variant="secondary" size="small">Connect</Button>
                </Box>
              </Box>
            </CardBody>
          </Card>
        </Box>

        <Box flex={1}>
          <Card>
            <CardBody>
              <Box display="flex" flexDirection="column" height="100%">
                <Box display="flex" alignItems="center" gap="spacing.3" marginBottom="spacing.4">
                  <Code2 size={24} color="#8a3ffc" />
                  <Heading size="small">Custom Buyer Agent</Heading>
                </Box>
                <Text size="small" color="surface.text.gray.subtle" marginBottom="spacing.5" style={{ flex: 1 }}>
                  Build your own B2B AI procurement agent that talks to your store via the Protocol endpoint.
                </Text>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Badge color="positive">ACTIVE (Phase 9)</Badge>
                  <Button variant="secondary" size="small">View Docs</Button>
                </Box>
              </Box>
            </CardBody>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
