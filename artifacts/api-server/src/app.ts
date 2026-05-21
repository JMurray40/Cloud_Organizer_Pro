import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { requireAuth } from "./middlewares/requireAuth";
import router from "./routes";
import healthRouter from "./routes/health";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust proxy for correct client IP behind Replit/hosting load balancers
// (needed for express-rate-limit and X-Forwarded-* headers).
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk Frontend API proxy must run BEFORE express.json
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Security headers
app.use(
  helmet({
    // We're an API + same-origin SPA; allow Clerk + our own assets via app shell
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// CORS — strict allowlist via env. Comma-separated origins.
// Example: ALLOWED_ORIGINS=https://fileorbit.app,https://app.fileorbit.app
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      // Same-origin / curl / server-to-server requests have no Origin header.
      if (!origin) return cb(null, true);
      const normalizedOrigin = origin.replace(/\/$/, "");
      if (allowedOrigins.length === 0) {
        // Dev/test fallback: allow localhost, Replit, and Render preview URLs
        if (
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin) ||
          /\.replit\.(dev|app)$/.test(new URL(normalizedOrigin).hostname) ||
          /\.onrender\.com$/.test(new URL(normalizedOrigin).hostname)
        ) {
          return cb(null, true);
        }
        return cb(new Error(`Origin ${origin} not allowed`));
      }
      if (allowedOrigins.includes(normalizedOrigin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed`));
    },
  }),
);

// Tight body size limits — scan endpoint sends arrays of filenames
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Global rate limit on the API surface. Health probes bypass this.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240, // 240 req/min/IP — generous for an SPA, stops abusive bursts
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// Health check is unauthenticated and unthrottled
app.use("/api", healthRouter);

// Everything else: rate-limit + requireAuth + business routes
app.use("/api", apiLimiter, requireAuth, router);

export default app;
