FROM node:24-alpine3.21

WORKDIR /usr/src/app

COPY package.json package-lock.json tsconfig.json ./

COPY src/ ./src/

RUN npm install && npm run build && npm prune --omit=dev

CMD [ "node", "./build/main.js" ]
