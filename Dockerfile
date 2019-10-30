FROM arm32v7/node:10-slim
WORKDIR /translator-thing-template
ADD . .
USER nobody
CMD ["node","app.js"]
