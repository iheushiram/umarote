.PHONY: reset-db

reset-db:
	npx wrangler d1 execute umarote-db --local --command "\
		DELETE FROM race_results; \
		DELETE FROM race_entries; \
		DELETE FROM races; \
		DELETE FROM horses;"

.PHONY: server

server:
	npx wrangler dev --local --ip 0.0.0.0 --port 8787

.PHONY: front

front:
	cd web && npm run dev

.PHONY: generate

generate:
	npx drizzle-kit generate

.PHONY: migrate

migrate:
	npx wrangler d1 migrations apply umarote-db --local