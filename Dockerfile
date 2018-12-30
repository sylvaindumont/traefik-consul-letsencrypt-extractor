FROM node:10.15.0-alpine

COPY certs.js /certs.js

ENTRYPOINT ["node", "/certs.js"]
