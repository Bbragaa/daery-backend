import request from "supertest";
import { app } from "../../app";
import { prisma } from "../../config/prisma";
import { signToken } from "../../utils/jwt";

// Testes HTTP: passam por rotas, validação, autenticação, autorização e error handler.
// Só o Prisma Client é substituído por mocks.
jest.mock("../../config/prisma", () => ({
  prisma: {
    user: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    caseNotification: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
  },
}));

const db = prisma as unknown as {
  user: Record<"create" | "findUnique" | "findMany" | "update", jest.Mock>;
  caseNotification: Record<"create" | "findUnique" | "findMany" | "update" | "delete", jest.Mock>;
};

type Role = "ADMIN" | "HEALTH_PROFESSIONAL" | "RESEARCHER" | "INSTITUTION" | "CITIZEN";

function user(id: string, role: Role, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    passwordHash: "stored-hash",
    role,
    requestedRole: null,
    verificationStatus: "NOT_REQUIRED",
    cpf: "52998224725",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  };
}

const users: Record<string, ReturnType<typeof user>> = {
  admin: user("admin", "ADMIN"),
  citizen: user("citizen", "CITIZEN"),
  pro: user("pro", "HEALTH_PROFESSIONAL", { verificationStatus: "APPROVED" }),
  pending: user("pending", "CITIZEN", { requestedRole: "HEALTH_PROFESSIONAL", verificationStatus: "PENDING" }),
  inactive: user("inactive", "ADMIN", { isActive: false }),
};

const tokenFor = (key: keyof typeof users) =>
  `Bearer ${signToken({ sub: users[key].id, role: users[key].role })}`;

const validCase = {
  diseaseId: "11111111-1111-4111-8111-111111111111",
  regionId: "22222222-2222-4222-8222-222222222222",
  patientAgeRange: "20-29",
  patientSex: "F",
};

beforeEach(() => {
  jest.clearAllMocks();
  // `authenticate` relê o usuário pelo id do token.
  db.user.findUnique.mockImplementation(async ({ where }) =>
    Object.values(users).find((u) => u.id === where.id || u.email === where.email) ?? null
  );
});

describe("authentication", () => {
  it("GET /health is public", async () => {
    await request(app).get("/health").expect(200, { status: "ok" });
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/users").expect(401);
    expect(res.body).toEqual({ error: "Authentication required" });
  });

  it("returns 401 for a malformed or forged token", async () => {
    await request(app).get("/api/users").set("Authorization", "Bearer not-a-jwt").expect(401);
  });

  it("returns 401 for a token of a deactivated user", async () => {
    await request(app).get("/api/users").set("Authorization", tokenFor("inactive")).expect(401);
  });

  it("GET /api/auth/me returns the current user without secrets", async () => {
    db.user.findUnique.mockResolvedValueOnce(users.pro); // authenticate
    db.user.findUnique.mockResolvedValueOnce({ ...users.pro, professionalRegistration: null, institution: null });

    const res = await request(app).get("/api/auth/me").set("Authorization", tokenFor("pro")).expect(200);

    expect(res.body.id).toBe("pro");
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body.cpf).toBe("***.982.247-**");
  });

  it("sends security headers (helmet)", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("answers 400 for a malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not json")
      .expect(400);
    expect(res.body).toEqual({ error: "Malformed JSON body" });
  });
});

describe("PATCH /api/auth/me", () => {
  it("lets the user change their own name", async () => {
    db.user.update.mockResolvedValue({});
    db.user.findUnique
      .mockResolvedValueOnce(users.citizen) // authenticate
      .mockResolvedValueOnce({ ...users.citizen, name: "Novo Nome", professionalRegistration: null, institution: null });

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", tokenFor("citizen"))
      .send({ name: "Novo Nome" })
      .expect(200);

    expect(res.body.name).toBe("Novo Nome");
  });

  it("refuses to change the role, email or anything besides the name", async () => {
    await request(app)
      .patch("/api/auth/me")
      .set("Authorization", tokenFor("citizen"))
      .send({ name: "X", role: "ADMIN" })
      .expect(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    await request(app).patch("/api/auth/me").send({ name: "X" }).expect(401);
  });
});

describe("public registration", () => {
  const body = {
    accountType: "CITIZEN",
    name: "Ana",
    email: "ana@example.com",
    password: "senha-segura-123",
    cpf: "529.982.247-25",
    acceptTerms: true,
  };

  it("never lets the caller choose the role", async () => {
    db.user.create.mockImplementation(async ({ data }) => user("new", data.role, data));

    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...body, role: "ADMIN" })
      .expect(201);

    expect(db.user.create.mock.calls[0][0].data.role).toBe("CITIZEN");
    expect(db.user.create.mock.calls[0][0].data.cpf).toBe("52998224725");
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe("CITIZEN");
  });

  it("rejects an invalid CPF with field details", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...body, cpf: "123.456.789-00" })
      .expect(400);

    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details.fieldErrors.cpf).toBeDefined();
  });

  it("requires LGPD consent", async () => {
    await request(app).post("/api/auth/register").send({ ...body, acceptTerms: false }).expect(400);
  });

  it("requires professional data for a health professional sign-up", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ ...body, accountType: "HEALTH_PROFESSIONAL" })
      .expect(400);
  });
});

describe("login", () => {
  it("returns 401 for wrong credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "citizen@example.com", password: "wrong-password" })
      .expect(401);
    expect(res.body).toEqual({ error: "Invalid credentials" });
  });
});

describe("user management is ADMIN-only", () => {
  it("returns 403 for a citizen", async () => {
    await request(app).get("/api/users").set("Authorization", tokenFor("citizen")).expect(403);
  });

  it("returns 403 for a health professional", async () => {
    await request(app).get("/api/users").set("Authorization", tokenFor("pro")).expect(403);
  });

  it("lists users for an ADMIN with masked CPF and no password hash", async () => {
    db.user.findMany.mockResolvedValue([users.citizen]);

    const res = await request(app).get("/api/users").set("Authorization", tokenFor("admin")).expect(200);

    expect(res.body[0]).not.toHaveProperty("passwordHash");
    expect(res.body[0].cpf).toBe("***.982.247-**");
  });

  it("lets an ADMIN approve a pending professional", async () => {
    db.user.update.mockImplementation(async ({ data }) => ({ ...users.pending, ...data }));

    const res = await request(app)
      .patch("/api/users/pending/verification")
      .set("Authorization", tokenFor("admin"))
      .send({ decision: "APPROVED" })
      .expect(200);

    expect(res.body.role).toBe("HEALTH_PROFESSIONAL");
    expect(res.body.verificationStatus).toBe("APPROVED");
  });
});

describe("case notifications", () => {
  it("citizens cannot read case data", async () => {
    await request(app).get("/api/case-notifications").set("Authorization", tokenFor("citizen")).expect(403);
  });

  it("a pending professional is still a citizen and cannot report", async () => {
    await request(app)
      .post("/api/case-notifications")
      .set("Authorization", tokenFor("pending"))
      .send(validCase)
      .expect(403);
    expect(db.caseNotification.create).not.toHaveBeenCalled();
  });

  it("an approved professional reports a case and becomes its author", async () => {
    db.caseNotification.create.mockImplementation(async ({ data }) => ({ id: "case-1", ...data }));

    const res = await request(app)
      .post("/api/case-notifications")
      .set("Authorization", tokenFor("pro"))
      .send(validCase)
      .expect(201);

    expect(res.body.reportedById).toBe("pro");
  });

  it("rejects a body that tries to set reportedById", async () => {
    await request(app)
      .post("/api/case-notifications")
      .set("Authorization", tokenFor("pro"))
      .send({ ...validCase, reportedById: "admin" })
      .expect(400);
  });

  it("only an ADMIN can delete, and deletion is logical", async () => {
    db.caseNotification.findUnique.mockResolvedValue({ id: "case-1", reportedById: "pro", deletedAt: null });
    db.caseNotification.update.mockResolvedValue({});

    await request(app).delete("/api/case-notifications/case-1").set("Authorization", tokenFor("pro")).expect(403);
    await request(app).delete("/api/case-notifications/case-1").set("Authorization", tokenFor("admin")).expect(204);

    expect(db.caseNotification.delete).not.toHaveBeenCalled();
    expect(db.caseNotification.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });
});

describe("admin safeguards (HTTP)", () => {
  it("an ADMIN cannot deactivate their own account", async () => {
    const res = await request(app).delete("/api/users/admin").set("Authorization", tokenFor("admin")).expect(409);
    expect(res.body.error).toBe("You cannot deactivate your own account");
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("an ADMIN cannot change their own role", async () => {
    await request(app)
      .patch("/api/users/admin")
      .set("Authorization", tokenFor("admin"))
      .send({ role: "CITIZEN" })
      .expect(409);
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
