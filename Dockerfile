FROM node:14

ENV CI_COMMIT_SHA=$CI_COMMIT_SHA

WORKDIR /usr/src/app
COPY . .
RUN npm install
EXPOSE 80
CMD [ "node", "server.js" ]
