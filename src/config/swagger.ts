import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Daery API",
      version: "1.0.0",
      description: "Epidemiological surveillance platform API",
    },
    // Toda rota exige token, exceto as que declaram `security: []` (login e cadastro).
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Role: {
          type: "string",
          enum: ["ADMIN", "HEALTH_PROFESSIONAL", "RESEARCHER", "INSTITUTION", "CITIZEN"],
        },
        VerificationStatus: {
          type: "string",
          enum: ["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"],
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { $ref: "#/components/schemas/Role" },
            requestedRole: { allOf: [{ $ref: "#/components/schemas/Role" }], nullable: true },
            verificationStatus: { $ref: "#/components/schemas/VerificationStatus" },
            cpf: { type: "string", nullable: true, example: "***.982.247-**", description: "Always masked" },
            termsAcceptedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "When the user accepted the sign-up consent (null for legacy and admin-created accounts)",
            },
            termsVersion: { type: "string", nullable: true, example: "2026-10-15" },
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
            details: {
              type: "object",
              description: "Present on validation errors: { fieldErrors, formErrors }",
            },
          },
        },
        RegisterInput: {
          type: "object",
          required: ["accountType", "name", "email", "password", "cpf", "acceptTerms"],
          properties: {
            accountType: { type: "string", enum: ["CITIZEN", "HEALTH_PROFESSIONAL", "INSTITUTION"] },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8, maxLength: 72 },
            cpf: { type: "string", example: "529.982.247-25" },
            acceptTerms: { type: "boolean", enum: [true], description: "LGPD consent" },
            professional: {
              type: "object",
              description: "Required when accountType = HEALTH_PROFESSIONAL",
              required: ["council", "registrationNumber", "uf"],
              properties: {
                council: {
                  type: "string",
                  enum: ["CRM", "COREN", "CRF", "CRO", "CREFITO", "CRN", "CRP", "CRBM", "CRFa"],
                },
                registrationNumber: { type: "string" },
                uf: { type: "string", example: "GO" },
                specialty: { type: "string" },
              },
            },
            institution: {
              type: "object",
              description: "Required when accountType = INSTITUTION",
              required: ["name", "cnpj"],
              properties: {
                name: { type: "string" },
                cnpj: { type: "string", example: "11.222.333/0001-81" },
              },
            },
          },
        },
        LoginInput: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: { $ref: "#/components/schemas/User" },
          },
        },
        Disease: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            icdCode: { type: "string", nullable: true },
            description: { type: "string", nullable: true },
            category: { type: "string", nullable: true },
            riskLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], nullable: true },
            monitoredByInfoDengue: { type: "boolean" },
          },
        },
        Region: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            uf: { type: "string" },
            ibgeCode: { type: "string", nullable: true },
            latitude: { type: "number", nullable: true },
            longitude: { type: "number", nullable: true },
          },
        },
        Severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], nullable: true },
        SummaryItem: {
          type: "object",
          properties: {
            regionId: { type: "string", format: "uuid" },
            regionName: { type: "string" },
            uf: { type: "string" },
            latitude: { type: "number", nullable: true },
            longitude: { type: "number", nullable: true },
            diseaseId: { type: "string", format: "uuid" },
            diseaseName: { type: "string" },
            totalCases: { type: "integer" },
            estimatedCases: { type: "integer", nullable: true },
            latestWeekStart: { type: "string", format: "date", nullable: true },
            latestEpiWeek: { type: "integer", nullable: true, example: 202640 },
            latestAlertLevel: { type: "integer", nullable: true, minimum: 1, maximum: 4 },
            severity: { $ref: "#/components/schemas/Severity" },
            platformReports: {
              type: "object",
              description:
                "Cases reported in Daery. Professional profiles get full counts; anonymous visitors and citizens get counts from 1 to 4 as null (small-count suppression).",
              properties: {
                suspected: { type: "integer", nullable: true },
                confirmed: { type: "integer", nullable: true },
                deaths: { type: "integer", nullable: true },
                suppressed: { type: "boolean", description: "true when at least one count was hidden" },
              },
            },
            sources: { type: "array", items: { type: "string" } },
            includesDemoData: { type: "boolean" },
          },
        },
        SummaryResponse: {
          type: "object",
          properties: {
            period: {
              type: "object",
              properties: {
                startDate: { type: "string", format: "date" },
                endDate: { type: "string", format: "date" },
              },
            },
            generatedAt: { type: "string", format: "date-time" },
            items: { type: "array", items: { $ref: "#/components/schemas/SummaryItem" } },
          },
        },
        Alert: {
          type: "object",
          properties: {
            id: { type: "string" },
            regionId: { type: "string", format: "uuid" },
            regionName: { type: "string" },
            uf: { type: "string" },
            latitude: { type: "number", nullable: true },
            longitude: { type: "number", nullable: true },
            diseaseId: { type: "string", format: "uuid" },
            diseaseName: { type: "string" },
            alertLevel: { type: "integer", minimum: 1, maximum: 4 },
            severity: { $ref: "#/components/schemas/Severity" },
            epiWeek: { type: "integer", nullable: true },
            weekStart: { type: "string", format: "date" },
            title: { type: "string" },
            message: { type: "string" },
            recommendations: { type: "array", items: { type: "string" } },
            source: { type: "string", example: "InfoDengue" },
            isDemo: { type: "boolean", description: "true when the alert comes from fictitious demo data" },
          },
        },
        SyncReport: {
          type: "object",
          properties: {
            fromEpiWeek: { type: "integer", example: 202631 },
            toEpiWeek: { type: "integer", example: 202641 },
            pairs: { type: "integer" },
            recordsUpserted: { type: "integer" },
            failures: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  region: { type: "string" },
                  disease: { type: "string" },
                  reason: { type: "string" },
                },
              },
            },
            startedAt: { type: "string", format: "date-time" },
            finishedAt: { type: "string", format: "date-time" },
          },
        },
        SyncStatus: {
          type: "object",
          properties: {
            running: { type: "boolean" },
            startedAt: { type: "string", format: "date-time", nullable: true },
            trigger: { type: "string", enum: ["manual", "scheduled"], nullable: true },
            weeks: { type: "integer", nullable: true },
            lastReport: { allOf: [{ $ref: "#/components/schemas/SyncReport" }], nullable: true },
            lastError: { type: "string", nullable: true },
            lastFinishedAt: { type: "string", format: "date-time", nullable: true },
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
        CaseNotification: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            diseaseId: { type: "string", format: "uuid" },
            regionId: { type: "string", format: "uuid" },
            reportedById: { type: "string", format: "uuid" },
            patientAgeRange: { type: "string", enum: ["0-4", "5-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80+", "IGNORADA"] },
            patientSex: { $ref: "#/components/schemas/Sex" },
            status: { $ref: "#/components/schemas/CaseStatus" },
            notificationDate: { type: "string", format: "date-time" },
            symptomsOnsetDate: { type: "string", format: "date-time", nullable: true },
            deletedAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateCaseNotificationInput: {
          type: "object",
          required: ["diseaseId", "regionId", "patientAgeRange", "patientSex"],
          properties: {
            diseaseId: { type: "string", format: "uuid" },
            regionId: { type: "string", format: "uuid" },
            patientAgeRange: { type: "string", enum: ["0-4", "5-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80+", "IGNORADA"] },
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
            patientAgeRange: { type: "string", enum: ["0-4", "5-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80+", "IGNORADA"] },
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
