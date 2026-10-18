import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { syncInfoDengue } from "../services/epidemiological-sync.service";

// Uso: npm run sync:infodengue            (semanas = INFODENGUE_SYNC_WEEKS)
//      npm run sync:infodengue -- 26      (últimas 26 semanas)
async function main() {
  const arg = Number(process.argv[2]);
  const weeks = Number.isInteger(arg) && arg >= 1 && arg <= 52 ? arg : env.INFODENGUE_SYNC_WEEKS;
  const report = await syncInfoDengue({ weeks });
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
