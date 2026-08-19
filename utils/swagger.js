import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Pathology Lab API",
      version: "1.0.0",
      description:
        "Comprehensive API for Pathology Lab backend — endpoints for users, appointments, reports, invoices and messaging.",
      contact: { name: "Pathology Lab", url: "https://example.com" },
    },
    servers: [
      { url: `http://localhost:${process.env.PORT || 5000}/api/v1`, description: "Local server" },
      { url: process.env.FRONTEND_URL_PROD || "http://localhost", description: "Production server (set FRONTEND_URL_PROD)" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // where to look for JSDoc comments that describe the API
  apis: ["./router/*.js", "./controller/*.js", "./models/*.js", "./models/schemas.js"],
};

const specs = swaggerJsdoc(options);

export default function setupSwagger(app) {
  const enabled = process.env.NODE_ENV !== "production" || process.env.SWAGGER === "true";
  if (!enabled) return;

  const swaggerOptions = {
    explorer: true,
    customCss: ".swagger-ui .topbar { background-color: #1f2937 } .swagger-ui .topbar a { color: #fff }",
    swaggerOptions: {
      docExpansion: "none",
      defaultModelsExpandDepth: -1,
    },
    customSiteTitle: "Pathology Lab API Docs",
  };

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));
}
