FROM node:18-alpine

# Install netcat for health checks
RUN apk add --no-cache netcat-openbsd

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Compile contracts
RUN npx hardhat compile

# Make entrypoint executable
RUN chmod +x ./docker/entrypoint.sh

CMD ["sh", "./docker/entrypoint.sh"]
