FROM public.ecr.aws/bitnami/node:22.14.0-debian-12-r4

RUN apt-get update

# Database Configuration
ENV PGHOST='rilly-aurora-postgres-cluster.cluster-ctqj181ngbwi.us-east-1.rds.amazonaws.com'
ENV PGPORT='5432'
ENV PGUSER='postgres'
ENV PGPASSWORD='Hq1acz5Xdw4VJ.l^fF2Z^tDTJ_iKQM'
ENV PGDATABASE='rilly'

ENV S3_BUCKET_NAME='dev-ov3r-api-svc-document-storage'
ENV REGION='us-east-1'
# OpenAI Configuration
ENV OPENAI_API_KEY='sk-svcacct-_vG6qlv8Ic-YPpV33nD6FWA_VjhNj1kQ5847ZhytkXsqdFp1vcilv5M1Oq4MTT3BlbkFJ7exYk9zJFscDP35JpDGI3ghKbf94L3khQkOXbdVwjhaGICIWRO1bUjweKIxnAA'
ENV OPEN_AI_MODEL_NAME='gpt-3.5-turbo'

# Redis Configuration
ENV REDIS_CACHE_HOST_ENDPOINT='dev-rilly-redis-cluster.fm5jrs.0001.use1.cache.amazonaws.com:6379'
ENV DEFAULT_CACHE_TTL='3600'

# App Configuration
ENV NODE_ENV='dev'
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
