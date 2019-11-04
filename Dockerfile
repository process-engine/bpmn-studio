ARG NODE_IMAGE_VERSION=

# Create base image
FROM node:${NODE_IMAGE_VERSION} as base

RUN apk add --no-cache tini python make g++ supervisor
COPY Docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy & extract tarball
COPY 'bpmn-studio.tar.gz' ./
RUN tar zxvf bpmn-studio.tar.gz

# Install process engine
FROM base as process_engine

ARG PROCESS_ENGINE_VERSION
# Hack to compromise priviliges error https://github.com/npm/npm/issues/17851
RUN npm config set user 0 &&\
    npm config set unsafe-perm true
RUN npm install -g @process-engine/process_engine_runtime@${PROCESS_ENGINE_VERSION}

# Install bpmn studio
FROM process_engine as bpmn_studio

ARG BPMN_STUDIO_VERSION

RUN npm link

# Create release
FROM bpmn_studio as release

EXPOSE 8000 9000
ENTRYPOINT ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

HEALTHCHECK --interval=5s \
            --timeout=5s \
            CMD curl -f http://127.0.0.1:9000 || exit 1

ARG BUILD_DATE
ARG PROCESS_ENGINE_VERSION

LABEL de.5minds.version=${PROCESS_ENGINE_VERSION} \
      de.5minds.release-date=${BUILD_DATE} \
      vendor="5Minds IT-Solutions GmbH & Co. KG" \
      maintainer="5Minds IT-Solutions GmbH & Co. KG"
