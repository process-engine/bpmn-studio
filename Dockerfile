ARG NODE_IMAGE_VERSION

# Create base image
FROM node:${NODE_IMAGE_VERSION}

RUN apk update && apk upgrade && \
    apk add --no-cache make g++ git supervisor python2

COPY Docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

WORKDIR /bpmn-studio

ADD 'bpmn-studio.tar.gz' ./

RUN npm install sqlite3 && \
    npm prune --production && \
    npm link --only=production && \
    cd node_modules/@atlas-engine/fullstack_server && \
    npm link --only=production

EXPOSE 8000 9000
ENTRYPOINT ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

HEALTHCHECK --interval=5s \
            --timeout=5s \
            CMD curl -f http://127.0.0.1:9000 && curl -f http://127.0.0.1:8000 || exit 1

ARG BUILD_DATE
ARG BPMN_STUDIO_VERSION

LABEL de.5minds.version=${BPMN_STUDIO_VERSION} \
      de.5minds.release-date=${BUILD_DATE} \
      vendor="5Minds IT-Solutions GmbH & Co. KG" \
      maintainer="5Minds IT-Solutions GmbH & Co. KG"
