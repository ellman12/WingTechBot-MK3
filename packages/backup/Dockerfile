FROM alpine:latest

RUN apk add --no-cache postgresql-client bash curl tzdata

ENV TZ=UTC

COPY ./backup_wtb.sh /backup_wtb.sh
RUN chmod +x /backup_wtb.sh

RUN echo "0 0 * * * /bin/sh /backup_wtb.sh >> /var/log/cron.log 2>&1" | crontab -

CMD ["crond", "-f"]
