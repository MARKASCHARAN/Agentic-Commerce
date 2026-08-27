                    USER
                      │
                      ▼
                 WEB / GENUI
                      │
                      ▼
                   API
                      │
                      ▼
              AGENT RUNTIME
                      │
              ┌───────┴───────┐
              ▼               ▼
           SKILLS        MODEL GATEWAY
              │          ┌────┴────┐
              │          ▼         ▼
              │        GROQ      OPENAI
              │
              ▼
          TOOL GATEWAY
              │
        ┌─────┼─────┐
        ▼     ▼     ▼
       REST GraphQL MCP
              │
              ▼
          POLICY ENGINE
              │
              ▼
       PAYMENT FIREWALL
              │
              ▼
          WORKFLOWS
              │
              ▼
      RAZORPAY TEST API
              │
              ▼
         VERIFICATION
              │
              ▼
          EVENT STORE
          /         \
         ▼           ▼
   OBSERVABILITY   AUDIT