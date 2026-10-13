FROM node:24-alpine
# Everything runs as the `node` user (uid 1000, gid 1000: the same ids as the first user of a normal Linux or WSL install). The
# folder ./frontend is mounted into the container, so the files that the container writes there (.next, tsconfig.tsbuildinfo, the
# caches) belong to you on the host, not to root, and `git pull` is never blocked by them. If your user id is not 1000, add
# `user: "<your uid>:<your gid>"` to the frontend service of docker-compose.yml.
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node package*.json ./
RUN npm install
COPY --chown=node:node . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
