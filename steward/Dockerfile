#FROM resin/raspberry-pi2-node:6
FROM node:6

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app
RUN npm install

# Copy sources
COPY . /usr/src/app

EXPOSE 10025
CMD [ "node", "index.js" ]
