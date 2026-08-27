import express from "express";
import routes from "./routes/index.js";
import { notFound } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { env } from "../config/env.js";

const app = express();

app.use(express.json());

app.use(routes);

app.use(notFound);
app.use(errorHandler);

app.listen(env.server.port, env.server.host, () => {
  console.log(
    `Agentic Commerce API running on http://${env.server.host}:${env.server.port}`,
  );
});