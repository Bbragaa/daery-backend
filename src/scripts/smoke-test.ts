// Teste de fumaça da API em execução (Etapa I — validação ponta a ponta).
//
// Uso: com o back-end rodando (npm run dev) e o banco migrado e populado (prisma db seed):
//   npm run smoke                      → usa http://localhost:3000/api
//   SMOKE_API_URL=http://host:porta/api npm run smoke
//
// Lê SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD do .env para os passos de administrador.
// ATENÇÃO: cria dados de teste no banco (contas *@smoke.daery.local e uma notificação de caso
// "Suspeito", excluída logicamente no fim). Não rode em produção.
import "dotenv/config";

const API = (process.env.SMOKE_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api`).replace(/\/$/, "");
const RUN = Date.now().toString(36);

type Json = Record<string, any>;
interface Result { status: "PASS" | "FAIL" | "PULADO"; name: string; detail: string }

class Skip extends Error {}
/** Pula o passo quando um passo anterior, do qual ele depende, falhou. */
function need(value: unknown, what: string) {
  if (value === undefined || value === null) throw new Skip(`depende de: ${what}`);
}
const results: Result[] = [];

async function call(path: string, init: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(API + path, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

async function step(name: string, fn: () => Promise<string | void>) {
  try {
    const detail = (await fn()) ?? "";
    results.push({ status: "PASS", name, detail });
  } catch (error) {
    results.push({ status: error instanceof Skip ? "PULADO" : "FAIL", name, detail: (error as Error).message });
  }
}

function expectStatus(res: { status: number; body: any }, expected: number) {
  if (res.status !== expected) {
    throw new Error(`esperado HTTP ${expected}, recebido ${res.status}: ${JSON.stringify(res.body).slice(0, 160)}`);
  }
}

/** CPF válido aleatório (para não colidir com cadastros existentes). */
function randomCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const digit = (nums: number[]) => {
    const sum = nums.reduce((acc, n, i) => acc + n * (nums.length + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = digit(base);
  const d2 = digit([...base, d1]);
  return [...base, d1, d2].join("");
}

async function main() {
  console.log(`\nTeste de fumaça do Daery contra ${API}\n`);
  const ctx: Json = {};

  await step("API no ar (GET /health)", async () => {
    const res = await fetch(API.replace(/\/api$/, "") + "/health");
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });
  if (results[0].status !== "PASS") {
    console.error(`FAIL  A API não respondeu em ${API} (${results[0].detail}).`);
    console.error("      Suba o back-end com `npm run dev` (e o banco com `docker compose up -d`) e tente de novo.\n");
    process.exitCode = 1;
    return;
  }

  await step("Catálogo de doenças público (GET /diseases)", async () => {
    const res = await call("/diseases");
    expectStatus(res, 200);
    if (!Array.isArray(res.body) || res.body.length === 0) throw new Error("nenhuma doença: rode `npx prisma db seed`");
    ctx.dengue = res.body.find((d: Json) => d.name === "Dengue") ?? res.body[0];
    return `${res.body.length} doenças`;
  });

  await step("Municípios com coordenadas (GET /regions)", async () => {
    const res = await call("/regions");
    expectStatus(res, 200);
    if (!Array.isArray(res.body) || res.body.length === 0) throw new Error("nenhum município: rode `npx prisma db seed`");
    const withCoords = res.body.filter((r: Json) => typeof r.latitude === "number" && typeof r.longitude === "number");
    if (withCoords.length !== res.body.length) throw new Error("há municípios sem coordenadas numéricas");
    ctx.region = res.body[0];
    return `${res.body.length} municípios`;
  });

  await step("Resumo do mapa público (GET /epidemiological-data/summary)", async () => {
    const res = await call("/epidemiological-data/summary");
    expectStatus(res, 200);
    const items: Json[] = res.body.items;
    ctx.summaryBefore = items;
    const fromInfoDengue = items.filter((i) => i.sources.includes("InfoDengue")).length;
    const withSeverity = items.filter((i) => i.severity).length;
    if (fromInfoDengue === 0) {
      return `${items.length} itens, nenhum do InfoDengue no período (rode \`npm run sync:infodengue\`)`;
    }
    return `${items.length} itens, ${fromInfoDengue} do InfoDengue, ${withSeverity} com severidade`;
  });

  await step("Alertas públicos (GET /alerts)", async () => {
    const res = await call("/alerts");
    expectStatus(res, 200);
    const bad = res.body.filter((a: Json) => a.alertLevel < 3);
    if (bad.length) throw new Error("alerta com nível < 3 (viola RNE013)");
    return `${res.body.length} alertas ativos (nível ≥ 3)`;
  });

  await step("Rota protegida sem token responde 401", async () => {
    expectStatus(await call("/users"), 401);
  });

  await step("Cadastro público de cidadão ignora 'role' (POST /auth/register)", async () => {
    const res = await call("/auth/register", {
      method: "POST",
      body: {
        accountType: "CITIZEN", name: "Teste automatizado cidadão", email: `cidadao-${RUN}@smoke.daery.local`,
        password: "SenhaSmoke-123", cpf: randomCpf(), acceptTerms: true, role: "ADMIN",
      },
    });
    expectStatus(res, 201);
    if (res.body.user.role !== "CITIZEN") throw new Error(`perfil criado: ${res.body.user.role}`);
    if ("passwordHash" in res.body.user) throw new Error("passwordHash exposto");
    if (!/^\*\*\*\./.test(res.body.user.cpf)) throw new Error("CPF não mascarado");
    if (!res.body.user.termsAcceptedAt || !res.body.user.termsVersion) throw new Error("aceite dos termos não registrado");
    ctx.citizenToken = res.body.token;
  });

  await step("Cidadão não acessa gestão de usuários (403)", async () => {
    need(ctx.citizenToken, "cadastro do cidadão");
    expectStatus(await call("/users", { token: ctx.citizenToken }), 403);
  });

  await step("Login com senha errada responde 401 genérico", async () => {
    const res = await call("/auth/login", { method: "POST", body: { email: `cidadao-${RUN}@smoke.daery.local`, password: "errada-000" } });
    expectStatus(res, 401);
    if (res.body.error !== "Invalid credentials") throw new Error(`mensagem: ${res.body.error}`);
  });

  await step("Cadastro de profissional nasce pendente", async () => {
    const res = await call("/auth/register", {
      method: "POST",
      body: {
        accountType: "HEALTH_PROFESSIONAL", name: "Teste automatizado profissional",
        email: `profissional-${RUN}@smoke.daery.local`, password: "SenhaSmoke-123", cpf: randomCpf(), acceptTerms: true,
        professional: { council: "CRM", registrationNumber: `S${RUN}`.slice(0, 20), uf: "GO" },
      },
    });
    expectStatus(res, 201);
    if (res.body.user.role !== "CITIZEN" || res.body.user.verificationStatus !== "PENDING") {
      throw new Error(`role=${res.body.user.role} status=${res.body.user.verificationStatus}`);
    }
    ctx.proId = res.body.user.id;
    ctx.proToken = res.body.token;
  });

  await step("Profissional pendente não reporta casos (403)", async () => {
    need(ctx.proToken, "cadastro do profissional");
    need(ctx.dengue && ctx.region, "doenças e municípios do seed");
    const res = await call("/case-notifications", {
      method: "POST", token: ctx.proToken,
      body: { diseaseId: ctx.dengue.id, regionId: ctx.region.id, patientAgeRange: "20-29", patientSex: "F" },
    });
    expectStatus(res, 403);
  });

  await step("Login do ADMIN do seed", async () => {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no .env");
    const res = await call("/auth/login", { method: "POST", body: { email, password } });
    expectStatus(res, 200);
    if (res.body.user.role !== "ADMIN") throw new Error(`perfil: ${res.body.user.role}`);
    ctx.adminToken = res.body.token;
  });

  await step("ADMIN aprova o profissional (PATCH /users/:id/verification)", async () => {
    need(ctx.adminToken, "login do ADMIN");
    need(ctx.proId, "cadastro do profissional");
    const res = await call(`/users/${ctx.proId}/verification`, { method: "PATCH", token: ctx.adminToken, body: { decision: "APPROVED" } });
    expectStatus(res, 200);
    if (res.body.role !== "HEALTH_PROFESSIONAL") throw new Error(`perfil após aprovação: ${res.body.role}`);
    ctx.approved = true;
  });

  await step("Mesmo token passa a valer como profissional (GET /auth/me)", async () => {
    need(ctx.approved, "aprovação do profissional pelo ADMIN");
    const res = await call("/auth/me", { token: ctx.proToken });
    expectStatus(res, 200);
    if (res.body.role !== "HEALTH_PROFESSIONAL") throw new Error(`perfil: ${res.body.role}`);
    if (res.body.professionalRegistration?.council !== "CRM") throw new Error("registro profissional ausente");
  });

  await step("Notificação com 'reportedById' no corpo é recusada (400)", async () => {
    need(ctx.approved, "aprovação do profissional pelo ADMIN");
    const res = await call("/case-notifications", {
      method: "POST", token: ctx.proToken,
      body: { diseaseId: ctx.dengue.id, regionId: ctx.region.id, patientAgeRange: "20-29", patientSex: "F", reportedById: ctx.proId },
    });
    expectStatus(res, 400);
  });

  await step("Profissional aprovado reporta caso; autor vem do token", async () => {
    need(ctx.approved, "aprovação do profissional pelo ADMIN");
    const res = await call("/case-notifications", {
      method: "POST", token: ctx.proToken,
      body: { diseaseId: ctx.dengue.id, regionId: ctx.region.id, patientAgeRange: "IGNORADA", patientSex: "UNKNOWN", status: "SUSPECTED" },
    });
    expectStatus(res, 201);
    if (res.body.reportedById !== ctx.proId) throw new Error("autor diferente do usuário logado");
    ctx.caseId = res.body.id;
  });

  await step("Listagem paginada de casos (GET /case-notifications)", async () => {
    need(ctx.approved, "aprovação do profissional pelo ADMIN");
    const res = await call("/case-notifications?status=SUSPECTED&pageSize=5", { token: ctx.proToken });
    expectStatus(res, 200);
    if (typeof res.body.total !== "number" || !Array.isArray(res.body.data)) throw new Error("formato de página inválido");
    return `${res.body.total} suspeitos no total`;
  });

  await step("Resumo público oculta contagens pequenas; profissional vê o número", async () => {
    need(ctx.caseId, "registro do caso");
    const path = `/epidemiological-data/summary?regionId=${ctx.region.id}&diseaseId=${ctx.dengue.id}`;
    const pro = await call(path, { token: ctx.proToken });
    const anon = await call(path);
    expectStatus(pro, 200);
    expectStatus(anon, 200);
    const full = pro.body.items[0]?.platformReports?.suspected;
    const shown = anon.body.items[0]?.platformReports?.suspected;
    if (typeof full !== "number" || full < 1) throw new Error(`profissional deveria ver o caso: ${full}`);
    const expected = full < 5 ? null : full;
    if (shown !== expected) throw new Error(`público viu ${shown}, esperado ${expected}`);
    return `profissional: ${full}, público: ${shown ?? "oculto"}`;
  });

  await step("ADMIN exclui o caso de teste (exclusão lógica)", async () => {
    need(ctx.adminToken, "login do ADMIN");
    need(ctx.caseId, "registro do caso");
    expectStatus(await call(`/case-notifications/${ctx.caseId}`, { method: "DELETE", token: ctx.adminToken }), 204);
    expectStatus(await call(`/case-notifications/${ctx.caseId}`, { token: ctx.adminToken }), 404);
  });

  await step("ADMIN não pode desativar a própria conta (409)", async () => {
    need(ctx.adminToken, "login do ADMIN");
    const me = await call("/auth/me", { token: ctx.adminToken });
    expectStatus(me, 200);
    expectStatus(await call(`/users/${me.body.id}`, { method: "DELETE", token: ctx.adminToken }), 409);
  });

  await step("ADMIN desativa as contas de teste", async () => {
    need(ctx.adminToken, "login do ADMIN");
    const list = await call("/users", { token: ctx.adminToken });
    expectStatus(list, 200);
    const testUsers = list.body.filter((u: Json) => String(u.email).endsWith(`${RUN}@smoke.daery.local`));
    for (const u of testUsers) expectStatus(await call(`/users/${u.id}`, { method: "DELETE", token: ctx.adminToken }), 204);
    ctx.deactivated = true;
    return `${testUsers.length} contas desativadas`;
  });

  await step("Token de conta desativada deixa de valer (401)", async () => {
    need(ctx.deactivated, "desativação das contas de teste");
    expectStatus(await call("/auth/me", { token: ctx.proToken }), 401);
  });

  const width = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    console.log(`${r.status.padEnd(6)}  ${r.name.padEnd(width)}  ${r.detail}`);
  }
  const count = (status: Result["status"]) => results.filter((r) => r.status === status).length;
  console.log(
    `\n${count("PASS")}/${results.length} verificações passaram` +
      (count("FAIL") ? `, ${count("FAIL")} falharam` : "") +
      (count("PULADO") ? `, ${count("PULADO")} puladas` : "") +
      ` — ${new Date().toLocaleString("pt-BR")}\n`
  );
  if (count("PASS") !== results.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
