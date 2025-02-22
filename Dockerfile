FROM public.ecr.aws/bitnami/node:18.20.2-debian-12-r6

RUN apt-get update

# Database Configuration
ENV PGHOST=''
ENV PGPORT=''
ENV PGUSER=''
ENV PGPASSWORD=''
ENV PGDATABASE=''

ENV S3_BUCKET_NAME=''
ENV REGION='us-east-1'
# OpenAI Configuration
ENV OPENAI_API_KEY=''
ENV OPEN_AI_MODEL_NAME='gpt-3.5-turbo'

# Redis Configuration
ENV REDIS_CACHE_HOST_ENDPOINT=''
ENV DEFAULT_CACHE_TTL='3600'

# App Configuration
ENV NODE_ENV='local'
ENV PORT='5005'

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install && \
    npm install -g typescript pm2 ts-node

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

EXPOSE 5000
EXPOSE 80

# Run the compiled JavaScript using PM2
CMD ["pm2-runtime", "dist/src/index.js", "--no-daemon"]
