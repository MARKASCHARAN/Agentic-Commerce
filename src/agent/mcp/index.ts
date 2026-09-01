#!/usr/bin/env node

import { runMcpServer } from "./server.js";

runMcpServer().catch(console.error);
