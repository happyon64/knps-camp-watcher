FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npx playwright install --with-deps chromium
COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV HEADLESS=true
EXPOSE 3000
CMD ["npm", "start"]
