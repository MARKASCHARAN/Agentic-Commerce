import { Box, Card, CardHeader, CardBody, Heading, Text, Badge, Amount } from '@razorpay/blade/components';
import { ArrowUpRight, ArrowDownRight, Activity, TrendingUp, ShoppingBag } from 'lucide-react';

export default function Overview() {
  return (
    <Box>
      <Box marginBottom="spacing.8">
        <Heading size="large" weight="semibold">Good afternoon, Agentic Electronics</Heading>
        <Text color="surface.text.gray.subtle" size="small" marginTop="spacing.2">Here is what's happening with your Agent today.</Text>
      </Box>

      <Card marginBottom="spacing.8">
        <CardBody>
          <Box paddingBottom="spacing.5" marginBottom="spacing.5" borderBottomWidth="thin" borderBottomColor="surface.border.gray.muted">
            <Heading size="small" weight="bold">AI COMMERCE PERFORMANCE</Heading>
          </Box>
          <Box display="flex" gap="spacing.8">
            <Box flex={1}>
              <Text size="small" color="surface.text.gray.subtle" weight="medium">Revenue influenced by Agent</Text>
              <Box marginY="spacing.3">
                <Amount value={482000} currency="INR" type="heading" size="large" />
              </Box>
              <Box display="flex" alignItems="center" gap="spacing.2">
                <Text color="surface.text.positive.normal" size="small" weight="medium"><ArrowUpRight size={14} /> +18.4%</Text>
                <Text size="small" color="surface.text.gray.subtle">vs last week</Text>
              </Box>
            </Box>

            <Box flex={1}>
              <Text size="small" color="surface.text.gray.subtle" weight="medium">Offers negotiated</Text>
              <Box marginY="spacing.3">
                <Heading size="large">38</Heading>
              </Box>
              <Box display="flex" alignItems="center" gap="spacing.2">
                <Text color="surface.text.positive.normal" size="small" weight="medium"><ArrowUpRight size={14} /> 31.6%</Text>
                <Text size="small" color="surface.text.gray.subtle">Conversion</Text>
              </Box>
            </Box>

            <Box flex={1}>
              <Text size="small" color="surface.text.gray.subtle" weight="medium">Avg Order Value (AOV)</Text>
              <Box marginY="spacing.3">
                <Amount value={12680} currency="INR" type="heading" size="large" />
              </Box>
              <Box display="flex" alignItems="center" gap="spacing.2">
                <Text color="surface.text.negative.normal" size="small" weight="medium"><ArrowDownRight size={14} /> -2.1%</Text>
                <Text size="small" color="surface.text.gray.subtle">vs last week</Text>
              </Box>
            </Box>
          </Box>
        </CardBody>
      </Card>

      <Box display="flex" gap="spacing.8">
        <Box flex={1}>
          <Card>
            <CardBody>
              <Box paddingBottom="spacing.5" marginBottom="spacing.5" borderBottomWidth="thin" borderBottomColor="surface.border.gray.muted" display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Heading size="small">Revenue Opportunities</Heading>
                  <Text size="small" color="surface.text.gray.subtle">Additional revenue generated autonomously</Text>
                </Box>
                <TrendingUp size={20} color="#3366FF" />
              </Box>
              <Box display="flex" flexDirection="column" gap="spacing.5">
                <Box display="flex" justifyContent="space-between" borderBottomWidth="thin" borderBottomColor="surface.border.gray.muted" paddingBottom="spacing.4">
                  <Box>
                    <Text weight="semibold">Cross-sell</Text>
                    <Text size="small" color="surface.text.gray.subtle">24 opportunities executed</Text>
                  </Box>
                  <Box textAlign="right">
                    <Text weight="semibold" color="surface.text.positive.normal">+₹42,400</Text>
                  </Box>
                </Box>
                
                <Box display="flex" justifyContent="space-between" borderBottomWidth="thin" borderBottomColor="surface.border.gray.muted" paddingBottom="spacing.4">
                  <Box>
                    <Text weight="semibold">Upsell</Text>
                    <Text size="small" color="surface.text.gray.subtle">12 opportunities executed</Text>
                  </Box>
                  <Box textAlign="right">
                    <Text weight="semibold" color="surface.text.positive.normal">+₹31,200</Text>
                  </Box>
                </Box>

                <Box display="flex" justifyContent="space-between">
                  <Box>
                    <Text weight="semibold">Negotiation (Discounts)</Text>
                    <Text size="small" color="surface.text.gray.subtle">16 accepted (6.2% avg discount)</Text>
                  </Box>
                  <Box textAlign="right">
                    <Text weight="semibold" color="surface.text.negative.normal">-₹18,500</Text>
                  </Box>
                </Box>
              </Box>
            </CardBody>
          </Card>
        </Box>

        <Box flex={1}>
          <Card>
            <CardBody>
              <Box paddingBottom="spacing.5" marginBottom="spacing.5" borderBottomWidth="thin" borderBottomColor="surface.border.gray.muted" display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Heading size="small">Recent Agent Activity</Heading>
                  <Text size="small" color="surface.text.gray.subtle">Live events processed by PolicyEngine</Text>
                </Box>
                <Activity size={20} color="#3366FF" />
              </Box>
              <Box display="flex" flexDirection="column" gap="spacing.6">
                <Box display="flex" gap="spacing.4">
                  <Text weight="semibold" color="surface.text.gray.subtle">10:44</Text>
                  <Box>
                    <Text weight="semibold">Razorpay payment link generated</Text>
                    <Box marginTop="spacing.2">
                      <Badge color="notice">PAYMENT_PENDING</Badge>
                    </Box>
                  </Box>
                </Box>
                
                <Box display="flex" gap="spacing.4">
                  <Text weight="semibold" color="surface.text.gray.subtle">10:44</Text>
                  <Box>
                    <Text weight="semibold">Buyer accepted offer</Text>
                    <Text size="small" color="surface.text.gray.subtle">Final value: ₹99,000</Text>
                  </Box>
                </Box>

                <Box display="flex" gap="spacing.4">
                  <Text weight="semibold" color="surface.text.gray.subtle">10:43</Text>
                  <Box>
                    <Text weight="semibold">Cross-sell proposed by Agent</Text>
                    <Box display="flex" flexDirection="column" gap="spacing.2" marginTop="spacing.2">
                      <Text size="small" color="surface.text.gray.subtle" display="flex" alignItems="center" gap="spacing.2"><ShoppingBag size={14}/> 10 × Laptop Bag</Text>
                      <Text size="small" color="surface.text.gray.subtle" display="flex" alignItems="center" gap="spacing.2"><ShoppingBag size={14}/> 10 × Wireless Mouse</Text>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </CardBody>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
