# Environmental observation delivery

Eight laboratories send compressed measurement files each night, and two field partners send
individual observations throughout the day. Names, units, missing-value conventions, and
identifier formats differ by sender and sometimes change without much notice.

We need to retain exactly what arrived, reject or isolate unusable records, standardize the
rest, remove repeats, attach station and instrument reference data, calculate hourly and daily
summaries, and make trustworthy datasets available to analysts. Analysts must be able to take
any published value and discover its source and the rules used to derive it.

Nightly deliveries total about 5 TB and should be available by 08:00. Daytime observations
should normally appear within two minutes. Records can arrive up to 48 hours late. Partners
occasionally resend a corrected file, and our calculation rules change several times a year;
we need to reproduce the last 90 days without asking partners to resend data.

Measurements can contain a station operator identifier that must be removed from analyst
outputs and deleted from retained source material after 30 days. Bad records should not stop
unrelated senders. We have not agreed whether a corrected file replaces all earlier values or
only the records it contains, or how long a daily summary may continue changing after its day.
