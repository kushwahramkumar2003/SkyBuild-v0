# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci



# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app

# Copy deps
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build




# Stage 3: Production
FROM node:20-alpine AS runner

# Install necessary production packages
RUN apk add --no-cache tini

# Create app directory and user
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    mkdir -p /app && \
    chown -R appuser:appgroup /app

WORKDIR /app

# Copy production files
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Set environment
ENV NODE_ENV=production

# Use non-root user
USER appuser

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.API_PORT || 9000) + '/health', (r) => {if (r.statusCode !== 200) process.exit(1)})" || exit 1

# Start the application
CMD ["node", "dist/index.js"]

# Document ports
EXPOSE 9000 9002