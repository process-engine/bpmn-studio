# Define NodeJS docker image.
# Here we use alpine as distribution
ARG node_version=10-alpine


# Create base image with project files
FROM node:${node_version} as base

RUN apk add --update git tini python make g++

COPY . /app
WORKDIR /app

# Install dependencies
FROM base as install
RUN npm install

# Create build image
FROM install as build
RUN npm run build

# Create release
FROM build as release
EXPOSE 9000
ENTRYPOINT [ "/sbin/tini" ]
CMD [ "npm", "start", "--", "--host=0.0.0.0", "--port=9000" ]

LABEL de.5minds.version="1.0.0" \
      de.5minds.release-date="2018-08-30" \
      vendor="5Minds IT-Solutions GmbH & Co. KG" \
      maintainer="Dominik Kaminski"
