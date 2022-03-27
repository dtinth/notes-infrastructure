FROM node:16.14.2
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY yarn.lock /usr/src/app/
COPY package.json /usr/src/app/
RUN yarn install --frozen-lockfile
EXPOSE 8080
CMD ["bash", "-c", "node src/index.js"]
