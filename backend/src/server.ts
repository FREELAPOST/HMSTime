import { env } from "./config/env.js";
import { app } from "./app.js";
import { ensureDailyCheckpoint } from "./services/checkpointService.js";

app.listen(env.PORT, () => {
  console.log(`API rodando em http://localhost:${env.PORT}`);
});

ensureDailyCheckpoint().catch((error) => {
  console.warn("Checkpoint automatico nao foi criado:", error.message);
});

setInterval(() => {
  ensureDailyCheckpoint().catch((error) => {
    console.warn("Checkpoint automatico nao foi criado:", error.message);
  });
}, 60 * 60 * 1000);
