FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
ENV PORT=3000
EXPOSE $PORT
HEALTHCHECK --interval=2s --timeout=2s --retries=30 --start-period=2s \
  CMD wget -q -O /dev/null http://127.0.0.1:$PORT/swagger.json || exit 1
CMD ["npm", "start"]
