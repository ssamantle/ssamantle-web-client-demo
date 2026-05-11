# syntax=docker/dockerfile:1

FROM node:20-alpine AS build

WORKDIR /app

# Required for npm dependencies resolved from GitHub.
RUN apk add --no-cache git

COPY package.json package-lock.json ./
RUN npm ci

COPY public ./public
COPY src ./src
COPY tailwind.config.js tsconfig.json ./

ARG PUBLIC_URL=.
ARG API_BASE_URL
ARG USE_MOCK_API=false
ENV PUBLIC_URL=${PUBLIC_URL}
ENV REACT_APP_API_BASE_URL=${API_BASE_URL}
ENV REACT_APP_USE_MOCK_API=${USE_MOCK_API}

RUN if [ "$REACT_APP_USE_MOCK_API" != "true" ]; then test -n "$REACT_APP_API_BASE_URL"; fi
RUN npm run build


FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
