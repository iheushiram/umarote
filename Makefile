.PHONY: reset-db

reset-db:
	npx wrangler d1 execute umarote-db --local --command "\
		DELETE FROM race_results; \
		DELETE FROM race_entries; \
		DELETE FROM races; \
		DELETE FROM horses;"