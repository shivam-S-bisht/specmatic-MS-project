FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
HEALTHCHECK --interval=2s --timeout=2s --retries=30 --start-period=2s \
  CMD test -f /tmp/ready || exit 1
CMD ["npm", "start"]
