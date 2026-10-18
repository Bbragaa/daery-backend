import { app } from "./app";
import { env } from "./config/env";
import { startSync } from "./services/sync-runner.service";

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

// Sincronização automática opcional com o InfoDengue (desligada por padrão).
// Usa a mesma trava do endpoint: se uma execução manual estiver em andamento, esta rodada é pulada.
if (env.INFODENGUE_SYNC_INTERVAL_HOURS > 0) {
  const run = () => {
    if (!startSync(env.INFODENGUE_SYNC_WEEKS, "scheduled")) {
      console.log("InfoDengue sync skipped: another synchronization is running");
    }
  };

  setInterval(run, env.INFODENGUE_SYNC_INTERVAL_HOURS * 60 * 60 * 1000).unref();
  run();
}
