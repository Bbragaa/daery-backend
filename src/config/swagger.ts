import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Daery API",
      version: "1.0.0",
      description: "Epidemiological surveillance platform API",
    },
    components: {
      schemas: {
        Role: {
          type: "string",
          enum: ["ADMIN", "HEALTH_PROFESSIONAL", "RESEARCHER"],
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { $ref: "#/components/schemas/Role" },
            isActive: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateUserInput: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            role: { $ref: "#/components/schemas/Role" },
          },
        },
        UpdateUserInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            role: { $ref: "#/components/schemas/Role" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        CaseStatus: {
          type: "string",
          enum: ["SUSPECTED", "CONFIRMED", "DISCARDED", "DEATH"],
        },
        Sex: {
          type: "string",
          enum: ["M", "F", "OTHER", "UNKNOWN"],
        },
        InstitutionType: {
          type: "string",
          enum: ["HOSPITAL", "CLINIC", "LABORATORY", "UBS"],
        },
        HealthInstitution: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            cnesCode: { type: "string", nullable: true },
            type: { $ref: "#/components/schemas/InstitutionType" },
            regionId: { type: "string", format: "uuid" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateHealthInstitutionInput: {
          type: "object",
          required: ["name", "type", "regionId"],
          properties: {
            name: { type: "string" },
            cnesCode: { type: "string" },
            type: { $ref: "#/components/schemas/InstitutionType" },
            regionId: { type: "string", format: "uuid" },
          },
        },
        UpdateHealthInstitutionInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            cnesCode: { type: "string" },
            type: { $ref: "#/components/schemas/InstitutionType" },
            regionId: { type: "string", format: "uuid" },
          },
        },
        CaseNotification: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            diseaseId: { type: "string", format: "uuid" },
            regionId: { type: "string", format: "uuid" },
            reportedById: { type: "string", format: "uuid" },
            patientAgeRange: { type: "string" },
            patientSex: { $ref: "#/components/schemas/Sex" },
            status: { $ref: "#/components/schemas/CaseStatus" },
            notificationDate: { type: "string", format: "date-time" },
            symptomsOnsetDate: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateCaseNotificationInput: {
          type: "object",
          required: ["diseaseId", "regionId", "reportedById", "patientAgeRange", "patientSex"],
          properties: {
            diseaseId: { type: "string", format: "uuid" },
            regionId: { type: "string", format: "uuid" },
            reportedById: { type: "string", format: "uuid" },
            patientAgeRange: { type: "string" },
            patientSex: { $ref: "#/components/schemas/Sex" },
            status: { $ref: "#/components/schemas/CaseStatus" },
            notificationDate: { type: "string", format: "date-time" },
            symptomsOnsetDate: { type: "string", format: "date-time" },
          },
        },
        UpdateCaseNotificationInput: {
          type: "object",
          properties: {
            diseaseId: { type: "string", format: "uuid" },
            regionId: { type: "string", format: "uuid" },
            reportedById: { type: "string", format: "uuid" },
            patientAgeRange: { type: "string" },
            patientSex: { $ref: "#/components/schemas/Sex" },
            status: { $ref: "#/components/schemas/CaseStatus" },
            notificationDate: { type: "string", format: "date-time" },
            symptomsOnsetDate: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./dist/routes/*.js"],
};

export const swaggerSpec = swaggerJsdoc(options);
