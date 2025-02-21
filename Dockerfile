FROM public.ecr.aws/bitnami/node:18.20.2-debian-12-r6

RUN apt-get update

# Database Configuration
ENV PGHOST=''
ENV PGPORT=''
ENV PGUSER=''
ENV PGPASSWORD=''
ENV PGDATABASE=''

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

# Bundle app source
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 5000
EXPOSE 8080
EXPOSE 80

# Run the compiled JavaScript using PM2
CMD ["pm2-runtime", "dist/index.js", "--no-daemon"]
