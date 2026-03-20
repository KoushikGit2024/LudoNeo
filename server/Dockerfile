# Use the lean Alpine version of Node 20
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files first to leverage Docker caching
COPY package*.json ./

# Install only production dependencies (skips devDependencies)
RUN npm ci --omit=dev

# Copy the rest of your server source code
COPY . .

# Cap Node's memory usage to prevent Out Of Memory (OOM) crashes on the free 256MB VM
ENV NODE_OPTIONS="--max-old-space-size=150"
ENV NODE_ENV="production"

# Expose the port your Express app runs on (adjust if your index.js uses a different port)
EXPOSE 3000

# Start the Node server
CMD ["node", "index.js"]