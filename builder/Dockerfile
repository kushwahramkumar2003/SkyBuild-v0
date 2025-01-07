# FROM ubuntu:focal

# RUN apt-get update
# RUN apt-get install -y curl
# RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
# RUN apt-get upgrade -y
# RUN apt-get install -y nodejs

# RUN apt-get install git -y

# WORKDIR /home/app

# COPY main.sh main.sh
# COPY script.ts script.ts
# COPY package*.json .

# RUN npm install

# RUN npm run build

# RUN chmod +x main.sh
# RUN chmod +x script.js

# ENTRYPOINT [ "/home/app/main.sh" ]


# Build stage
FROM node:20-slim AS builder

WORKDIR /build

# Copy package files and install dependencies
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies including TypeScript
RUN npm ci && \
    npm install typescript -g

# Copy source files and build
COPY script.ts ./
RUN npm run build





# Production stage
FROM node:20-alpine

# Install git and clean up in a single layer
RUN apk add --no-cache git && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /build/script.js ./
COPY --from=builder /build/node_modules ./node_modules
COPY main.sh ./

# Set correct permissions
RUN chown -R appuser:appgroup /app && \
    chmod +x main.sh script.js

# Switch to non-root user
USER appuser

# Set environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD pgrep -f main.sh || exit 1

# Entry point
ENTRYPOINT ["/bin/sh", "/app/main.sh"]