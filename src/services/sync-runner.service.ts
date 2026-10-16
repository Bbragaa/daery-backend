import { syncInfoDengue, SyncReport } from "./epidemiological-sync.service";

// Execução da sincronização em segundo plano, com trava.
// A sincronização completa pode levar minutos (cada par município × doença tem timeout próprio),
// tempo demais para uma requisição HTTP. O endpoint só a inicia; o andamento é consultado à parte.
// A trava fica em memória: vale para uma instância da API. O script `npm run sync:infodengue`
// roda em outro processo e não a enxerga (a gravação é idempotente, então isso só gasta chamadas).

export type SyncTrigger = "manual" | "scheduled";

export interface SyncStatus {
  running: boolean;
  /** Início da execução em andamento (null quando parada). */
  startedAt: string | null;
  trigger: SyncTrigger | null;
  weeks: number | null;
  /** Relatório da última execução concluída. */
  lastReport: SyncReport | null;
  /** Erro que interrompeu a última execução (ex.: banco fora do ar), quando houve. */
  lastError: string | null;
  lastFinishedAt: string | null;
}

const initialStatus = (): SyncStatus => ({
  running: false,
  startedAt: null,
  trigger: null,
  weeks: null,
  lastReport: null,
  lastError: null,
  lastFinishedAt: null,
});

let status: SyncStatus = initialStatus();
let current: Promise<void> | null = null;

export function getSyncStatus(): SyncStatus {
  return { ...status };
}

/**
 * Inicia a sincronização se nenhuma estiver em andamento.
 * Retorna `false` sem fazer nada quando já há uma execução (manual ou agendada).
 */
export function startSync(weeks: number, trigger: SyncTrigger): boolean {
  if (status.running) return false;

  status = { ...status, running: true, startedAt: new Date().toISOString(), trigger, weeks };
  current = syncInfoDengue({ weeks })
    .then((report) => {
      status = { ...status, lastReport: report, lastError: null };
      if (process.env.NODE_ENV !== "test") {
        console.log(`InfoDengue sync (${trigger}): ${report.recordsUpserted} records, ${report.failures.length} failures`);
      }
    })
    .catch((error: unknown) => {
      status = { ...status, lastError: error instanceof Error ? error.message : String(error) };
      if (process.env.NODE_ENV !== "test") console.error(`InfoDengue sync (${trigger}) failed:`, error);
    })
    .finally(() => {
      status = { ...status, running: false, startedAt: null, trigger: null, weeks: null, lastFinishedAt: new Date().toISOString() };
      current = null;
    });
  return true;
}

/** Só para testes: aguarda a execução em andamento terminar. */
export async function waitForSync(): Promise<void> {
  await current;
}

/** Só para testes. */
export function resetSyncStatus(): void {
  status = initialStatus();
  current = null;
}
