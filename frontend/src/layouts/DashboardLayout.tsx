import { Box, Heading, Badge } from '@razorpay/blade/components';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, Users, ShieldCheck } from 'lucide-react';
import styled from 'styled-components';

const SidebarContainer = styled.aside`
  width: 260px;
  background-color: #0f1627;
  color: #fff;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #222d4a;
  overflow-y: auto;
`;

const SidebarBrand = styled.div`
  padding: 24px 20px;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #222d4a;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const NavList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const StyledNavLink = styled(NavLink)`
  display: flex;
  align-items: center;
  padding: 10px 20px;
  color: #90a0be;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
    color: #fff;
  }
  
  &.active {
    background-color: rgba(255, 255, 255, 0.1);
    color: #3366FF;
    border-left: 3px solid #3366FF;
  }
  
  svg {
    margin-right: 12px;
    width: 18px;
    height: 18px;
  }
`;

export default function DashboardLayout() {
  return (
    <Box display="flex" height="100vh" overflow="hidden" backgroundColor="surface.background.gray.intense">
      <SidebarContainer>
        <SidebarBrand>
          AGENTIC COMMERCE
        </SidebarBrand>
        
        <Box marginBottom="spacing.6">
          <NavList>
            <li>
              <StyledNavLink to="/overview">
                <LayoutDashboard /> Overview
              </StyledNavLink>
            </li>
          </NavList>
        </Box>

        <Box marginBottom="spacing.6">
          <Box paddingX="spacing.5" paddingBottom="spacing.2" color="surface.text.gray.muted" fontSize={11} fontWeight="bold" textTransform="uppercase">
            Agent
          </Box>
          <NavList>
            <li>
              <StyledNavLink to="/factory">
                <Settings /> Agent Factory
              </StyledNavLink>
            </li>
          </NavList>
        </Box>

        <Box marginBottom="spacing.6">
          <Box paddingX="spacing.5" paddingBottom="spacing.2" color="surface.text.gray.muted" fontSize={11} fontWeight="bold" textTransform="uppercase">
            AI Ecosystem
          </Box>
          <NavList>
            <li>
              <StyledNavLink to="/ai-ready">
                <Users /> AI Connections
              </StyledNavLink>
            </li>
          </NavList>
        </Box>
      </SidebarContainer>

      <Box flex={1} display="flex" flexDirection="column" overflow="auto">
        <Box 
          height="64px" 
          backgroundColor="surface.background.gray.base" 
          borderBottomWidth="thin" 
          borderBottomColor="surface.border.gray.muted"
          display="flex"
          alignItems="center"
          justifyContent="flex-end"
          paddingX="spacing.8"
        >
          <Badge color="positive">Agent ONLINE</Badge>
        </Box>
        
        <Box padding="spacing.8" maxWidth="1200px" marginX="auto" width="100%">
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
