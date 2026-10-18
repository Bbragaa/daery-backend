import { createCaseNotificationSchema, updateCaseNotificationSchema } from "../../validations/case-notification.validation";

const valid = {
  diseaseId: "11111111-1111-4111-8111-111111111111",
  regionId: "22222222-2222-4222-8222-222222222222",
  patientAgeRange: "20-29",
  patientSex: "F",
};

describe("createCaseNotificationSchema", () => {
  it("accepts a minimal valid report", () => {
    expect(createCaseNotificationSchema.safeParse(valid).success).toBe(true);
  });

  it("only accepts the fixed age ranges (no free text)", () => {
    expect(createCaseNotificationSchema.safeParse({ ...valid, patientAgeRange: "uns 30" }).success).toBe(false);
    expect(createCaseNotificationSchema.safeParse({ ...valid, patientAgeRange: "80+" }).success).toBe(true);
  });

  it("rejects dates in the future", () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    expect(createCaseNotificationSchema.safeParse({ ...valid, notificationDate: future }).success).toBe(false);
  });

  it("rejects symptoms that start after the notification", () => {
    const result = createCaseNotificationSchema.safeParse({
      ...valid,
      notificationDate: "2026-10-01",
      symptomsOnsetDate: "2026-10-05",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.symptomsOnsetDate).toBeDefined();
  });

  it("accepts symptoms before the notification", () => {
    expect(
      createCaseNotificationSchema.safeParse({ ...valid, notificationDate: "2026-10-05", symptomsOnsetDate: "2026-10-01" }).success
    ).toBe(true);
  });
});

describe("updateCaseNotificationSchema", () => {
  it("validates the age range on update too", () => {
    expect(updateCaseNotificationSchema.safeParse({ patientAgeRange: "x" }).success).toBe(false);
    expect(updateCaseNotificationSchema.safeParse({ status: "CONFIRMED" }).success).toBe(true);
  });
});
