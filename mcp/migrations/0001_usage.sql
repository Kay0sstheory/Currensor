CREATE TABLE IF NOT EXISTS daily_usage (
    day TEXT NOT NULL,
    client TEXT NOT NULL,
    event TEXT NOT NULL,
    currency_pair TEXT NOT NULL DEFAULT '',
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, client, event, currency_pair)
);
