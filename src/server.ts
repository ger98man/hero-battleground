import { createServer } from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { attachChat } from "./realtime/chat.js";

await migrate();
const server = createServer(createApp());
attachChat(server);
server.listen(config.port, () => {
  console.log(`hero-battleground listening on http://localhost:${config.port}`);
});
